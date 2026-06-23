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
import io
import av

from src.detector.vectors import FrameVector
from src.detector.timestamper import FullStampModel
from src.detector.config import Config
from src.detector import logger
from src.detector.anonymizer import Anonymizer

PAUSE_ON_ERROR = 1.0
UPLOAD_LOOP_PAUSE = 0.5
UPLOAD_WAIT = 1.0
SIZE_LOG_INTERVAL = 5.0  # co ile sekund logować rozmiary struktur (diagnostyka pamięci)


class RecState(Enum):
    AWAIT_UPLOAD = auto()
    UPLOADING = auto()
    SENT = auto()
    FAILED = auto()
    STASHED = auto()


@dataclass(frozen=True)
class SentClip:
    filename: str
    id: str


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


class ClipUploader:
    def __init__(self) -> None:
        self.anonymizer = Anonymizer()
        self.clip_folder = Path(Config.CLIP_FOLDER or "clips")
        
        self.upload_queue: deque[UploadTask] = deque()
        self.live_by_name: dict[str, UploadTask] = {} # lookup for upload queue
        self.task_history: dict[str, SentClip] = {}
        # TODO dodać obrabianie odłożonych nagrań
        self.davy_jones_locker: deque[UploadTask] = deque()
        
        self.upload_lock = threading.Lock()
        self.davy_jones_lock = threading.Lock()
        self.worker_thread = None
        self.stop_worker = False
        self._last_size_log = 0.0

        self._start_upload_worker()

    def __del__(self):
        """Cleanup worker thread on destruction"""
        self._stop_upload_worker()

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

    def _maybe_log_sizes(self):
        """Diagnostyka wycieku: okresowo loguje rozmiary kolejki, historii i stasha."""
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
            "Rozmiary uploadera: queue=%d, history=%d, davy_jones=%d",
            queue_len, history_len, stash_len,
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
        """Zwraca (gotowy_do_wysyłki, prev_id).

        Niezmiennik: prev_id != None TYLKO gdy poprzednik jest potwierdzony na
        backendzie (SENT). Nigdy nie zwracamy id klipu, którego tam nie ma.
        Wołać pod self.upload_lock (czyta live_by_name / task_history).
        """
        name = task.prev_filename
        # No dependency, head
        if name is None:
            return True, None

        sent = self.task_history.get(name)
        # Dependency is sent, return backend ID
        if sent is not None:
            return True, sent.id

        # Dependency is still being processed, return false and wait
        if name in self.live_by_name:
            return False, None

        # Dependency exists but nowhere to be found (stashed). Behave like head
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
                # Since task is sent, pop it from live dict,  
                # add it to task history and remove it from upload queue
                self.live_by_name.pop(task.filename, None)
                self.task_history[task.filename] = SentClip(task.filename, task.id)  # type: ignore[arg-type]
                if task in self.upload_queue:
                    self.upload_queue.remove(task)
                logger.info("Czyszczenie po upload")

        except Exception as e:
            logger.error(f"Failed to upload clip '{task.filename}': {e}", exc_info=True)

            task.retries -= 1

            if task.retries <= 0:
                with self.upload_lock:
                    self.live_by_name.pop(task.filename, None)
                    if task in self.upload_queue:
                        self.upload_queue.remove(task)

                with self.davy_jones_lock:
                    task.state = RecState.STASHED
                    self.davy_jones_locker.append(task)
            else:
                task.next_try_at = time.time() + UPLOAD_WAIT
                task.state = RecState.AWAIT_UPLOAD

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

        data = {
            "video-name": filename,
            "description": "DESCRIPTION",
            "relative-path": filename,
        }

        if prev_id:
            data["continuation-of"] = prev_id

        buffer = io.BytesIO()
        
        container = av.open(buffer, mode='w', format='mp4')
        stream = container.add_stream('libx264', rate=int(Config.FRAME_RATE))
        
        first_frame = clip[0]['frame']
        height, width, _ = first_frame.shape
        stream.width = width
        stream.height = height
        stream.pix_fmt = 'yuv420p'
        frames = self.anonymizer.anonymize_clip(clip)
        for frame_data in frames:
            img_array = frame_data
            frame = av.VideoFrame.from_ndarray(img_array, format='bgr24')
            for packet in stream.encode(frame):
                container.mux(packet)
        
        for packet in stream.encode():
            container.mux(packet)
            
        container.close()
        
        video_bytes = buffer.getvalue()
        file_size_mb = len(video_bytes) / (1024 * 1024)
        
        logger.info(f"Uploading video: {filename} (Size: {file_size_mb:.2f} MB)")

        files: dict[str, Any] = {
            "file": (filename, video_bytes, "video/mp4"),
            "details": (None, json.dumps(details), "application/json"),
        }
        
        response = requests.post(Config.BACKEND_UPLOAD_URL, data=data, files=files, timeout=15)
        response.raise_for_status()

        res_id = response.text
        
        task.state = RecState.SENT
        task.id = res_id