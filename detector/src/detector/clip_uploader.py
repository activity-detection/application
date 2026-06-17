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


class RecState(Enum):
    AWAIT_UPLOAD = auto()
    UPLOADING = auto()
    SENT = auto()
    FAILED = auto()
    STASHED = auto()


@dataclass
class UploadTask:
    """Represents a clip upload task with dependencies"""
    # Zmiana: clip może być None, co pozwala zwolnić pamięć po wysłaniu
    clip: list[FrameVector] | None
    filename: str
    details: FullStampModel
    state: RecState
    id: str | None = None
    created_at: float | None = None
    retries: int = 5
    next_try_at: float | None = None
    
    # Zmiana: trzymamy tylko nazwy plików, aby uniknąć tworzenia łańcucha obiektów i wycieku pamięci
    dependency_filename: str | None = None  
    stashed_dependency_filename: str | None = None 

    def __post_init__(self):
        self.created_at = time.time()


class ClipUploader:
    def __init__(self) -> None:
        self.anonymizer = Anonymizer()
        self.clip_folder = Path(Config.CLIP_FOLDER or "clips")
        self.upload_queue: deque[UploadTask] = deque()
        self.upload_lock = threading.Lock()

        # Słownik pamiętający wszystkie zadania (nawet te wysłane)
        self.task_history: dict[str, UploadTask] = {}

        # Zmiana: maxlen zapobiega nieskończonemu pożeraniu pamięci przez martwe zadania
        self.davy_jones_locker: deque[UploadTask] = deque(maxlen=20)
        self.davy_jones_lock = threading.Lock()
        
        self.worker_thread = None
        self.stop_worker = False

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

    def _upload_worker_loop(self):
        while not self.stop_worker:
            try:
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
        if task.next_try_at is not None:
            if time.time() < task.next_try_at:
                return False

        # Check if dependency is satisfied
        if self._is_dependency_satisfied(task):
            return True

        return False

    def _is_dependency_satisfied(self, task: UploadTask) -> bool:
        """Check if the dependency recording has been uploaded and has an ID
            Also stash the dependency if needed"""
        
        if task.dependency_filename is None:
            return True

        # Pobieramy stan poprzednika z historii po nazwie pliku
        dependency_task = self.task_history.get(task.dependency_filename)

        # Zabezpieczenie: jeśli poprzednik został usunięty z historii, puszczamy to zadanie,
        # aby zablokowana zależność nie zatrzymała przetwarzania na zawsze.
        if dependency_task is None:
            logger.warning(f"Dependency {task.dependency_filename} not found in history. Releasing constraint.")
            return True

        # Jeśli zależność trafiła do stasha, odpinamy ją i pozwalamy na wysyłkę bez id
        if dependency_task.state == RecState.STASHED:
            task.stashed_dependency_filename = task.dependency_filename
            task.dependency_filename = None
            return True

        # Zwracamy True tylko wtedy, kiedy poprzednik dostał już ID z backendu
        if dependency_task.state == RecState.SENT and dependency_task.id is not None:
            return True

        return False

    def _process_upload_task(self, task: UploadTask):
        """Process a single upload task"""
        try:
            # Get the previous recording ID if dependency is satisfied
            prev_id = None
            if task.dependency_filename is not None:
                dependency_task = self.task_history.get(task.dependency_filename)
                if dependency_task:
                    prev_id = dependency_task.id

            # Mark as uploading
            task.state = RecState.UPLOADING

            # Upload the clip
            self._upload_clip(
                task=task,
                details=task.details,
                prev_id=prev_id
            )

            # ZWALNIANIE PAMIĘCI: Usuwamy listę klatek zaraz po udanym wysłaniu.
            # Zadanie zostaje w task_history z samym metadanymi.
            task.clip = None

            with self.upload_lock:
                if task in self.upload_queue:
                    self.upload_queue.remove(task)

        except Exception as e:
            logger.error(f"Failed to upload clip '{task.filename}': {e}", exc_info=True)

            task.dependency_filename = task.stashed_dependency_filename
            task.stashed_dependency_filename = None
            task.retries -= 1

            if task.retries <= 0:
                with self.upload_lock:
                    if task in self.upload_queue:
                        self.upload_queue.remove(task)
                
                with self.davy_jones_lock:
                    task.state = RecState.STASHED
                    self.davy_jones_locker.append(task)

            task.next_try_at = time.time() + UPLOAD_WAIT
            task.state = RecState.AWAIT_UPLOAD
    
    def start_upload(
            self,
            clip: list[FrameVector],
            filename: str,
            details: FullStampModel,
            dependency_filename: str | None,
    ) -> None:
        
        with self.upload_lock:
            task = UploadTask(
                clip=clip,
                filename=filename,
                details=details,
                state=RecState.AWAIT_UPLOAD,
                dependency_filename=dependency_filename
            )
        
            # Dodajemy zadanie do aktywnej kolejki i do rejestru historycznego
            self.upload_queue.append(task)
            self.task_history[filename] = task
            
            # Zabezpieczenie przed rozrostem słownika - usunięcie najstarszego wpisu
            if len(self.task_history) > 100:
                oldest_key = next(iter(self.task_history))
                del self.task_history[oldest_key]

    def _upload_clip(
            self,
            task: UploadTask,
            details: FullStampModel,
            prev_id: str | None = None,
    ) -> None:
        clip = task.clip
        filename = task.filename

        if not clip:
            raise ValueError("Clip is empty or already released, nothing to upload.")

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