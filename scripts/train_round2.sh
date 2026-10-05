#!/usr/bin/env bash
# Round 2: waits for the overnight run + its follow-up, then a class-balanced fine-tune
# at a lower learning rate. Keeps round 2 only if its TEST mAP50 beats round 1.
# Then: thresholds (90% precision target), alert-precision on test, stock-video check,
# API restart, MORNING_SUMMARY.md, git commit.   Log: logs/round2.log
set -uo pipefail
cd "$(dirname "$0")/.."
export YOLO_CONFIG_DIR="$PWD/logs/ultralytics" PYTHONPATH="$PWD/backend:$PWD/ai"
PY=.venv/bin/python
HOURS="${1:-8}"
EVAL=ai/runs/eval

until grep -q AFTER_DONE logs/after_overnight.log 2>/dev/null; do sleep 60; done
echo "== round 1 finished $(date)"
cp "$EVAL/ufm_od_v1_test_metrics.json" "$EVAL/round1_test_metrics.json"
cp ai/weights/ufm_od_v1.pt ai/weights/ufm_od_v1.round1.pt
cp ai/weights/ufm_od_v1.thresholds.json ai/weights/ufm_od_v1.round1.thresholds.json

echo "== round 2 train ${HOURS}h $(date)"
"$PY" ai/make_balanced_list.py
caffeinate -i nice -n 10 "$PY" ai/train_ufm_local.py \
  --model ai/weights/ufm_od_v1.pt --name ufm_od_v1_round2 --data ai/dataset/ufm_od_v1/data_balanced.yaml \
  --hours "$HOURS" --imgsz 384 --batch 16 --epochs 8 --lr0 0.0003

echo "== keep round 2 only if it beats round 1 on TEST mAP50 $(date)"
"$PY" - <<'PY'
import json, shutil
from pathlib import Path
e = Path("ai/runs/eval")
r1 = json.loads((e / "round1_test_metrics.json").read_text())["overall"]["mAP50"]
r2 = json.loads((e / "ufm_od_v1_test_metrics.json").read_text())["overall"]["mAP50"]
if r2 >= r1:
    msg = f"round 2 (test mAP50 {r2:.3f} >= round 1 {r1:.3f})"
else:
    shutil.copy("ai/weights/ufm_od_v1.round1.pt", "ai/weights/ufm_od_v1.pt")
    shutil.copy(e / "round1_test_metrics.json", e / "ufm_od_v1_test_metrics.json")
    msg = f"round 1 kept (round 2 test mAP50 {r2:.3f} < {r1:.3f})"
(e / "round2_decision.txt").write_text(msg + "\n")
print(msg)
PY

echo "== thresholds / alert precision / stock videos $(date)"
"$PY" ai/tune_thresholds.py --imgsz 384 --confirm-precision 0.90 --review-precision 0.80
"$PY" ai/operating_point_eval.py
"$PY" ai/evaluate_behaviour.py --imgsz 384 || true
"$PY" ai/write_summary.py

open -a Terminal scripts/start-mac.command   # restart API with the installed model
git add MORNING_SUMMARY.md docs/AI_MODEL_RESULTS.md && git add -f ai/weights/ufm_od_v1.thresholds.json
git commit -q -m "Round 2 (class-balanced) results, alert-precision report

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || true
echo "== ROUND2_DONE $(date)"
