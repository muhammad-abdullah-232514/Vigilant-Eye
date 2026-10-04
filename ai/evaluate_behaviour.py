"""
Event-level evaluation of the live alert logic on held-out stock footage.

Replays each clip in ai/eval_videos/ (labels in SOURCES.csv: expected_behaviour per clip)
through the SAME path as live monitoring: YOLO -> detection_policy.decide -> SessionTracker
(persistence + cooldown). Frames are sampled at --fps to mimic the live loop.

Metrics (CONFIRM events = what raises an invigilator alert):
  clip recall      = positive clips with >=1 CONFIRM of the expected class / positive clips
  event precision  = CONFIRM events matching the clip's expected class / all CONFIRM events
  false alerts/min = CONFIRM events on negative clips (normal exam footage) per minute

    .venv/bin/python ai/evaluate_behaviour.py                       # trained detector
    .venv/bin/python ai/evaluate_behaviour.py --weights ai/weights/yolov8n.pt --mode coco
"""

from __future__ import annotations

import argparse
import csv
import json
import time
from collections import Counter
from pathlib import Path

import cv2

from detection_policy import Decision, SessionTracker, annotate_detection_dict
from ufm_classes import resolve_weights

AI = Path(__file__).resolve().parent
VIDEOS = AI / "eval_videos"


def run_clip(model, mode: str, path: Path, fps: float, imgsz: int, max_sec: float) -> dict:
    cap = cv2.VideoCapture(str(path))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, round(src_fps / fps))
    tracker = SessionTracker()
    events, frames, idx, t_inf = [], 0, 0, 0.0
    while True:
        ok, frame = cap.read()
        if not ok or idx / src_fps > max_sec:
            break
        if idx % step == 0:
            h, w = frame.shape[:2]
            if max(h, w) > 1280:  # live cameras deliver ~720p
                s = 1280 / max(h, w)
                frame = cv2.resize(frame, (int(w * s), int(h * s)))
            t0 = time.perf_counter()
            res = model.predict(frame, imgsz=imgsz, conf=0.2, verbose=False)[0]
            t_inf += time.perf_counter() - t0
            now = idx / src_fps
            for box in res.boxes:
                raw = res.names[int(box.cls[0])]
                xyxy = tuple(float(v) for v in box.xyxy[0].tolist())
                item = annotate_detection_dict(raw_label=raw, confidence=float(box.conf[0]), model_mode=mode,
                                               xyxy=xyxy, frame_wh=(frame.shape[1], frame.shape[0]))
                if not item["category"] or item["decision"] == Decision.IGNORE.value:
                    continue
                emit = tracker.observe(category=item["category"], decision=Decision(item["decision"]),
                                       confidence=item["confidence"], bin_id="x", now=now, xyxy=xyxy)
                if emit is not None:
                    events.append({"t": round(now, 1), "category": item["category"], "level": emit.value,
                                   "conf": item["confidence"]})
            frames += 1
        idx += 1
    cap.release()
    return {"events": events, "seconds": idx / src_fps, "frames": frames,
            "infer_ms": round(1000 * t_inf / max(1, frames), 1)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default=None)
    ap.add_argument("--mode", default=None, help="custom | coco (default from weights resolution)")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--imgsz", type=int, default=480)
    ap.add_argument("--max-sec", type=float, default=30.0)
    ap.add_argument("--out", type=Path, default=AI / "runs" / "eval" / "behaviour_eval.json")
    args = ap.parse_args()

    from ultralytics import YOLO

    weights, mode = resolve_weights(args.weights)
    mode = args.mode or ("custom" if mode == "explicit" else mode)
    model = YOLO(str(weights))
    rows = list(csv.DictReader((VIDEOS / "SOURCES.csv").open()))

    clips, pos, pos_hit, conf_events, correct_events = [], 0, 0, 0, 0
    neg_seconds, neg_alerts = 0.0, 0
    for r in rows:
        path = VIDEOS / r["file"]
        if not path.exists():
            continue
        expected = r["expected_behaviour"]
        out = run_clip(model, mode, path, args.fps, args.imgsz, args.max_sec)
        confirms = [e for e in out["events"] if e["level"] == "CONFIRM"]
        by_cat = Counter(e["category"] for e in confirms)
        if expected != "none":
            pos += 1
            hit = by_cat.get(expected, 0) > 0
            pos_hit += hit
            correct_events += by_cat.get(expected, 0)
        else:
            hit = None
            neg_seconds += out["seconds"]
            neg_alerts += len(confirms)
        conf_events += len(confirms)
        clips.append({"clip": r["file"], "title": r["title"], "expected": expected,
                      "confirm_events": dict(by_cat),
                      "review_events": dict(Counter(e["category"] for e in out["events"] if e["level"] == "REVIEW")),
                      "detected_expected": hit, "seconds": round(out["seconds"], 1), "infer_ms": out["infer_ms"]})
        print(f"{r['file']:24s} expected={expected:12s} confirm={dict(by_cat)} hit={hit} {out['infer_ms']}ms")

    summary = {
        "weights": Path(weights).name, "mode": mode, "fps_sampled": args.fps, "imgsz": args.imgsz,
        "clip_recall": round(pos_hit / pos, 3) if pos else None,
        "positive_clips": pos,
        "event_precision": round(correct_events / conf_events, 3) if conf_events else None,
        "confirm_events": conf_events,
        "false_alerts_per_min_on_normal_footage": round(neg_alerts / (neg_seconds / 60), 2) if neg_seconds else None,
        "normal_footage_minutes": round(neg_seconds / 60, 2),
        "clips": clips,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(summary, indent=2))
    print(json.dumps({k: v for k, v in summary.items() if k != "clips"}, indent=2))


if __name__ == "__main__":
    main()
