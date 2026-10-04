#!/usr/bin/env bash
# Long local fine-tune (CPU) -> test-set report -> 95%-precision thresholds -> stock-video check.
# Keeps the Mac awake (caffeinate). Log: logs/overnight.log. New weights are installed to
# ai/weights/ufm_od_v1.pt automatically; restart the API afterwards:  ./scripts/start-mac.sh restart
set -euo pipefail
cd "$(dirname "$0")/.."
export YOLO_CONFIG_DIR="$PWD/logs/ultralytics" PYTHONPATH="$PWD/backend:$PWD/ai"
PY=.venv/bin/python
HOURS="${1:-8}"
cp ai/weights/ufm_od_v1.pt "ai/weights/ufm_od_v1.before_$(date +%Y%m%d_%H%M).pt"
echo "== train ${HOURS}h $(date)"
caffeinate -i nice -n 10 "$PY" ai/train_ufm_local.py \
  --model ai/weights/ufm_od_v1.pt --name ufm_od_v1_long --hours "$HOURS" \
  --imgsz 384 --fraction 1.0 --batch 16 --epochs 12 --lr0 0.0005
echo "== tune thresholds (precision 0.95) $(date)"
"$PY" ai/tune_thresholds.py --imgsz 384 --confirm-precision 0.95 --review-precision 0.85
echo "== behaviour check on held-out stock clips $(date)"
"$PY" ai/evaluate_behaviour.py --imgsz 384 || true
echo "== OVERNIGHT_DONE $(date)"
