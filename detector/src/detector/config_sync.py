"""Live config sync: poll the backend for detection rules + forbidden zones.

The poller runs on a background daemon thread (mirroring ClipUploader). It does a
conditional GET (ETag / If-None-Match) and, when the config changes, parses the
payload *on the poller thread* into a pixel-space `RemoteConfig`. The main loop
then pulls and applies the result at a safe point:

  - the scene/zone config can be swapped any time (the analyzer is stateless),
  - the action classes are swapped only when the recorder is quiescent, so an
    in-progress recording is never corrupted.

The parsed result lives in two independent "pending" slots guarded by a short
lock; the poller never touches detector/recorder internals directly.
"""

from __future__ import annotations

import threading
import time

import requests

from src.detector.config import (
    Config,
    BASE_YOLO_MAPPING,
    LSTM_MAPPING,
    SCENE_VECTOR_KEYS,
)
from src.detector.scene.config import SceneConfig, Zone, CrowdCfg
from src.detector import logger


# Element names the detector's ActionVector understands (must match the CSV
# loader filter in recorder.load_action_classes).
_DETECTOR_VOCAB: set[str] = (
    set(BASE_YOLO_MAPPING.values())
    | set(LSTM_MAPPING.values())
    | {"person"}
    | SCENE_VECTOR_KEYS
)

# Backend catalog name -> detector internal vector key. "human" is the UI word
# for the pose model's "person"; "backpack" historically mapped to a bag class.
_ELEMENT_ALIAS: dict[str, str] = {"human": "person", "backpack": "suitcase"}

# Names of the synthetic action classes the detector derives from zones/crowd.
_ZONE_ACTION_NAME = "forbidden_zone_entry"
_CROWD_ACTION_NAME = "crowd_gathering"

POLL_TIMEOUT_S = 10.0
_STOP_TICK = 0.5


# (name, {element: min_count}) — one entry per backend detection vector.
ActionSpec = tuple[str, dict[str, int]]


class RemoteConfig:
    def __init__(self, action_classes: list[ActionSpec], scene_config: SceneConfig | None):
        self.action_classes = action_classes
        self.scene_config = scene_config

    def is_empty(self) -> bool:
        return not self.action_classes and self.scene_config is None


