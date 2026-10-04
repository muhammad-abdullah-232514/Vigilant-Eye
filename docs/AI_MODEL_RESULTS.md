# UFM object detector — results (ufm-od-v1)

*Generated 2026-10-04T23:16:59 by `ai/train_ufm_local.py`.*

- Weights: `ai/runs/train/ufm_od_v1_local/weights/best.pt` (installed as `ai/weights/ufm_od_v1.pt`)
- Base model: `yolov8n.pt` · imgsz 384 · device `cpu` · trained 3 epochs in 2.0 h budget
- Evaluation split: **test (held out, session/group-disjoint from train/val)**
- CPU inference: 64.9 ms / image

| Class | Test instances | Precision | Recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|---:|
| mobile_phone | 796 | 0.430 | 0.642 | 0.489 | 0.338 |
| laptop | 416 | 0.408 | 0.613 | 0.556 | 0.358 |
| smart_watch | 665 | 1.000 | 0.000 | 0.525 | 0.257 |
| normal_watch | 242 | 0.326 | 0.450 | 0.387 | 0.243 |
| notes_paper | 152 | 0.532 | 0.224 | 0.327 | 0.111 |
| electronic_gadget | 190 | 0.275 | 0.238 | 0.186 | 0.097 |
| **all** | | **0.495** | **0.361** | **0.412** | **0.234** |

Precision/recall are at Ultralytics' max-F1 confidence. Live alerts use stricter per-class thresholds (`ai/detection_policy.py`) plus multi-frame persistence, which trade recall for fewer false alerts.

Dataset composition, sources and licenses: [DATASETS.md](../DATASETS.md).
