import numpy as np

from src.detector.config import Config, TARGET_FPS
from src.detector.sources import (
    RTSPSource,
    VideoFileSource,
    USBCameraSource,
    ImageFolderSource,
    SingleImageSource,
    FPSResampledSource,
)
from src.detector.detector import Detector
from src.tools.fps_estimator import FPS_estimator
from src.detector.recorder import Recorder
from src.detector.config_sync import ConfigPoller

from src.detector.utils.mylogger import setup_logging
from src.detector import logger

TEMPORAL_MODES = {'VIDEO', 'USB', 'RTSP'}


def start_config_poller(source) -> ConfigPoller | None:
    if not (Config.CONFIG_POLL_ENABLED and Config.BACKEND_CONFIG_URL):
        return None
    try:
        frame_size = source.get_frame_size()
    except Exception as e:
        logger.warning(f"Could not determine source frame size ({e}); forbidden zones disabled")
        frame_size = None
    poller = ConfigPoller(Config.BACKEND_CONFIG_URL, Config.CONFIG_POLL_INTERVAL_S, frame_size)
    poller.start()
    return poller


def apply_pending_config(recorder: Recorder, detector: Detector, poller: ConfigPoller) -> None:
    # Scene/zone config is safe to swap any time; action classes only when the
    # recorder is quiescent so an in-progress recording is never corrupted.
    scene = poller.take_pending_scene()
    if scene is not None:
        detector.set_scene(scene[0])
    if recorder.can_swap_actions():
        specs = poller.take_pending_actions()
        if specs is not None:
            recorder.set_action_classes(specs)
            logger.info("Applied %d action classes from backend", len(specs))

def get_source():
    if Config.APP_MODE == 'VIDEO': return VideoFileSource(Config.SOURCE_PATH)
    elif Config.APP_MODE == 'USB': return USBCameraSource(Config.SOURCE_PATH)
    elif Config.APP_MODE == 'FOLDER': return ImageFolderSource(Config.SOURCE_PATH)
    elif Config.APP_MODE == 'IMAGE': return SingleImageSource(Config.SOURCE_PATH)
    elif Config.APP_MODE == 'RTSP': return RTSPSource(Config.get_rtsp_url())
    else: raise ValueError(f"Unknown mode: {Config.APP_MODE}")

def main():
    logger.info(f"MODE: {Config.APP_MODE} | SOURCE: {Config.SOURCE_PATH} | BATCH SIZE: {Config.BATCH_SIZE}")

    setup_logging()

    source = get_source()
    if Config.APP_MODE in TEMPORAL_MODES:
        source = FPSResampledSource(source, TARGET_FPS)
    Config.FRAME_RATE = source.get_frame_rate()
    detector = Detector()
    recorder = Recorder(2, 2, 6)
    poller = start_config_poller(source)

    # When live config polling is the source of truth, the backend is
    # authoritative: the CSV action vectors are ignored entirely (no offline
    # fallback). Until the first successful poll lands, the recorder runs with an
    # empty action set and detects nothing.
    if poller is not None:
        logger.info("Config polling enabled — ignoring CSV action vectors (%s)", Config.ACTION_VECTORS_PATH)
    else:
        recorder.load_action_classes(Config.ACTION_VECTORS_PATH)  # offline fallback
        logger.info("Vectors:")
        for ac in recorder.action_classes:
            logger.info(ac.action_vector)

    batch: list[np.ndarray] = []
    fps = FPS_estimator()
    fps.begin()
    try:
        while True:
            ret, frame = source.get_frame()
            if not ret:
                break
            batch.append(frame)
            if len(batch) == Config.BATCH_SIZE:
                vector_list = detector.process_batch(batch)
                for vector, frame in zip(vector_list, batch):
                    recorder.check_frame(frame, vector)
                    # print(vector)
                batch.clear()
                fps.end()
                fps.begin()
                if poller is not None:
                    apply_pending_config(recorder, detector, poller)

    except KeyboardInterrupt:
        logger.warning("Stopped by user")
    finally:
        if poller is not None:
            poller.stop()
        source.release()

if __name__ == "__main__":
    main()