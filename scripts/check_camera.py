"""Check a webcam, video file, RTSP, or HTTP source without starting AI inference."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from capture_source import CaptureError, open_capture  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Check one configured camera source.")
    parser.add_argument(
        "--source",
        default="webcam:0",
        help="webcam:N, file path, RTSP, or HTTP source",
    )
    args = parser.parse_args()

    print(f"OpenCV: {cv2.__version__}")
    capture = None
    try:
        opened = open_capture(args.source)
        capture = opened.cap
        width = int(opened.first_frame.shape[1])
        height = int(opened.first_frame.shape[0])
        print(f"Source: {opened.description}")
        print(f"Camera {args.source}: PASS")
        print(f"Resolution: {width}x{height}")
        return 0
    except CaptureError as exc:
        print(f"Camera {args.source}: FAIL")
        print(exc)
        return 1
    finally:
        if capture is not None:
            capture.release()


if __name__ == "__main__":
    raise SystemExit(main())
