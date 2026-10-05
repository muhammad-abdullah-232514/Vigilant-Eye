# UFM object detector — results (ufm-od-v1)

*Generated 2026-10-05T09:11:44 by `ai/train_ufm_local.py`.*

- Weights: `ai/runs/train/ufm_od_v1_long/weights/best.pt` (installed as `ai/weights/ufm_od_v1.pt`)
- Base model: `ai/weights/ufm_od_v1.pt` · imgsz 384 · device `cpu` · trained 8 epochs in 8.0 h budget
- Evaluation split: **test (held out, session/group-disjoint from train/val)**
- CPU inference: 46.9 ms / image

| Class | Test instances | Precision | Recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|---:|
| mobile_phone | 796 | 0.834 | 0.747 | 0.810 | 0.568 |
| laptop | 416 | 0.779 | 0.721 | 0.763 | 0.547 |
| smart_watch | 665 | 0.900 | 0.911 | 0.950 | 0.689 |
| normal_watch | 242 | 0.693 | 0.886 | 0.875 | 0.605 |
| notes_paper | 152 | 0.655 | 0.400 | 0.505 | 0.177 |
| electronic_gadget | 190 | 0.669 | 0.487 | 0.580 | 0.349 |
| **all** | | **0.755** | **0.692** | **0.747** | **0.489** |

Precision/recall are at Ultralytics' max-F1 confidence. Live alerts use stricter per-class thresholds (`ai/detection_policy.py`) plus multi-frame persistence, which trade recall for fewer false alerts.

Dataset composition, sources and licenses: [DATASETS.md](../DATASETS.md).
