# UFM object detector — results (ufm-od-v1)

*Generated 2026-10-05T17:44:14 by `ai/train_ufm_local.py`.*

- Weights: `ai/runs/train/ufm_od_v1_round2/weights/best.pt` (installed as `ai/weights/ufm_od_v1.pt`)
- Base model: `ai/weights/ufm_od_v1.pt` · imgsz 384 · device `cpu` · trained 2 epochs in 8.0 h budget
- Evaluation split: **test (held out, session/group-disjoint from train/val)**
- CPU inference: 85.4 ms / image

| Class | Test instances | Precision | Recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|---:|
| mobile_phone | 796 | 0.870 | 0.687 | 0.788 | 0.551 |
| laptop | 416 | 0.735 | 0.716 | 0.754 | 0.554 |
| smart_watch | 665 | 0.895 | 0.886 | 0.944 | 0.678 |
| normal_watch | 242 | 0.737 | 0.810 | 0.845 | 0.601 |
| notes_paper | 152 | 0.716 | 0.474 | 0.569 | 0.210 |
| electronic_gadget | 190 | 0.592 | 0.453 | 0.533 | 0.311 |
| **all** | | **0.758** | **0.671** | **0.739** | **0.484** |

Precision/recall are at Ultralytics' max-F1 confidence. Live alerts use stricter per-class thresholds (`ai/detection_policy.py`) plus multi-frame persistence, which trade recall for fewer false alerts.

Dataset composition, sources and licenses: [DATASETS.md](../DATASETS.md).
