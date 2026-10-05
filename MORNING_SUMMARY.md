# Morning summary — overnight training

Finished: 2026-10-05T09:11:44 · weights `ai/weights/ufm_od_v1.pt` (previous model backed up as `ai/weights/ufm_od_v1.before_*.pt`)
Epochs this run: 8

## Held-out TEST set (2,374 images never used in training)

| class | precision | recall | mAP50 |
|---|---:|---:|---:|
| mobile_phone | 0.834 | 0.747 | 0.810 |
| laptop | 0.779 | 0.721 | 0.763 |
| smart_watch | 0.900 | 0.911 | 0.950 |
| normal_watch | 0.693 | 0.886 | 0.875 |
| notes_paper | 0.655 | 0.400 | 0.505 |
| electronic_gadget | 0.669 | 0.487 | 0.580 |
| **overall** | **0.755** | **0.692** | **0.747** |

Previous model (3 epochs): overall precision 0.495, recall 0.361, mAP50 0.412.

## Live alert gates (tuned on validation for 95% precision)

| class | REVIEW ≥ | CONFIRM ≥ | val recall at CONFIRM | 95% reached |
|---|---:|---:|---:|---|
| mobile_phone | 0.397 | 0.663 | 0.516 | False |
| laptop | 0.472 | 0.706 | 0.596 | False |
| smart_watch | 0.3 | 0.45 | — | — |
| notes_paper | 0.4 | 0.6 | 0.157 | False |
| electronic_gadget | 0.412 | 0.678 | 0.309 | False |

## Held-out stock exam videos (live alert logic)

- Event precision: 1.0
- Cheating clips caught: 0.333 of 6
- False alerts per minute on normal exam footage: 0.0

API restarted with the new model (`./scripts/start-mac.sh restart`). Open http://localhost:5173 → Live Monitoring.
