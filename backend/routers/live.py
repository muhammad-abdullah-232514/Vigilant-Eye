"""Phase C1 live monitoring API routes."""

from __future__ import annotations

import asyncio

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from deps import bearer_scheme, get_current_user, require_roles
from live_stream import live_manager
from models.camera import Camera
from models.user import User
from security import decode_access_token

router = APIRouter(prefix="/live", tags=["live"])

class LiveStartRequest(BaseModel):
    detect: bool = True
    persist: bool = False
    conf: float = Field(default=0.35, ge=0.05, le=0.95)
    min_frames: int = Field(default=3, ge=1, le=30)
    # Optional override: "webcam:0", file path, or RTSP (demo without changing DB)
    source_override: str | None = Field(default=None, max_length=512)


def _user_from_token(token: str, db: Session) -> User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_stream_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token: str | None = Query(default=None, description="JWT for <img> MJPEG"),
) -> User:
    """Allow Bearer header OR ?token= for browser <img src> streams."""
    raw = None
    if credentials is not None and credentials.credentials:
        raw = credentials.credentials
    elif token:
        raw = token
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _user_from_token(raw, db)


def _get_camera(db: Session, camera_id: int) -> Camera:
    cam = db.get(Camera, camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam


@router.get("/status")
def live_status(current_user: User = Depends(get_current_user)):
    _ = current_user
    return live_manager.status()


@router.post("/cameras/{camera_id}/start")
def start_live(
    camera_id: int,
    body: LiveStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("INVIGILATOR", "HOD", "EXAM_DEPARTMENT")
    ),
):
    _ = current_user
    cam = _get_camera(db, camera_id)
    session = live_manager.start(
        camera_pk=cam.id,
        camera_code=cam.camera_id,
        name=cam.name,
        stream_url=cam.stream_url,
        detect=body.detect,
        persist=body.persist,
        conf=body.conf,
        min_frames=body.min_frames,
        source_override=body.source_override,
    )
    if session.error and not session.running:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=session.error,
        )
    return {
        "ok": True,
        "camera_id": cam.id,
        "running": session.running,
        "detect": session.detect,
        "persist": session.persist,
        "weights_mode": session.weights_mode,
        "opened_source": session.opened_source,
        "error": session.error,
        "mjpeg_path": f"/live/cameras/{cam.id}/mjpeg",
    }


@router.post("/cameras/{camera_id}/stop")
def stop_live(
    camera_id: int,
    current_user: User = Depends(
        require_roles("INVIGILATOR", "HOD", "EXAM_DEPARTMENT")
    ),
):
    _ = current_user
    stopped = live_manager.stop(camera_id)
    return {"ok": True, "stopped": stopped, "camera_id": camera_id}


@router.get("/cameras/{camera_id}/snapshot")
def snapshot(
    camera_id: int,
    user: User = Depends(get_stream_user),
):
    _ = user
    session = live_manager.get_session(camera_id)
    if session is None or not session.running:
        raise HTTPException(
            status_code=404,
            detail="No active live session for this camera. Call /start first.",
        )
    jpeg = live_manager.get_jpeg(camera_id)
    if not jpeg:
        raise HTTPException(status_code=503, detail="No frame available yet")
    return Response(content=jpeg, media_type="image/jpeg")


@router.get("/cameras/{camera_id}/mjpeg")
async def mjpeg_stream(
    camera_id: int,
    user: User = Depends(get_stream_user),
):
    _ = user
    session = live_manager.get_session(camera_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="No active live session for this camera. Call /start first.",
        )

    boundary = "frame"

    async def generate():
        while True:
            sess = live_manager.get_session(camera_id)
            if sess is None or sess.stop_event.is_set():
                break
            jpeg = live_manager.get_jpeg(camera_id)
            if jpeg:
                yield (
                    b"--" + boundary.encode() + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                    + jpeg
                    + b"\r\n"
                )
            await asyncio.sleep(0.08)

    return StreamingResponse(
        generate(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
    )
