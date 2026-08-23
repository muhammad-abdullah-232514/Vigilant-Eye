"""
Run repeated-frame validation and save CONFIRMED events into PostgreSQL.

Usage (from project root, venv active):
  python ai/save_confirmed_to_db.py --source ai/samples/sample_exam_clip.mp4

Optional auto-draft (PROTOTYPE):
  python ai/save_confirmed_to_db.py --source ai/samples/sample_exam_clip.mp4 ^
    --auto-draft --student-id 1 --exam-id 1 --reporter-id 1
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import cv2
from ultralytics import YOLO

# Allow importing backend modules
ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from database import SessionLocal  # noqa: E402
from detection_bridge import (  # noqa: E402
    UFM_AUTO_DRAFT_CLASSES,
    create_draft_case_from_detection,
    notify_detection_alert,
)
from models.camera import Camera  # noqa: E402
from models.detection import Detection  # noqa: E402
from models.exam import Exam  # noqa: E402
from models.exam_room import ExamRoom  # noqa: E402
from models.student import Student  # noqa: E402
from models.user import User  # noqa: E402


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Save confirmed detections to DB")
    parser.add_argument(
        "--source",
        type=str,
        default=str(root / "samples" / "sample_exam_clip.mp4"),
    )
    parser.add_argument(
        "--weights",
        type=str,
        default=str(root / "weights" / "yolov8n.pt"),
    )
    parser.add_argument("--conf", type=float, default=0.35)
    parser.add_argument("--min-frames", type=int, default=3)
    parser.add_argument("--camera-id", type=int, default=None)
    parser.add_argument(
        "--auto-draft",
        action="store_true",
        help="Create UFM case drafts for watchlist classes (needs student/exam/reporter)",
    )
    parser.add_argument("--student-id", type=int, default=None)
    parser.add_argument("--exam-id", type=int, default=None)
    parser.add_argument("--reporter-id", type=int, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Path(args.source)
    if not source.exists():
        raise FileNotFoundError(f"Source not found: {source}")

    if args.auto_draft and not all([args.student_id, args.exam_id, args.reporter_id]):
        raise SystemExit(
            "--auto-draft requires --student-id, --exam-id, and --reporter-id"
        )

    print("=" * 60)
    print("Save confirmed detections -> PostgreSQL")
    print(f"source={source}")
    print(f"auto_draft={args.auto_draft}")
    print("=" * 60)

    model = YOLO(args.weights)
    cap = cv2.VideoCapture(str(source))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {source}")

    streaks: dict[str, int] = defaultdict(int)
    confirmed_labels: set[str] = set()
    pending_rows: list[Detection] = []

    frame_index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        result = model.predict(frame, conf=args.conf, verbose=False)[0]
        names = result.names
        labels_this_frame: dict[str, float] = {}
        if result.boxes is not None:
            for box in result.boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                label = names.get(cls_id, str(cls_id))
                labels_this_frame[label] = max(labels_this_frame.get(label, 0.0), conf)

        active = set(labels_this_frame.keys())
        for label in list(streaks.keys()):
            if label not in active:
                streaks[label] = 0

        for label, conf in labels_this_frame.items():
            streaks[label] += 1
            if streaks[label] >= args.min_frames and label not in confirmed_labels:
                confirmed_labels.add(label)
                row = Detection(
                    camera_id=args.camera_id,
                    student_id=args.student_id,
                    detection_type=label,
                    confidence=conf,
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
                    is_confirmed=True,
                    source_path=str(source).replace("\\", "/"),
                    frame_index=frame_index,
                )
                pending_rows.append(row)
                print(
                    f"CONFIRMED -> DB queue  {label}  conf={conf:.3f}  frame={frame_index}"
                )

        frame_index += 1

    cap.release()

    db = SessionLocal()
    try:
        camera_id = args.camera_id
        if camera_id is not None and db.get(Camera, camera_id) is None:
            print(f"Warning: camera_id={camera_id} not found; saving with camera_id=NULL")
            camera_id = None
            for row in pending_rows:
                row.camera_id = None

        drafts_created = 0
        for row in pending_rows:
            db.add(row)
            db.flush()  # get detection.id
            alert_count = notify_detection_alert(db, row)
            print(f"  alerted {alert_count} HOD user(s) for detection #{row.id}")

            if (
                args.auto_draft
                and row.detection_type.lower() in UFM_AUTO_DRAFT_CLASSES
            ):
                case = create_draft_case_from_detection(
                    db,
                    detection=row,
                    student_id=args.student_id,
                    exam_id=args.exam_id,
                    reported_by=args.reporter_id,
                )
                drafts_created += 1
                print(f"  DRAFT CASE {case.case_number} from detection #{row.id}")

        db.commit()
        print(f"Saved {len(pending_rows)} confirmed detection(s).")
        if args.auto_draft:
            print(f"Auto-drafts created: {drafts_created}")
            print(f"Watchlist classes: {sorted(UFM_AUTO_DRAFT_CLASSES)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
