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
REVIEW_FLOOR = 0.30


def first_conf_with_precision(
    px: np.ndarray, p: np.ndarray, r: np.ndarray, target: float, min_recall: float = 0.05
) -> float | None:
    """
    Smallest confidence whose precision (and all higher confidences') meets target,
    searched only where the class still has recall >= min_recall (Ultralytics pads the
    precision curve with 1.0 above the highest predicted confidence).
    """
    ok = (p >= target) & (r >= min_recall)
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
        p, r = p_curve[k], r_curve[k]
        f1 = 2 * p * r / np.maximum(p + r, 1e-9)
        f1_conf = float(px[int(np.argmax(f1))])
        conf_c = first_conf_with_precision(px, p, r, args.confirm_precision)
        conf_r = first_conf_with_precision(px, p, r, args.review_precision)
        # Target precision unreachable at useful recall -> fall back to the max-F1 point for
        # REVIEW and a stricter point (halfway to the top predicted confidence) for CONFIRM.
        live = np.where(r >= 0.05)[0]
        top = float(px[live[-1]]) if len(live) else f1_conf
        review = conf_r if conf_r is not None else f1_conf
        confirm = conf_c if conf_c is not None else max(review, (f1_conf + top) / 2)
        # Every REVIEW event is persisted with evidence -> keep a 0.30 floor (fewer false flags)
        review = max(REVIEW_FLOOR, review)
        confirm = max(review, confirm)
        review, confirm = round(review, 3), round(confirm, 3)
        ri = lambda c: float(r_curve[k][min(999, int(c * 999))])  # noqa: E731
        out[name] = {
            "review_min": round(review, 3),
            "confirm_min": round(confirm, 3),
            "val_recall_at_confirm": round(ri(confirm), 3),
            "val_recall_at_review": round(ri(review), 3),
            "target_precision_reached": conf_c is not None,
            "max_f1_conf": round(f1_conf, 3),
        }
    # Live monitoring verifies every watch box with the CLIP crop classifier
    # (ai/watch_verifier.py), so smart_watch alerts are gated on watch *presence*
    # (detector confidence for any watch box), not on the detector's smart/normal split.
    out["smart_watch"] = {
        "review_min": 0.30,
        "confirm_min": 0.45,
        "basis": "watch-presence gate; smart vs normal decided by CLIP crop verifier (p_smart >= 0.80)",
        "detector_only": out.get("smart_watch"),
    }
    # Live-test override (docs/AI_MODEL_RESULTS.md): phone backs in low light score as notes_paper
    if "notes_paper" in out:
        out["notes_paper"]["review_min"] = max(0.40, out["notes_paper"]["review_min"])
        out["notes_paper"]["confirm_min"] = max(0.60, out["notes_paper"]["confirm_min"])
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
