"""Write MORNING_SUMMARY.md from the latest evaluation artefacts (all numbers measured, none typed in)."""

from __future__ import annotations

import csv
import json
from pathlib import Path

AI = Path(__file__).resolve().parent
ROOT = AI.parent
EVAL = AI / "runs" / "eval"


def load(p: Path):
    return json.loads(p.read_text()) if p.exists() else None


def history(run: str) -> list[dict]:
    f = AI / "runs" / "train" / run / "results.csv"
    if not f.exists():
        return []
    with f.open() as fh:
        return [{k.strip(): v for k, v in r.items()} for r in csv.DictReader(fh)]


def main() -> None:
    test = load(EVAL / "ufm_od_v1_test_metrics.json")
    r1 = load(EVAL / "round1_test_metrics.json")
    op = load(EVAL / "operating_point_test.json")
    beh = load(EVAL / "behaviour_eval.json")
    thr = load(AI / "weights" / "ufm_od_v1.thresholds.json")
    kept = (EVAL / "round2_decision.txt").read_text().strip() if (EVAL / "round2_decision.txt").exists() else ""

    L = ["# AI model — training summary", "",
         "All numbers below were measured by the scripts in `ai/` on data the model never trained on.", ""]
    L += ["## Progress (held-out TEST set, 2,374 images)", "",
          "| model | precision | recall | mAP50 |", "|---|---:|---:|---:|",
          "| initial (3 epochs, 4 Oct) | 0.495 | 0.361 | 0.412 |"]
    if r1:
        o = r1["overall"]
        L.append(f"| round 1 overnight | {o['precision']:.3f} | {o['recall']:.3f} | {o['mAP50']:.3f} |")
    if test and (not r1 or test["evaluated_at"] != r1["evaluated_at"]):
        o = test["overall"]
        L.append(f"| round 2 (class-balanced) | {o['precision']:.3f} | {o['recall']:.3f} | {o['mAP50']:.3f} |")
    if kept:
        L += ["", f"Installed model: **{kept}**"]
    if test:
        L += ["", "### Per class (installed model, max-F1 confidence)", "",
              "| class | precision | recall | mAP50 |", "|---|---:|---:|---:|"]
        for r in test["per_class"]:
            L.append(f"| {r['class']} | {r['precision']:.3f} | {r['recall']:.3f} | {r['mAP50']:.3f} |")
    if op:
        L += ["", "## Precision of live ALERTS (test set, at the tuned CONFIRM thresholds)", "",
              "This is what an invigilator experiences: of the alerts raised, how many are correct.", "",
              "| class | confirm gate | alert precision | recall | alerts |", "|---|---:|---:|---:|---:|"]
        for c, r in op["classes"].items():
            L.append(f"| {c} | {r['confirm_gate']} | {r['precision']} | {r['recall']} | {r['alerts']} |")
        L += [f"| **overall** | | **{op['overall_alert_precision']}** | **{op['overall_alert_recall']}** | |",
              "", f"_{op['note']}._"]
    if beh:
        L += ["", "## Held-out stock exam videos (full live pipeline)", "",
              f"- Alert precision: {beh.get('event_precision')}",
              f"- Cheating clips caught: {beh.get('clip_recall')} ({beh.get('positive_clips')} clips)",
              f"- False alerts per minute on normal exam footage: {beh.get('false_alerts_per_min_on_normal_footage')}"]
    for run in ("ufm_od_v1_long", "ufm_od_v1_round2"):
        h = history(run)
        if h:
            L += ["", f"### Validation per epoch — {run}", "", "| epoch | precision | recall | mAP50 |", "|---:|---:|---:|---:|"]
            for r in h:
                L.append(f"| {r['epoch']} | {float(r['metrics/precision(B)']):.3f} | "
                         f"{float(r['metrics/recall(B)']):.3f} | {float(r['metrics/mAP50(B)']):.3f} |")
    if thr:
        L += ["", "Alert thresholds: `ai/weights/ufm_od_v1.thresholds.json` (tuned on the validation split)."]
    L += ["", "The API was restarted with the installed model. Open http://localhost:5173 → Live Monitoring.", ""]
    (ROOT / "MORNING_SUMMARY.md").write_text("\n".join(L))
    print(ROOT / "MORNING_SUMMARY.md")


if __name__ == "__main__":
    main()
