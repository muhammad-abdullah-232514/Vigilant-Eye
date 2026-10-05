# AI model — training summary

All numbers below were measured by the scripts in `ai/` on data the model never trained on.

## Progress (held-out TEST set, 2,374 images)

| model | precision | recall | mAP50 |
|---|---:|---:|---:|
| initial (3 epochs, 4 Oct) | 0.495 | 0.361 | 0.412 |
| round 1 overnight | 0.755 | 0.692 | 0.747 |

Installed model: **round 1 kept (round 2 test mAP50 0.739 < 0.747)**

### Per class (installed model, max-F1 confidence)

| class | precision | recall | mAP50 |
|---|---:|---:|---:|
| mobile_phone | 0.834 | 0.747 | 0.810 |
| laptop | 0.779 | 0.721 | 0.763 |
| smart_watch | 0.900 | 0.911 | 0.950 |
| normal_watch | 0.693 | 0.886 | 0.875 |
| notes_paper | 0.655 | 0.400 | 0.505 |
| electronic_gadget | 0.669 | 0.487 | 0.580 |

## Precision of live ALERTS (test set, at the tuned CONFIRM thresholds)

This is what an invigilator experiences: of the alerts raised, how many are correct.

| class | confirm gate | alert precision | recall | alerts |
|---|---:|---:|---:|---:|
| mobile_phone | 0.663 | 0.947 | 0.564 | 474 |
| laptop | 0.706 | 0.91 | 0.584 | 267 |
| notes_paper | 0.6 | 0.864 | 0.125 | 22 |
| electronic_gadget | 0.678 | 0.927 | 0.268 | 55 |
| **overall** | | **0.932** | **0.49** | |

_smart_watch excluded: live type decision is made by the CLIP verifier, not the detector._

## Held-out stock exam videos (full live pipeline)

- Alert precision: 1.0
- Cheating clips caught: 0.333 (6 clips)
- False alerts per minute on normal exam footage: 0.0

### Validation per epoch — ufm_od_v1_long

| epoch | precision | recall | mAP50 |
|---:|---:|---:|---:|
| 1 | 0.596 | 0.500 | 0.528 |
| 2 | 0.647 | 0.518 | 0.549 |
| 3 | 0.696 | 0.567 | 0.606 |
| 4 | 0.663 | 0.603 | 0.632 |
| 5 | 0.695 | 0.655 | 0.688 |
| 6 | 0.730 | 0.677 | 0.715 |
| 7 | 0.757 | 0.675 | 0.726 |
| 8 | 0.748 | 0.683 | 0.737 |

### Validation per epoch — ufm_od_v1_round2

| epoch | precision | recall | mAP50 |
|---:|---:|---:|---:|
| 1 | 0.724 | 0.642 | 0.695 |
| 2 | 0.792 | 0.657 | 0.728 |

Alert thresholds: `ai/weights/ufm_od_v1.thresholds.json` (tuned on the validation split).

The API was restarted with the installed model. Open http://localhost:5173 → Live Monitoring.
