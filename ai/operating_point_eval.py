"""
Precision / recall on the held-out TEST split at the live alert thresholds.

Ultralytics' P/R are reported at its own max-F1 confidence. Invigilators only ever
see detections above each class's tuned CONFIRM gate (ai/weights/*.thresholds.json),
so this script measures precision/recall at exactly those operating points
(IoU >= 0.5, one prediction per ground-truth box).

    .venv/bin/python ai/operating_point_eval.py   # -> ai/runs/eval/operating_point_test.json
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path


AI = Path(__file__).resolve().parent
DATA = AI / "dataset" / "ufm_od_v1"
WEIGHTS = AI / "weights" / "ufm_od_v1.pt"
OUT = AI / "runs" / "eval" / "operating_point_test.json"


def iou(a, b) -> float:
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def main(imgsz: int = 384) -> None:
    from ultralytics import YOLO

    m = YOLO(str(WEIGHTS))
    names = m.names
    thr = json.loads(WEIGHTS.with_suffix(".thresholds.json").read_text())["classes"]
    gate = {c: float(v["confirm_min"]) for c, v in thr.items() if c != "smart_watch"}
    floor = min(gate.values())
    tp, fp, n_gt = defaultdict(int), defaultdict(int), defaultdict(int)
    imgs = sorted((DATA / "images" / "test").glob("*.jpg"))
    for start in range(0, len(imgs), 32):
        batch = imgs[start:start + 32]
        for path, res in zip(batch, m.predict([str(p) for p in batch], imgsz=imgsz, conf=floor, verbose=False)):
            h, w = res.orig_shape
            gts = defaultdict(list)
            lbl = DATA / "labels" / "test" / (path.stem + ".txt")
            for line in (lbl.read_text().splitlines() if lbl.exists() else []):
                c, x, y, bw, bh = line.split()
                x, y, bw, bh = float(x) * w, float(y) * h, float(bw) * w, float(bh) * h
                gts[names[int(c)]].append([x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2, False])
            for cls, boxes in gts.items():
                n_gt[cls] += len(boxes)
            preds = sorted(((names[int(b.cls)], float(b.conf), b.xyxy[0].tolist()) for b in res.boxes),
                           key=lambda p: -p[1])
            for cls, conf, box in preds:
                if cls not in gate or conf < gate[cls]:
                    continue
                best, best_iou = None, 0.5
                for g in gts.get(cls, []):
                    if not g[4] and (v := iou(box, g)) >= best_iou:
                        best, best_iou = g, v
                if best is None:
                    fp[cls] += 1
                else:
                    best[4] = True
                    tp[cls] += 1
    rows = {}
    for cls in gate:
        p = tp[cls] / (tp[cls] + fp[cls]) if tp[cls] + fp[cls] else None
        r = tp[cls] / n_gt[cls] if n_gt[cls] else None
        rows[cls] = {"confirm_gate": gate[cls], "precision": None if p is None else round(p, 3),
                     "recall": None if r is None else round(r, 3), "alerts": tp[cls] + fp[cls], "test_objects": n_gt[cls]}
    all_tp, all_fp = sum(tp[c] for c in gate), sum(fp[c] for c in gate)
    out = {"split": "test", "weights": WEIGHTS.name, "imgsz": imgsz,
           "note": "smart_watch excluded: live type decision is made by the CLIP verifier, not the detector",
           "overall_alert_precision": round(all_tp / (all_tp + all_fp), 3) if all_tp + all_fp else None,
           "overall_alert_recall": round(all_tp / max(1, sum(n_gt[c] for c in gate)), 3),
           "classes": rows}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
