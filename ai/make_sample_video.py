"""
Build a short sample MP4 from still images (for offline PoC testing).

Usage:
  python ai/make_sample_video.py
"""

from __future__ import annotations

from pathlib import Path

import cv2


def main() -> None:
    root = Path(__file__).resolve().parent
    samples = root / "samples"
    out = samples / "sample_exam_clip.mp4"

    # Prefer scenes that YOLO usually detects (person/bus), so validation can fire.
    preferred = [
        samples / "bus.jpg",
        samples / "zidane.jpg",
        samples / "exam_hall.jpg",
    ]
    images = [p for p in preferred if p.exists()]
    if not images:
        raise FileNotFoundError("No sample images found in ai/samples")

    first = cv2.imread(str(images[0]))
    if first is None:
        raise RuntimeError(f"Could not read {images[0]}")
    height, width = first.shape[:2]
    fps = 5
    frames_per_image = 10  # each still shown for 2 seconds

    writer = cv2.VideoWriter(
        str(out),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )
    if not writer.isOpened():
        raise RuntimeError("Failed to open VideoWriter")

    total_frames = 0
    for path in images:
        frame = cv2.imread(str(path))
        if frame is None:
            continue
        frame = cv2.resize(frame, (width, height))
        for _ in range(frames_per_image):
            writer.write(frame)
            total_frames += 1

    writer.release()
    print(f"Created {out}")
    print(f"frames={total_frames}, fps={fps}, duration~{total_frames / fps:.1f}s")


if __name__ == "__main__":
    main()
