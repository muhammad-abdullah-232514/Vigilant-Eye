"""
In-process live camera sessions for Phase C1.

Supports:
  - webcam:0 / 0  (local camera)
  - file paths    (demo clips)
  - rtsp://...    (IP cameras; browser cannot play RTSP directly)

Optional YOLO overlay + confirmed detection persistence (streak + cooldown).
"""

from __future__ import annotations

import sys
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AI_DIR = ROOT / "ai"
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from ufm_classes import (  # noqa: E402
    is_ufm_watchlist,
    normalize_label,
    resolve_weights,
    to_violation_type,
)


def resolve_capture_source(stream_url: str) -> int | str:
    """Map DB stream_url to OpenCV VideoCapture argument."""
    raw = (stream_url or "").strip()
    if not raw:
        raise ValueError("Empty stream_url")

    lower = raw.lower()
    if lower in ("webcam", "cam", "local"):
        return 0
    if lower.startswith("webcam:"):
        return int(lower.split(":", 1)[1])
    if raw.isdigit():
        return int(raw)

    path = Path(raw)
    if path.is_file():
        return str(path.resolve())

    # Relative to project root (common when API runs from backend/)
    rooted = ROOT / raw
    if rooted.is_file():
        return str(rooted.resolve())

    alt = ROOT / "ai" / "samples" / Path(raw).name
    if alt.is_file():
        return str(alt.resolve())

    return raw


@dataclass
class LiveDetectionEvent:
    label: str
    confidence: float
    frame_index: int
    timestamp: str
    persisted_id: int | None = None


@dataclass
class CameraSession:
    camera_pk: int
    camera_code: str
    name: str
    stream_url: str
    detect: bool = False
    persist: bool = False
    conf: float = 0.35
    min_frames: int = 3
    persist_cooldown_sec: float = 60.0
    stop_event: threading.Event = field(default_factory=threading.Event)
    thread: threading.Thread | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)
    latest_jpeg: bytes | None = None
    latest_labels: list[dict[str, Any]] = field(default_factory=list)
    recent_events: list[LiveDetectionEvent] = field(default_factory=list)
    frame_index: int = 0
    error: str | None = None
    running: bool = False
    weights_mode: str = "coco"
    opened_source: str = ""


