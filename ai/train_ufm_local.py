"""
Quick local fine-tune of the UFM object detector (ufm-od-v1) + held-out test report.

Device: mps (Apple Silicon) > cuda > cpu. On an Intel MacBook this is CPU-only, so
training is time-boxed (--hours) and uses a smaller image size; the full-quality
run is ai/colab/train_colab.ipynb on a Colab GPU.

    .venv/bin/python ai/train_ufm_local.py --hours 4
    .venv/bin/python ai/train_ufm_local.py --eval-only --weights ai/weights/ufm_od_v1.pt

Outputs:
  ai/runs/train/ufm_od_v1_local/            Ultralytics run (curves, confusion matrix)
  ai/weights/ufm_od_v1.pt                   best weights (picked up by the API)
  ai/runs/eval/ufm_od_v1_test_metrics.json  per-class P / R / mAP50 on the TEST split
  docs/AI_MODEL_RESULTS.md                  human-readable results table
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path

AI = Path(__file__).resolve().parent
ROOT = AI.parent
DATA = AI / "dataset" / "ufm_od_v1" / "data.yaml"
RUNS = AI / "runs" / "train"
WEIGHTS_OUT = AI / "weights" / "ufm_od_v1.pt"
EVAL_JSON = AI / "runs" / "eval" / "ufm_od_v1_test_metrics.json"
REPORT_MD = ROOT / "docs" / "AI_MODEL_RESULTS.md"


def pick_device() -> str:
    import torch

    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "0"
    return "cpu"


def abs_data_yaml() -> Path:
    """Ultralytics resolves relative dataset paths against its own datasets dir — pin it."""
    import yaml

    cfg = yaml.safe_load(DATA.read_text())
    cfg["path"] = str(DATA.parent)
    out = DATA.parent / "data_abs.yaml"
    out.write_text(yaml.safe_dump(cfg, sort_keys=False))
    return out


def train(args, data: Path, device: str) -> Path:
    from ultralytics import YOLO

    name = args.name
    last = RUNS / name / "weights" / "last.pt"
    if args.resume and last.exists():
        YOLO(str(last)).train(resume=True)
    else:
        YOLO(args.model).train(
            data=str(data),
            imgsz=args.imgsz,
            epochs=args.epochs,
            time=args.hours,  # hard wall-clock budget; LR schedule adapts
            batch=args.batch,
            device=device,
            workers=args.workers,
            patience=15,
            cos_lr=True,
            close_mosaic=3,
            fraction=args.fraction,
            seed=0,
            project=str(RUNS),
            name=name,
            exist_ok=True,
            plots=True,
            cache=False,
            amp=device != "cpu",
            **({"optimizer": "AdamW", "lr0": args.lr0, "warmup_epochs": 0} if args.lr0 else {}),
        )
    return RUNS / name / "weights" / "best.pt"


def evaluate(weights: Path, data: Path, device: str, imgsz: int) -> dict:
    from ultralytics import YOLO

    m = YOLO(str(weights))
    res = m.val(data=str(data), split="test", imgsz=imgsz, device=device, plots=True,
                project=str(AI / "runs" / "eval"), name="ufm_od_v1_test", exist_ok=True)
    names = m.names
    per_class = []
    for k, cid in enumerate(res.box.ap_class_index):
        per_class.append({
            "class": names[int(cid)],
            "precision": round(float(res.box.p[k]), 3),
            "recall": round(float(res.box.r[k]), 3),
            "mAP50": round(float(res.box.ap50[k]), 3),
            "mAP50_95": round(float(res.box.ap[k]), 3),
        })
    # test-split instance counts per class
    counts = json.loads((DATA.parent / "manifest.json").read_text())["splits"]["test"]["boxes"]
    for row in per_class:
        row["test_instances"] = counts.get(row["class"], 0)
    speed = res.speed  # ms per image
    return {
        "weights": str(weights.relative_to(ROOT)) if weights.is_relative_to(ROOT) else str(weights),
        "evaluated_at": datetime.now().isoformat(timespec="seconds"),
        "split": "test (held out, session/group-disjoint from train/val)",
        "imgsz": imgsz,
        "device": device,
        "overall": {
            "precision": round(float(res.box.mp), 3),
            "recall": round(float(res.box.mr), 3),
            "mAP50": round(float(res.box.map50), 3),
            "mAP50_95": round(float(res.box.map), 3),
        },
        "per_class": per_class,
        "inference_ms_per_image": round(float(speed.get("inference", 0.0)), 1),
    }


def write_report(metrics: dict, train_info: dict) -> None:
    lines = [
        "# UFM object detector — results (ufm-od-v1)",
        "",
        f"*Generated {metrics['evaluated_at']} by `ai/train_ufm_local.py`.*",
        "",
        f"- Weights: `{metrics['weights']}` (installed as `ai/weights/ufm_od_v1.pt`)",
        f"- Base model: `{train_info.get('model')}` · imgsz {metrics['imgsz']} · device `{metrics['device']}`"
        f" · trained {train_info.get('epochs_done', '?')} epochs in {train_info.get('hours', '?')} h budget",
        f"- Evaluation split: **{metrics['split']}**",
        f"- CPU inference: {metrics['inference_ms_per_image']} ms / image",
        "",
        "| Class | Test instances | Precision | Recall | mAP50 | mAP50-95 |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for r in metrics["per_class"]:
        lines.append(f"| {r['class']} | {r['test_instances']} | {r['precision']:.3f} | {r['recall']:.3f} "
                     f"| {r['mAP50']:.3f} | {r['mAP50_95']:.3f} |")
    o = metrics["overall"]
    lines += [f"| **all** | | **{o['precision']:.3f}** | **{o['recall']:.3f}** | **{o['mAP50']:.3f}** "
              f"| **{o['mAP50_95']:.3f}** |", "",
              "Precision/recall are at Ultralytics' max-F1 confidence. Live alerts use stricter per-class "
              "thresholds (`ai/detection_policy.py`) plus multi-frame persistence, which trade recall for "
              "fewer false alerts.", "",
              "Dataset composition, sources and licenses: [DATASETS.md](../DATASETS.md).", ""]
    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="yolov8n.pt")
    ap.add_argument("--hours", type=float, default=4.0)
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--imgsz", type=int, default=416)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--fraction", type=float, default=1.0, help="train on a fraction of train split")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--name", default="ufm_od_v1_local")
    ap.add_argument("--data", type=Path, default=None, help="dataset yaml (e.g. data_balanced.yaml)")
    ap.add_argument("--lr0", type=float, default=None, help="fine-tune LR (e.g. 0.0005 when continuing)")
    ap.add_argument("--eval-only", action="store_true")
    ap.add_argument("--weights", type=Path, default=None)
    args = ap.parse_args()

    device = pick_device()
    data = args.data.resolve() if args.data else abs_data_yaml()
    eval_data = abs_data_yaml()  # val/test always from the standard yaml
    print(f"device={device} data={data}")
    train_info = {"model": args.model, "hours": args.hours}

    if args.eval_only:
        best = args.weights or WEIGHTS_OUT
    else:
        best = train(args, data, device)
        results_csv = best.parent.parent / "results.csv"
        if results_csv.exists():
            train_info["epochs_done"] = max(0, len(results_csv.read_text().strip().splitlines()) - 1)
        WEIGHTS_OUT.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best, WEIGHTS_OUT)
        print(f"installed {WEIGHTS_OUT}")

    metrics = evaluate(Path(best), eval_data, device, args.imgsz)
    metrics["train"] = train_info
    EVAL_JSON.parent.mkdir(parents=True, exist_ok=True)
    EVAL_JSON.write_text(json.dumps(metrics, indent=2))
    write_report(metrics, train_info)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
