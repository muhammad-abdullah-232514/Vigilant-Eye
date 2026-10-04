"""
Tune per-class live alert thresholds on the VALIDATION split (never on test).

confirm_min = lowest confidence where class precision >= --confirm-precision (default 0.90)
review_min  = lowest confidence where class precision >= --review-precision  (default 0.75)
Prioritises fewer false accusations over recall. Classes that cannot reach the target precision
get a high confirm gate (0.90) so they rarely auto-confirm. normal_watch is never an alert.

    .venv/bin/python ai/tune_thresholds.py            # writes ai/weights/ufm_od_v1.thresholds.json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import numpy as np

AI = Path(__file__).resolve().parent
NON_ALERT = {"normal_watch"}


def first_conf_with_precision(px: np.ndarray, p: np.ndarray, target: float) -> float | None:
    """Smallest confidence whose precision (and all higher confidences') meets target."""
    ok = p >= target
    # require precision to stay above target for higher confidences too (monotone tail)
    tail_ok = np.flip(np.logical_and.accumulate(np.flip(ok)))
    idx = np.where(tail_ok)[0]
    return float(px[idx[0]]) if len(idx) else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", type=Path, default=AI / "weights" / "ufm_od_v1.pt")
    ap.add_argument("--data", type=Path, default=AI / "dataset" / "ufm_od_v1" / "data_abs.yaml")
    ap.add_argument("--imgsz", type=int, default=384)
    ap.add_argument("--confirm-precision", type=float, default=0.90)
    ap.add_argument("--review-precision", type=float, default=0.75)
    args = ap.parse_args()

    from ultralytics import YOLO

    m = YOLO(str(args.weights))
    res = m.val(data=str(args.data), split="val", imgsz=args.imgsz, conf=0.001, plots=False,
                project=str(AI / "runs" / "eval"), name="ufm_od_v1_val_tune", exist_ok=True, verbose=False)
    px = np.linspace(0, 1, 1000)
    p_curve, r_curve = res.box.p_curve, res.box.r_curve
    out = {}
    for k, cid in enumerate(res.box.ap_class_index):
        name = m.names[int(cid)]
        if name in NON_ALERT:
            continue
        conf_c = first_conf_with_precision(px, p_curve[k], args.confirm_precision)
        conf_r = first_conf_with_precision(px, p_curve[k], args.review_precision)
        confirm = min(0.90, max(0.35, conf_c)) if conf_c is not None else 0.90
        review = min(confirm, max(0.25, conf_r)) if conf_r is not None else min(confirm, 0.60)
        ri = lambda c: float(r_curve[k][min(999, int(c * 999))])  # noqa: E731
        out[name] = {
            "review_min": round(review, 3),
            "confirm_min": round(confirm, 3),
            "val_recall_at_confirm": round(ri(confirm), 3),
            "val_recall_at_review": round(ri(review), 3),
            "target_precision_reached": conf_c is not None,
        }
    payload = {
        "weights": args.weights.name,
        "tuned_at": datetime.now().isoformat(timespec="seconds"),
        "split": "val",
        "confirm_precision_target": args.confirm_precision,
        "review_precision_target": args.review_precision,
        "classes": out,
    }
    dst = args.weights.with_suffix(".thresholds.json")
    dst.write_text(json.dumps(payload, indent=2))
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
