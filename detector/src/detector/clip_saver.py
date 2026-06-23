from pathlib import Path
import io

import av

from src.detector.anonymizer import Anonymizer
from src.detector.vectors import FrameVector
from src.detector.config import Config
from src.detector import logger


class ClipSaver:
    """Turns a clip (list[FrameVector]) into anonymized MP4 output.

    Single owner of the clip -> video encoding: `to_bytes` produces an in-memory
    MP4 for upload, `save` writes the same bytes to disk (stash / local copy)."""

    def __init__(self):
        self.anonymizer = Anonymizer()

    def to_bytes(self, clip: list[FrameVector]) -> bytes:
        """Anonymize and encode the clip to an in-memory MP4 (H.264)."""
        if not clip:
            raise ValueError("Clip is empty, nothing to encode.")

        frames = self.anonymizer.anonymize_clip(clip)

        buffer = io.BytesIO()
        container = av.open(buffer, mode="w", format="mp4")
        stream = container.add_stream("libx264", rate=int(Config.FRAME_RATE))

        height, width, _ = frames[0].shape
        stream.width = width
        stream.height = height
        stream.pix_fmt = "yuv420p"

        try:
            for frame_data in frames:
                frame = av.VideoFrame.from_ndarray(frame_data, format="bgr24")
                for packet in stream.encode(frame):
                    container.mux(packet)
            # Flush the encoder.
            for packet in stream.encode():
                container.mux(packet)
        finally:
            container.close()

        return buffer.getvalue()

    def save(self, clip: list[FrameVector], path: Path) -> None:
        """Encode the clip and write the resulting MP4 bytes to disk."""
        filename = path.name
        try:
            path.write_bytes(self.to_bytes(clip))
            logger.info(f"Successfully saved clip locally at {filename}")
        except Exception as e:
            logger.error(f"Failed to write video '{filename}' to disk: {e}", exc_info=True)
            raise
