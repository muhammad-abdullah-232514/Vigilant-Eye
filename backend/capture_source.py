"""
Camera source layer: webcam index / video file / RTSP URL -> opened cv2.VideoCapture.

Master Data `stream_url` formats:
  webcam:0 | webcam | 0          local camera (index); on macOS tries 0 then 1
  ai/samples/clip.mp4 | /abs.mp4 video file (loops)
  rtsp://user:pass@host:554/path  IP / CCTV camera (TCP transport, auto-reconnect)
  http(s)://...                   MJPEG / HLS streams OpenCV can read

open_capture() only returns once a real frame has been read, so "opened but
black / permission denied" cameras surface as a clear CaptureError.
"""

from __future__ import annotations

import os
import platform
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


def open_capture(stream_url: str) -> OpenedCapture:
    kind, source = classify_source(stream_url)

    if kind == "webcam":
        candidates = [int(source)]
        if int(source) == 0:
            candidates.append(1)  # MacBooks with an external / Continuity camera
        backend = cv2.CAP_AVFOUNDATION if IS_MAC else cv2.CAP_ANY
        for idx in candidates:
            cap = cv2.VideoCapture(idx, backend)
            if not cap.isOpened():
                cap.release()
                continue
            for prop, val in (
                (cv2.CAP_PROP_FRAME_WIDTH, 1280),
                (cv2.CAP_PROP_FRAME_HEIGHT, 720),
                (cv2.CAP_PROP_BUFFERSIZE, 1),
            ):
                cap.set(prop, val)
            frame = _read_first_frame(cap, FIRST_FRAME_TIMEOUT["webcam"])
            if frame is not None:
                return OpenedCapture(cap, kind, idx, frame, f"webcam:{idx}")
            cap.release()
        raise _webcam_error(candidates)

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
