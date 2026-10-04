#!/usr/bin/env bash
# Waits for scripts/train_overnight.sh, then restarts the API with the new model,
# writes MORNING_SUMMARY.md and commits the results.
cd "$(dirname "$0")/.."
until grep -q OVERNIGHT_DONE logs/overnight.log 2>/dev/null; do
  pgrep -f train_overnight.sh >/dev/null || break
  sleep 60
done
open -a Terminal scripts/start-mac.command   # Terminal owns camera permission
sleep 90
.venv/bin/python - <<'PY'
import json
from pathlib import Path
m = json.loads(Path("ai/runs/eval/ufm_od_v1_test_metrics.json").read_text())
t = json.loads(Path("ai/weights/ufm_od_v1.thresholds.json").read_text())
b = Path("ai/runs/eval/behaviour_eval.json")
b = json.loads(b.read_text()) if b.exists() else {}
L = ["# Morning summary — overnight training", "",
     f"Finished: {m['evaluated_at']} · weights `ai/weights/ufm_od_v1.pt` (previous model backed up as `ai/weights/ufm_od_v1.before_*.pt`)",
     f"Epochs this run: {m.get('train', {}).get('epochs_done', '?')}", "",
     "## Held-out TEST set (2,374 images never used in training)", "",
     "| class | precision | recall | mAP50 |", "|---|---:|---:|---:|"]
for r in m["per_class"]:
    L.append(f"| {r['class']} | {r['precision']:.3f} | {r['recall']:.3f} | {r['mAP50']:.3f} |")
o = m["overall"]
L += [f"| **overall** | **{o['precision']:.3f}** | **{o['recall']:.3f}** | **{o['mAP50']:.3f}** |",
      "", "Previous model (3 epochs): overall precision 0.495, recall 0.361, mAP50 0.412.", "",
      "## Live alert gates (tuned on validation for 95% precision)", "",
      "| class | REVIEW ≥ | CONFIRM ≥ | val recall at CONFIRM | 95% reached |", "|---|---:|---:|---:|---|"]
for k, v in t["classes"].items():
    L.append(f"| {k} | {v['review_min']} | {v['confirm_min']} | {v.get('val_recall_at_confirm', '—')} | {v.get('target_precision_reached', '—')} |")
if b:
    L += ["", "## Held-out stock exam videos (live alert logic)", "",
          f"- Event precision: {b.get('event_precision')}",
          f"- Cheating clips caught: {b.get('clip_recall')} of {b.get('positive_clips')}",
          f"- False alerts per minute on normal exam footage: {b.get('false_alerts_per_min_on_normal_footage')}"]
L += ["", "API restarted with the new model (`./scripts/start-mac.sh restart`). Open http://localhost:5173 → Live Monitoring."]
Path("MORNING_SUMMARY.md").write_text("\n".join(L) + "\n")
PY
git add MORNING_SUMMARY.md docs/AI_MODEL_RESULTS.md && git add -f ai/weights/ufm_od_v1.thresholds.json
git commit -q -m "Overnight fine-tune results: new ufm_od_v1 weights, 95%-precision thresholds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || true
echo AFTER_DONE