class LiveStreamManager:
    """Process-wide registry of active camera sessions."""

    def __init__(self) -> None:
        self._sessions: dict[int, CameraSession] = {}
        self._lock = threading.Lock()
        self._model = None
        self._model_path: str | None = None
        self._model_mode: str = "coco"
        self._model_lock = threading.Lock()

    def status(self) -> dict[str, Any]:
        with self._lock:
            sessions = []
            for s in self._sessions.values():
                sessions.append(
                    {
                        "camera_id": s.camera_pk,
                        "camera_code": s.camera_code,
                        "name": s.name,
                        "stream_url": s.stream_url,
                        "opened_source": s.opened_source,
                        "running": s.running,
                        "detect": s.detect,
                        "persist": s.persist,
                        "weights_mode": s.weights_mode,
                        "frame_index": s.frame_index,
                        "error": s.error,
                        "latest_labels": list(s.latest_labels),
                        "recent_events": [
                            {
                                "label": e.label,
                                "confidence": e.confidence,
                                "frame_index": e.frame_index,
                                "timestamp": e.timestamp,
                                "persisted_id": e.persisted_id,
                            }
                            for e in s.recent_events[-10:]
                        ],
                    }
                )
            return {
                "active_sessions": len(sessions),
                "weights_mode": self._model_mode if self._model is not None else None,
                "sessions": sessions,
            }

    def get_session(self, camera_pk: int) -> CameraSession | None:
        with self._lock:
            return self._sessions.get(camera_pk)

    def start(
        self,
        *,
        camera_pk: int,
        camera_code: str,
        name: str,
        stream_url: str,
        detect: bool = True,
        persist: bool = False,
        conf: float = 0.35,
        min_frames: int = 3,
        source_override: str | None = None,
    ) -> CameraSession:
        self.stop(camera_pk)

        url = (source_override or stream_url).strip()
        session = CameraSession(
            camera_pk=camera_pk,
            camera_code=camera_code,
            name=name,
            stream_url=url,
            detect=detect,
            persist=persist,
            conf=conf,
            min_frames=min_frames,
        )

        if detect:
            mode = self._ensure_model()
            session.weights_mode = mode

        thread = threading.Thread(
            target=self._run_loop,
            args=(session,),
            name=f"live-cam-{camera_pk}",
            daemon=True,
        )
        session.thread = thread

        with self._lock:
            self._sessions[camera_pk] = session

        thread.start()
        # Brief wait so open errors surface quickly
        time.sleep(0.4)
        return session

    def stop(self, camera_pk: int) -> bool:
        with self._lock:
            session = self._sessions.pop(camera_pk, None)
        if session is None:
            return False
        session.stop_event.set()
        if session.thread and session.thread.is_alive():
            session.thread.join(timeout=3.0)
        session.running = False
        return True

    def stop_all(self) -> None:
        with self._lock:
            ids = list(self._sessions.keys())
        for camera_pk in ids:
            self.stop(camera_pk)

    def get_jpeg(self, camera_pk: int) -> bytes | None:
        session = self.get_session(camera_pk)
        if session is None:
            return None
        with session.lock:
            return session.latest_jpeg

    def _ensure_model(self) -> str:
        with self._model_lock:
            if self._model is not None:
                return self._model_mode
            from ultralytics import YOLO

            weights, mode = resolve_weights(None)
            self._model = YOLO(str(weights))
            self._model_path = str(weights)
            self._model_mode = mode
            return mode

    def _run_loop(self, session: CameraSession) -> None:
        try:
            source = resolve_capture_source(session.stream_url)
            session.opened_source = str(source)
            cap = cv2.VideoCapture(source)
            if not cap.isOpened():
                session.error = f"Could not open source: {session.stream_url}"
                session.running = False
                return

            session.running = True
            session.error = None
            streaks: dict[str, int] = defaultdict(int)
            last_persist_at: dict[str, float] = {}
            is_file = isinstance(source, str) and Path(source).is_file()

            while not session.stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    if is_file:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    time.sleep(0.05)
                    continue

                labels: list[dict[str, Any]] = []
                draw = frame

                if session.detect:
                    draw, labels = self._detect_frame(frame, session.conf)
                    active = {item["label"] for item in labels}
                    conf_by_label = {item["label"]: item["confidence"] for item in labels}

                    for label in list(streaks.keys()):
                        if label not in active:
                            streaks[label] = 0

                    now = time.monotonic()
                    for label, conf_v in conf_by_label.items():
                        streaks[label] += 1
                        if streaks[label] < session.min_frames:
                            continue
                        if not is_ufm_watchlist(label):
                            continue
                        last = last_persist_at.get(label, 0.0)
                        if now - last < session.persist_cooldown_sec:
                            continue
                        last_persist_at[label] = now
                        event = LiveDetectionEvent(
                            label=label,
                            confidence=conf_v,
                            frame_index=session.frame_index,
                            timestamp=datetime.now(timezone.utc)
                            .replace(tzinfo=None)
                            .isoformat(timespec="seconds"),
                        )
                        if session.persist:
                            event.persisted_id = self._persist_detection(
                                session, label, conf_v
                            )
                        with session.lock:
                            session.recent_events.append(event)
                            if len(session.recent_events) > 50:
                                session.recent_events = session.recent_events[-50:]

                ok_jpg, buf = cv2.imencode(
                    ".jpg", draw, [int(cv2.IMWRITE_JPEG_QUALITY), 75]
                )
                if ok_jpg:
                    with session.lock:
                        session.latest_jpeg = buf.tobytes()
                        session.latest_labels = labels
                        session.frame_index += 1

                # Cap roughly ~12 FPS for MJPEG load
                time.sleep(0.08)

            cap.release()
        except Exception as exc:  # noqa: BLE001 — surface to UI
            session.error = str(exc)
        finally:
            session.running = False

    def _detect_frame(
        self, frame: np.ndarray, conf: float
    ) -> tuple[np.ndarray, list[dict[str, Any]]]:
        self._ensure_model()
        assert self._model is not None
        result = self._model.predict(frame, conf=conf, verbose=False)[0]
        names = result.names
        labels: list[dict[str, Any]] = []
        draw = frame.copy()

        if result.boxes is None:
            return draw, labels

        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            score = float(box.conf[0].item())
            raw = names.get(cls_id, str(cls_id))
            label = normalize_label(raw)
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            color = (40, 180, 80) if is_ufm_watchlist(label) else (180, 180, 40)
            cv2.rectangle(draw, (x1, y1), (x2, y2), color, 2)
            caption = f"{label} {score:.2f}"
            cv2.putText(
                draw,
                caption,
                (x1, max(18, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                1,
                cv2.LINE_AA,
            )
            labels.append(
                {
                    "label": label,
                    "confidence": round(score, 3),
                    "violation_type": to_violation_type(label),
                    "watchlist": is_ufm_watchlist(label),
                }
            )
        return draw, labels

    def _persist_detection(
        self, session: CameraSession, label: str, confidence: float
    ) -> int | None:
        try:
            from database import SessionLocal
            from detection_bridge import notify_detection_alert
            from models.detection import Detection

            db = SessionLocal()
            try:
                row = Detection(
                    camera_id=session.camera_pk,
                    student_id=None,
                    detection_type=label,
                    confidence=confidence,
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
                    is_confirmed=True,
                    source_path=f"live:{session.camera_code}",
                    frame_index=session.frame_index,
                )
                db.add(row)
                db.flush()
                notify_detection_alert(db, row)
                db.commit()
                return int(row.id)
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            return None


live_manager = LiveStreamManager()
