from __future__ import annotations
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from enum import Enum, auto
import threading
import requests
import json
import time

from src.detector.timestamper import FullStampModel
from src.detector.clip_saver import ClipSaver
from src.detector.vectors import FrameVector
from src.detector.config import Config
from src.detector import logger


PAUSE_ON_ERROR = 1.0
UPLOAD_LOOP_PAUSE = 0.5
UPLOAD_WAIT = 1.0
SIZE_LOG_INTERVAL = 5.0  # how often to log struct sizes (memory diagnostics)
DAVY_JONES_LOOP_PAUSE = 10.0   # davy jones polled less frequently than the main queue
DAVY_JONES_RETRY_WAIT = 10.0   # backoff between resend attempts of a stashed clip
STASH_TTL = 120.0              # a stashed clip is permanently removed after 2 min
# A successor can reference a predecessor only within a bounded window: the
# recorder's continuation gap plus the predecessor staying alive while a stashed
# successor retries (up to STASH_TTL). Past that horizon no clip can link to it,
# so the history entry is evictable. Kept well above STASH_TTL for safety.
HISTORY_TTL = 180.0


class RecState(Enum):
    AWAIT_UPLOAD = auto()
    UPLOADING = auto()
    SENT = auto()
    FAILED = auto()
    STASHED = auto()


@dataclass(frozen=True)
class SentClip:
    """A confirmed, sent clip kept in history only to resolve a successor's link.

    `sent_at` drives TTL eviction (HISTORY_TTL): once no future clip can still
    reference it, the entry is dropped."""
    filename: str
    id: str
    sent_at: float


@dataclass
class UploadTask:
    """Represents a clip upload task with dependencies"""
    clip: list[FrameVector] | None
    filename: str
    details: FullStampModel | None
    state: RecState
    id: str | None = None
    created_at: float | None = None
    retries: int = 5
    next_try_at: float | None = None
    prev_filename: str | None = None

    def __post_init__(self):
        self.created_at = time.time()


@dataclass
class StashedClip:
    """A clip parked in davy jones — encoded on disk, only metadata kept in RAM.

    `prev_filename` keeps the logical link so the order can be reconstructed on
    resend (head before the rest). `stashed_at` drives the TTL (STASH_TTL)."""
    filename: str
    prev_filename: str | None
    details: FullStampModel | None
    video_path: Path
    stashed_at: float
    next_try_at: float | None = None