class ConfigPoller:
    def __init__(self, url: str, interval_s: float, frame_size: tuple[int, int] | None):
        self.url = url
        self.interval_s = interval_s
        self.frame_size = frame_size  # (width, height); None disables zone parsing

        self._lock = threading.Lock()
        # None = nothing pending. For actions, [] is a valid (empty) pending value.
        self._pending_actions: list[ActionSpec] | None = None
        # None = nothing pending; (cfg_or_None,) = a pending scene update.
        self._pending_scene: tuple[SceneConfig | None] | None = None
        self._last_etag: str | None = None

        self._stop = False
        self._thread: threading.Thread | None = None

    # ----- lifecycle -----------------------------------------------------

    def start(self) -> None:
        if self._thread is None or not self._thread.is_alive():
            self._stop = False
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
            logger.info("Started config poller thread (every %.1fs)", self.interval_s)

    def stop(self) -> None:
        self._stop = True
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

    # ----- consumed by the main loop -------------------------------------

    def take_pending_actions(self) -> list[ActionSpec] | None:
        with self._lock:
            actions, self._pending_actions = self._pending_actions, None
            return actions

    def has_pending_actions(self) -> bool:
        with self._lock:
            return self._pending_actions is not None

    def take_pending_scene(self) -> tuple[SceneConfig | None] | None:
        with self._lock:
            scene, self._pending_scene = self._pending_scene, None
            return scene

    # ----- background work -----------------------------------------------

    def _run(self) -> None:
        while not self._stop:
            try:
                self._poll_once()
            except Exception as e:  # never let the poller thread die
                logger.error("Config poll failed: %s", e)
            self._sleep_interval()

    def _sleep_interval(self) -> None:
        slept = 0.0
        while slept < self.interval_s and not self._stop:
            time.sleep(min(_STOP_TICK, self.interval_s - slept))
            slept += _STOP_TICK

    def _poll_once(self) -> None:
        headers = {"If-None-Match": self._last_etag} if self._last_etag else {}
        resp = requests.get(self.url, headers=headers, timeout=POLL_TIMEOUT_S)
        if resp.status_code == 304:
            return
        resp.raise_for_status()

        etag = resp.headers.get("ETag")
        remote = self._parse(resp.json())

        if remote.is_empty():
            # Treat an empty payload as a no-op so a momentarily empty/misconfigured
            # backend never wipes the active rules. Record the etag so we don't
            # re-fetch the same empty body every tick.
            logger.warning("Backend returned an empty detector config; keeping last-good config")
            with self._lock:
                self._last_etag = etag
            return

        with self._lock:
            self._pending_actions = remote.action_classes
            self._pending_scene = (remote.scene_config,)
            self._last_etag = etag

        zone_count = 0 if remote.scene_config is None else len(remote.scene_config.zones)
        logger.info(
            "Fetched detector config: %d action classes, %d zones",
            len(remote.action_classes),
            zone_count,
        )

    # ----- parsing -------------------------------------------------------

    def _parse(self, data: dict) -> RemoteConfig:
        scene_config = self._parse_scene(data)
        action_classes = self._parse_action_classes(data)

        # Derive synthetic action classes so a defined zone auto-triggers a
        # recording on entry (and crowd, if ever configured), kept in the same
        # list so they swap in atomically with the rule-derived classes.
        if scene_config is not None:
            if scene_config.zones:
                action_classes.append((_ZONE_ACTION_NAME, {"forbidden_zone": 1}))
            if scene_config.crowd is not None:
                action_classes.append((_CROWD_ACTION_NAME, {"crowd": scene_config.crowd.min_people}))

        return RemoteConfig(action_classes, scene_config)

    def _parse_action_classes(self, data: dict) -> list[ActionSpec]:
        result: list[ActionSpec] = []
        for ac in data.get("action_classes", []):
            name = ac.get("name", "unknown")
            thresholds: dict[str, int] = {}
            for element, count in (ac.get("thresholds") or {}).items():
                key = _ELEMENT_ALIAS.get(element, element)
                if key in _DETECTOR_VOCAB:
                    thresholds[key] = int(count)
                else:
                    logger.warning("Dropping unsupported element '%s' in action class '%s'", element, name)
            for warning in ac.get("warnings", []):
                logger.warning("Action class '%s': %s", name, warning)
            if thresholds:
                result.append((name, thresholds))
            else:
                logger.warning("Action class '%s' has no usable thresholds; skipping", name)
        return result

    def _parse_scene(self, data: dict) -> SceneConfig | None:
        zones_raw = data.get("zones") or []
        crowd_raw = data.get("crowd")

        if self.frame_size is None:
            if zones_raw or crowd_raw:
                logger.warning("Received zones/crowd but source frame size is unknown; ignoring them")
            return None

        width, height = self.frame_size
        zones: list[Zone] = []
        for z in zones_raw:
            points = z.get("points") or []
            if len(points) < 3:
                logger.warning("Zone '%s' has fewer than 3 points; skipping", z.get("name"))
                continue
            pixel_points = [
                (round(nx * (width - 1)), round(ny * (height - 1))) for nx, ny in points
            ]
            zones.append(Zone(name=z.get("name", "zone"), policy="forbidden", points=pixel_points))

        crowd = None
        if crowd_raw:
            crowd = CrowdCfg(
                min_people=int(crowd_raw["min_people"]),
                radius_px=float(crowd_raw["radius_px"]),
            )

        if not zones and crowd is None:
            return None
        return SceneConfig(source="backend", frame_size=(width, height), zones=zones, crowd=crowd)
