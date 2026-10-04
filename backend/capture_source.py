"""
Camera source layer: webcam index / video file / RTSP URL -> opened cv2.VideoCapture.

Master Data `stream_url` formats:
  webcam:0 | webcam | 0          local camera (index); falls back to 0, 1, 2. Several
                                  cameras may share one physical webcam (one reader).
  ai/samples/clip.mp4 | /abs.mp4 video file (loops)
  rtsp://user:pass@host:554/path  IP / CCTV camera (TCP transport, auto-reconnect)
  http(s)://...                   MJPEG / HLS streams OpenCV can read

open_capture() only returns once a real frame has been read, so "opened but
black / permission denied" cameras surface as a clear CaptureError.
"""

from __future__ import annotations

import os
import platform
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
IS_MAC = platform.system() == "Darwin"
IN_DOCKER = Path("/.dockerenv").exists()

# RTSP over TCP is far more reliable than UDP through NAT / Wi-Fi; 5 s socket timeout.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|stimeout;5000000")

FIRST_FRAME_TIMEOUT = {"webcam": 6.0, "rtsp": 12.0, "stream": 12.0, "file": 3.0}


class CaptureError(RuntimeError):
    """Camera/source could not deliver frames; message is shown in the portal."""


@dataclass
class OpenedCapture:
    cap: cv2.VideoCapture
    kind: str  # webcam | file | rtsp | stream
    source: int | str
    first_frame: np.ndarray
    description: str


def classify_source(stream_url: str) -> tuple[str, int | str]:
    """Return (kind, cv2 argument) for a Master Data stream_url."""
    raw = (stream_url or "").strip()
    if not raw:
        raise CaptureError("Camera has no stream URL configured in Master Data.")
    lower = raw.lower()
    if lower in ("webcam", "cam", "local"):
        return "webcam", 0
    if lower.startswith(("webcam:", "cam:")):
        try:
            return "webcam", int(lower.split(":", 1)[1])
        except ValueError as exc:
            raise CaptureError(f"Invalid webcam index in '{raw}' (use webcam:0).") from exc
    if raw.isdigit():
        return "webcam", int(raw)
    if lower.startswith(("rtsp://", "rtsps://")):
        return "rtsp", raw
    if lower.startswith(("http://", "https://")):
        return "stream", raw
    for cand in (Path(raw), ROOT / raw, ROOT / "ai" / "samples" / Path(raw).name):
        if cand.is_file():
            return "file", str(cand.resolve())
    raise CaptureError(f"Video file not found: {raw}")


def redact(url: str) -> str:
    """Hide credentials in rtsp://user:pass@host/..."""
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        return f"{scheme}://***@{rest.split('@', 1)[1]}"
    return url


def _read_first_frame(cap: cv2.VideoCapture, timeout: float) -> np.ndarray | None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        ok, frame = cap.read()
        # Some Mac cameras return a few all-black frames while warming up
        if ok and frame is not None and frame.size and float(frame.mean()) > 1.0:
            return frame
        time.sleep(0.05)
    return None


def _webcam_error(tried: list[int]) -> CaptureError:
    idx = ", ".join(str(i) for i in tried)
    if IN_DOCKER:
        return CaptureError(
            f"No webcam available inside Docker (tried index {idx}). Docker Desktop on "
            "macOS/Windows cannot access the laptop camera — run the API natively "
            "(macOS: ./scripts/start-mac.sh) or use a sample clip / RTSP URL."
        )
    if IS_MAC:
        return CaptureError(
            f"Could not read frames from the Mac camera (tried index {idx}). macOS may be "
            "blocking camera access: System Settings → Privacy & Security → Camera → allow "
            "the app that started the API (Terminal / iTerm / VS Code), then restart the "
            "API. Also close other apps using the camera (FaceTime, Zoom, Photo Booth)."
        )
    return CaptureError(
        f"No webcam detected (tried index {idx}). Check the camera is connected and not in "
        "use by another app, or configure a sample clip / RTSP URL in Master Data."
    )


