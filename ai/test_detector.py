"""
VigilantEye — YOLO proof-of-concept detector (PROTOTYPE).

Usage (from project root, with backend venv active):
  cd "D:\\BS CS\\Vigilant Eye"
  .\\backend\\venv\\Scripts\\Activate.ps1
  python ai/test_detector.py --source ai/samples/bus.jpg

Honest limits:
  Pretrained YOLOv8 (COCO) can detect common objects such as person / cell phone.
  It does NOT fully cover all UFM behaviors (notes, paper exchange, smart watch,
  suspicious hand/head movement) without custom training / extra models.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="VigilantEye YOLO PoC detector")
    parser.add_argument(
        "--source",
        type=str,
        default=str(root / "samples" / "bus.jpg"),
        help="Path to image or video",
    )
    parser.add_argument(
        "--weights",
        type=str,
        default=str(root / "weights" / "yolov8n.pt"),
        help="YOLO weights (downloaded automatically on first run if missing)",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold",
    )
    parser.add_argument(
        "--outdir",
        type=str,
        default=str(root / "outputs"),
        help="Folder for annotated outputs",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Path(args.source)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    if not source.exists():
        raise FileNotFoundError(f"Source not found: {source}")

    print("=" * 60)
    print("VigilantEye YOLO PoC")
    print(f"time     : {datetime.now(timezone.utc).isoformat()}")
    print(f"source   : {source}")
    print(f"weights  : {args.weights}")
    print(f"conf     : {args.conf}")
    print("=" * 60)
    print(
        "NOTE: Pretrained COCO model ≠ full UFM detector. "
        "Custom training / MediaPipe may be required for exam-specific behaviors."
    )
    print()

    model = YOLO(args.weights)
    results = model.predict(
        source=str(source),
        conf=args.conf,
        save=False,
        verbose=False,
    )

    total = 0
    for i, result in enumerate(results):
        names = result.names
        boxes = result.boxes
        print(f"--- frame/image {i} ---")
        if boxes is None or len(boxes) == 0:
            print("No detections above confidence threshold.")
        else:
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                label = names.get(cls_id, str(cls_id))
                total += 1
                print(f"  class={label:15} confidence={conf:.3f}")

        stem = source.stem
        out_path = outdir / f"{stem}_annotated_{i}.jpg"
        result.save(filename=str(out_path))
        print(f"Annotated output: {out_path}")

    print()
    print(f"Total detections: {total}")
    print("Done.")


if __name__ == "__main__":
    main()