class ClipUploader:
    def __init__(self) -> None:
        self.clip_saver = ClipSaver()
        self.clip_folder = Path(Config.CLIP_FOLDER or "clips")
        self.stash_folder = self.clip_folder / "davy_jones"
        try:
            self.stash_folder.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.error(f"Cannot create stash folder {self.stash_folder}: {e}")

        self.upload_queue: deque[UploadTask] = deque()
        self.live_by_name: dict[str, UploadTask] = {} # lookup for upload queue
        self.task_history: dict[str, SentClip] = {}
        self.davy_jones_locker: deque[StashedClip] = deque()
        self.stashed_by_name: dict[str, StashedClip] = {} # lookup for replay ordering

        self.upload_lock = threading.Lock()
        self.davy_jones_lock = threading.Lock()
        self.worker_thread = None
        self.davy_jones_thread = None
        self.stop_worker = False
        self._last_size_log = 0.0

        self._start_upload_worker()
        self._start_davy_jones_worker()

    def __del__(self):
        """Cleanup worker threads on destruction"""
        self._stop_upload_worker()
        self._stop_davy_jones_worker()

    def _start_upload_worker(self):
        """Start the background upload worker thread"""
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self.stop_worker = False
            self.worker_thread = threading.Thread(target=self._upload_worker_loop, daemon=True)
            self.worker_thread.start()
            logger.info("Started upload worker thread")

    def _stop_upload_worker(self):
        """Stop the background upload worker thread"""
        if self.worker_thread and self.worker_thread.is_alive():
            self.stop_worker = True
            self.worker_thread.join(timeout=5.0)
            logger.info("Stopped upload worker thread")

    def _start_davy_jones_worker(self):
        """Start the background davy jones (retry-from-disk) worker thread"""
        if self.davy_jones_thread is None or not self.davy_jones_thread.is_alive():
            self.stop_worker = False
            self.davy_jones_thread = threading.Thread(target=self._davy_jones_worker_loop, daemon=True)
            self.davy_jones_thread.start()
            logger.info("Started davy jones worker thread")

    def _stop_davy_jones_worker(self):
        """Stop the background davy jones worker thread"""
        if self.davy_jones_thread and self.davy_jones_thread.is_alive():
            self.stop_worker = True
            self.davy_jones_thread.join(timeout=5.0)
            logger.info("Stopped davy jones worker thread")

    def _maybe_log_sizes(self):
        """Leak diagnostics: periodically log queue, history and stash sizes."""
        now = time.time()
        if now - self._last_size_log < SIZE_LOG_INTERVAL:
            return
        self._last_size_log = now
        with self.upload_lock:
            queue_len = len(self.upload_queue)
            history_len = len(self.task_history)
        with self.davy_jones_lock:
            stash_len = len(self.davy_jones_locker)
        logger.info(
            f"Uploader sizes: queue={queue_len}, history={history_len}, davy_jones={stash_len}"
        )

    def _upload_worker_loop(self):
        while not self.stop_worker:
            try:
                self._maybe_log_sizes()
                task_to_process = None

                with self.upload_lock:
                    for task in self.upload_queue:
                        if self._is_task_ready(task):
                            task_to_process = task
                            break 
                
                if task_to_process:
                    self._process_upload_task(task_to_process)
                else:
                    time.sleep(UPLOAD_LOOP_PAUSE)

            except Exception as e:
                logger.error(f"Error in upload worker: {e}", exc_info=True)
                time.sleep(PAUSE_ON_ERROR)

    def _is_task_ready(self, task: UploadTask) -> bool:
        """Check if a task is ready to upload"""
        if task.next_try_at is not None and time.time() < task.next_try_at:
            return False
        ready, _ = self._resolve_prev(task)
        return ready

    def _resolve_prev(self, task: UploadTask) -> tuple[bool, str | None]:
        """Return (ready_to_upload, prev_id).

        Invariant: prev_id != None ONLY when the predecessor is confirmed on the
        backend (SENT). We never return the id of a clip that isn't there.
        Call under self.upload_lock (reads live_by_name / task_history).
        """
        name = task.prev_filename
        # No predecessor, head
        if name is None:
            return True, None

        sent = self.task_history.get(name)
        # Predecessor is sent, return its backend ID for linking
        if sent is not None:
            return True, sent.id

        # Predecessor is still being processed, return false and wait
        if name in self.live_by_name:
            return False, None

        # Predecessor nowhere to be found (stashed). Behave like head
        return True, None
    
    def _process_upload_task(self, task: UploadTask):
        """Process a single upload task"""
        try:
            # Get prev_id. Might be None
            with self.upload_lock:
                _, prev_id = self._resolve_prev(task)

            task.state = RecState.UPLOADING

            self._upload_clip(
                task=task,
                details=task.details,
                prev_id=prev_id
            )

            with self.upload_lock:
                # Task is sent: drop it from the live dict, record a lightweight
                # history entry and remove it from the upload queue.
                self.live_by_name.pop(task.filename, None)
                self.task_history[task.filename] = SentClip(task.filename, task.id, time.time())  # type: ignore[arg-type]
                if task in self.upload_queue:
                    self.upload_queue.remove(task)
                # Predecessor will never be linked again
                self.task_history.pop(task.prev_filename, None)  # type: ignore[arg-type]
                logger.info(f"Cleanup after upload: {task.filename}")

        except Exception as e:
            logger.error(f"Failed to upload clip '{task.filename}': {e}", exc_info=True)

            task.retries -= 1

            if task.retries <= 0:
                with self.upload_lock:
                    self.live_by_name.pop(task.filename, None)
                    if task in self.upload_queue:
                        self.upload_queue.remove(task)
                self._stash_task(task)
            else:
                task.next_try_at = time.time() + UPLOAD_WAIT
                task.state = RecState.AWAIT_UPLOAD

    # ----- davy jones locker (disk-backed retry) -------------------------

    def _stash_task(self, task: UploadTask) -> None:
        """Flush the clip to disk (ClipSaver) and park a lightweight StashedClip
        in davy jones. Frames are not kept in RAM and only the file path survives."""
        if not task.clip:
            logger.error(f"Cannot stash '{task.filename}': clip is empty")
            return

        video_path = self.stash_folder / task.filename
        try:
            self.clip_saver.save(task.clip, video_path)
        except Exception as e:
            logger.error(f"Cannot stash '{task.filename}' to disk: {e}", exc_info=True)
            return

        stashed = StashedClip(
            filename=task.filename,
            prev_filename=task.prev_filename,
            details=task.details,
            video_path=video_path,
            stashed_at=time.time(),
        )
        with self.davy_jones_lock:
            self.davy_jones_locker.append(stashed)
            self.stashed_by_name[task.filename] = stashed
        logger.info(f"Stashed clip to disk: {video_path.name}")

    def _davy_jones_worker_loop(self) -> None:
        while not self.stop_worker:
            try:
                self._purge_expired_stashed()
                self._purge_expired_history()
                self._try_one_stashed()
            except Exception as e:
                logger.error(f"Error in davy jones worker: {e}", exc_info=True)
            time.sleep(DAVY_JONES_LOOP_PAUSE)

    def _purge_expired_history(self) -> None:
        """Evict history entries past HISTORY_TTL.

        Once a sent clip is older than the window in which any successor could
        still reference it, its id is no longer needed and the entry is dropped.
        TTL keeps history bounded regardless of load, without a fixed cap."""
        now = time.time()
        with self.upload_lock:
            expired = [
                name for name, sent in self.task_history.items()
                if now - sent.sent_at > HISTORY_TTL
            ]
            for name in expired:
                del self.task_history[name]
        if expired:
            logger.info(f"Evicted {len(expired)} expired history entries")

    def _try_one_stashed(self) -> None:
        """Pick one ready stashed clip (head before the rest) and resend it."""
        now = time.time()
        with self.davy_jones_lock:
            snapshot = list(self.davy_jones_locker)

        for stashed in snapshot:
            if stashed.next_try_at is not None and now < stashed.next_try_at:
                continue
            ready, prev_id = self._resolve_prev_stashed(stashed.prev_filename)
            if ready:
                self._process_stashed_clip(stashed, prev_id)
                return

    def _resolve_prev_stashed(self, name: str | None) -> tuple[bool, str | None]:
        """Like _resolve_prev, but an "in-flight" predecessor is another stashed clip.

        Same invariant: prev_id != None only when the predecessor is SENT."""
        # No predecessor, head
        if name is None:
            return True, None

        with self.upload_lock:
            sent = self.task_history.get(name)
        # Predecessor is sent, return its backend ID for linking
        if sent is not None:
            return True, sent.id

        with self.davy_jones_lock:
            pending = name in self.stashed_by_name
        # Predecessor is still being stashed, return false and wait    
        if pending:
            return False, None

        # Predecessor nowhere to be found. Behave like head
        return True, None

    def _process_stashed_clip(self, stashed: StashedClip, prev_id: str | None) -> None:
        try:
            video_bytes = stashed.video_path.read_bytes()
            size_mb = len(video_bytes) / (1024 * 1024)
            logger.info(f"Retrying stashed video: {stashed.filename} (Size: {size_mb:.2f} MB)")

            res_id = self._post_video(stashed.filename, video_bytes, stashed.details, prev_id)

            with self.upload_lock:
                self.task_history[stashed.filename] = SentClip(stashed.filename, res_id, time.time())
                # Eagerly evict the predecessor (1:1 chain); TTL is the backstop.
                self.task_history.pop(stashed.prev_filename, None)  # type: ignore[arg-type]
            with self.davy_jones_lock:
                self.stashed_by_name.pop(stashed.filename, None)
                if stashed in self.davy_jones_locker:
                    self.davy_jones_locker.remove(stashed)
            stashed.video_path.unlink(missing_ok=True)
            logger.info("Stashed clip resent and removed from disk: %s", stashed.filename)

        except Exception as e:
            logger.error(f"Failed to resend stashed clip '{stashed.filename}': {e}", exc_info=True)
            stashed.next_try_at = time.time() + DAVY_JONES_RETRY_WAIT

    def _purge_expired_stashed(self) -> None:
        """Permanently remove clips older than STASH_TTL (from disk and registries)."""
        now = time.time()
        expired: list[StashedClip] = []
        with self.davy_jones_lock:
            for stashed in list(self.davy_jones_locker):
                if now - stashed.stashed_at > STASH_TTL:
                    self.davy_jones_locker.remove(stashed)
                    self.stashed_by_name.pop(stashed.filename, None)
                    expired.append(stashed)
        for stashed in expired:
            stashed.video_path.unlink(missing_ok=True)
            logger.warning(
                f"Stashed clip expired (>{STASH_TTL:.0f}s) and permanently removed: {stashed.filename}"
            )

    def start_upload(
            self,
            clip: list[FrameVector],
            filename: str,
            details: FullStampModel,
            dependency_filename: str | None,
    ) -> None:
        task = UploadTask(
            clip=clip,
            filename=filename,
            details=details,
            state=RecState.AWAIT_UPLOAD,
            prev_filename=dependency_filename,
        )

        with self.upload_lock:
            self.upload_queue.append(task)
            self.live_by_name[filename] = task

    def _upload_clip(
            self,
            task: UploadTask,
            details: FullStampModel | None,
            prev_id: str | None = None,
    ) -> None:
        clip = task.clip
        filename = task.filename

        if not clip:
            raise ValueError("Clip is empty, nothing to upload.")

        video_bytes = self.clip_saver.to_bytes(clip)
        file_size_mb = len(video_bytes) / (1024 * 1024)

        logger.info(f"Uploading video: {filename} (Size: {file_size_mb:.2f} MB)")

        res_id = self._post_video(filename, video_bytes, details, prev_id)

        task.state = RecState.SENT
        task.id = res_id

    def _post_video(
            self,
            filename: str,
            video_bytes: bytes,
            details: FullStampModel | None,
            prev_id: str | None,
    ) -> str:
        """Send encoded MP4 bytes to the backend and return the assigned id.
        Shared by the main-queue upload and davy jones resends."""
        data = {
            "video-name": filename,
            # Detection vector name = filename without the "_DATE_TIME" suffix
            # added by ClipManager (e.g. "8 osób_20260623_085526.mp4" -> "8 osób").
            "description": Path(filename).stem.rsplit("_", 2)[0],
            "relative-path": filename,
        }
        if prev_id:
            data["continuation-of"] = prev_id

        files: dict[str, Any] = {
            "file": (filename, video_bytes, "video/mp4"),
            "details": (None, json.dumps(details), "application/json"),
        }

        response = requests.post(Config.BACKEND_UPLOAD_URL, data=data, files=files, timeout=15)
        response.raise_for_status()
        return response.text