class _SharedWebcam:
    """
    One physical camera, many readers.

    A camera device can only be opened once reliably (macOS AVFoundation in
    particular), but several Master Data cameras may point at the same webcam
    (e.g. two monitoring sessions on one laptop). A single reader thread owns
    the device and every session gets the latest frame.
    """

    def __init__(self, index: int, cap: cv2.VideoCapture, first: np.ndarray) -> None:
        self.index = index
        self._cap = cap
        self._frame = first
        self._seq = 1
        self._refs = 0
        self._cond = threading.Condition()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name=f"webcam-{index}", daemon=True)
        self._thread.start()

    def _loop(self) -> None:
        fails = 0
        while not self._stop.is_set():
            ok, frame = self._cap.read()
            if not ok or frame is None:
                fails += 1
                time.sleep(0.02 if fails < 50 else 0.2)
                continue
            fails = 0
            with self._cond:
                self._frame, self._seq = frame, self._seq + 1
                self._cond.notify_all()
        self._cap.release()

    def read(self, last_seq: int, timeout: float = 1.0) -> tuple[bool, np.ndarray | None, int]:
        with self._cond:
            if self._seq == last_seq:
                self._cond.wait(timeout)
            if self._seq == last_seq:
                return False, None, last_seq
            return True, self._frame.copy(), self._seq

    def acquire(self) -> None:
        with _WEBCAMS_LOCK:
            self._refs += 1

    def release(self) -> None:
        with _WEBCAMS_LOCK:
            self._refs -= 1
            if self._refs > 0:
                return
            _WEBCAMS.pop(self.index, None)
        self._stop.set()


class SharedWebcamHandle:
    """cv2.VideoCapture-like view of a shared webcam (read / release / isOpened / set)."""

    def __init__(self, cam: _SharedWebcam) -> None:
        self._cam = cam
        self._seq = 0
        self._open = True
        cam.acquire()

    def read(self) -> tuple[bool, np.ndarray | None]:
        if not self._open:
            return False, None
        ok, frame, self._seq = self._cam.read(self._seq)
        return ok, frame

    def isOpened(self) -> bool:  # noqa: N802 — cv2 API
        return self._open

    def set(self, *_args) -> bool:
        return False

    def release(self) -> None:
        if self._open:
            self._open = False
            self._cam.release()


_WEBCAMS: dict[int, _SharedWebcam] = {}
_WEBCAMS_LOCK = threading.RLock()


def _open_webcam_device(idx: int) -> tuple[cv2.VideoCapture, np.ndarray] | None:
    backend = cv2.CAP_AVFOUNDATION if IS_MAC else cv2.CAP_ANY
    cap = cv2.VideoCapture(idx, backend)
    if not cap.isOpened():
        cap.release()
        return None
    for prop, val in (
        (cv2.CAP_PROP_FRAME_WIDTH, 1280),
        (cv2.CAP_PROP_FRAME_HEIGHT, 720),
        (cv2.CAP_PROP_BUFFERSIZE, 1),
    ):
        cap.set(prop, val)
    frame = _read_first_frame(cap, FIRST_FRAME_TIMEOUT["webcam"])
    if frame is None:
        cap.release()
        return None
    return cap, frame


def list_webcams(max_index: int = 4) -> list[int]:
    """Indexes of cameras that currently deliver frames (shared ones count as available)."""
    found = []
    for idx in range(max_index):
        with _WEBCAMS_LOCK:
            if idx in _WEBCAMS:
                found.append(idx)
                continue
        opened = _open_webcam_device(idx)
        if opened:
            opened[0].release()
            found.append(idx)
    return found


def _open_shared_webcam(requested: int) -> OpenedCapture:
    # Try the requested index first, then indexes 0, 1, 2 (built-in / USB / Continuity)
    candidates = [requested] + [i for i in (0, 1, 2) if i != requested]
    for idx in candidates:
        with _WEBCAMS_LOCK:
            cam = _WEBCAMS.get(idx)
            if cam is None:
                opened = _open_webcam_device(idx)
                if opened is None:
                    continue
                cam = _SharedWebcam(idx, *opened)
                _WEBCAMS[idx] = cam
            handle = SharedWebcamHandle(cam)
        ok, frame = handle.read()
        if ok:
            note = "" if idx == requested else f" (webcam:{requested} unavailable, using webcam:{idx})"
            return OpenedCapture(handle, "webcam", idx, frame, f"webcam:{idx}{note}")
        handle.release()
    raise _webcam_error(candidates)


def open_capture(stream_url: str) -> OpenedCapture:
    kind, source = classify_source(stream_url)

    if kind == "webcam":
        return _open_shared_webcam(int(source))

    if kind in ("rtsp", "stream"):
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap.release()
            raise CaptureError(
                f"Could not connect to {redact(str(source))}. Check the camera IP/port, "
                "path and credentials, and that this server can reach the camera network."
            )
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        frame = _read_first_frame(cap, FIRST_FRAME_TIMEOUT[kind])
        if frame is None:
            cap.release()
            raise CaptureError(f"Connected to {redact(str(source))} but no video frames arrived.")
        return OpenedCapture(cap, kind, source, frame, redact(str(source)))

    cap = cv2.VideoCapture(source)
    frame = _read_first_frame(cap, FIRST_FRAME_TIMEOUT["file"]) if cap.isOpened() else None
    if frame is None:
        cap.release()
        raise CaptureError(f"Could not decode video file: {Path(str(source)).name}")
    return OpenedCapture(cap, kind, source, frame, Path(str(source)).name)
