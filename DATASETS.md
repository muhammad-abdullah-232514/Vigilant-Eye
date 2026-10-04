# Datasets used for the UFM object detector (ufm-od-v1)

All training data comes from **public datasets whose licenses permit use and adaptation** (CC BY 4.0, Public Domain, Open Images CC BY 4.0 annotations / CC BY 2.0 images). No YouTube / social-media footage of real people was scraped. Built by `ai/fetch_external_datasets.py`, `ai/fetch_openimages.py` and `ai/build_ufm_dataset.py`.

## Classes (ufm-od-taxonomy-v2)

| id | class | meaning | alert? |
|---:|---|---|---|
| 0 | mobile_phone | phone in hand / on desk / in lap | yes |
| 1 | laptop | laptop or tablet | yes |
| 2 | smart_watch | smartwatch / fitness tracker | yes |
| 3 | normal_watch | ordinary analog watch | **no** — trained so watches stop being mislabelled |
| 4 | notes_paper | chit / cheat sheet / passed paper | yes (review-biased) |
| 5 | electronic_gadget | earbuds, earphones, headsets | yes |

## Splits

| split | images | negatives (no box) | mobile_phone | laptop | smart_watch | normal_watch | notes_paper | electronic_gadget |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| train | 22995 | 3832 | 7567 | 3022 | 5853 | 2520 | 4390 | 1561 |
| val | 2380 | 396 | 696 | 415 | 755 | 234 | 143 | 193 |
| test | 2374 | 395 | 796 | 416 | 665 | 242 | 152 | 190 |

Splits are made per **image group** (all Roboflow augment copies of one photo, plus exact perceptual-hash duplicates across sources) so no photo leaks between train / val / test. Val and test keep a single copy per group.

## Sources and licenses

| source | license | train | val | test | class mapping (raw → ufm) |
|---|---|---:|---:|---:|---|
| [cheat-detect-system-exd63-v3](https://universe.roboflow.com/elgohary-5mdkx/cheat-detect-system-exd63/dataset/3) | Public Domain | 1506 | 101 | 107 | phone → mobile_phone, cheating-paper → notes_paper, hand-gestures → dropped, cheating → dropped, non-cheating → dropped |
| [cheating-detection-u2v47-htwjz-v3](https://universe.roboflow.com/cheating-detect/cheating-detection-u2v47-htwjz/dataset/3) | CC BY 4.0 | 1690 | 202 | 231 | cell phone → mobile_phone, talking → dropped, normal → dropped |
| [phones-in-school-v1](https://universe.roboflow.com/infocomm-project-work/phones-in-school/dataset/1) | CC BY 4.0 | 462 | 20 | 18 | phones → mobile_phone, people → dropped |
| [cheating-gjiev-v1](https://universe.roboflow.com/jo-qyhte/cheating-gjiev/dataset/1) | CC BY 4.0 | 2503 | 168 | 184 | phone → image excluded, normal → dropped |
| [exam_cheating-keaor-v2](https://universe.roboflow.com/behavior-cheating/exam_cheating-keaor/dataset/2) | CC BY 4.0 | 49 | 5 | 6 | cheat_paper → notes_paper, use_phone → image excluded, normal → dropped, look_around → dropped |
| [cheating-detection-during-exams-v1](https://universe.roboflow.com/fyp-6zwpp/cheating-detection-during-exams/dataset/1) | CC BY 4.0 | 132 | 4 | 6 | smart_watch → smart_watch, mobile_phone → mobile_phone, mobile → mobile_phone, paper_exchange → dropped, suspicious → dropped, normal → dropped |
| [note-j4lga-v1](https://universe.roboflow.com/lgqtest/note-j4lga/dataset/1) | CC BY 4.0 | 97 | 3 | 2 | note → notes_paper |
| [smart-class-room-v3](https://universe.roboflow.com/project-5o9ot/smart-class-room/dataset/3) | CC BY 4.0 | 73 | 8 | 9 | phone → mobile_phone, laptop → laptop, student → dropped |
| [train_smartwatch_granular-v1](https://universe.roboflow.com/verdpoc/train_smartwatch_granular/dataset/1) | CC BY 4.0 | 4099 | 545 | 495 | garmin → smart_watch, samsung → smart_watch, apple → smart_watch |
| [smart-hpwfi-v1](https://universe.roboflow.com/detection-2s9hh/smart-hpwfi/dataset/1) | CC BY 4.0 | 605 | 71 | 62 | smart watch → smart_watch |
| [watch-ehz2l-v1](https://universe.roboflow.com/detection-2s9hh/watch-ehz2l/dataset/1) | CC BY 4.0 | 0 | 0 | 0 | smart watch → smart_watch, smart watch - v2 2024-02-26 12-01pm → smart_watch |
| [smartwatch-ft5gj-v1](https://universe.roboflow.com/perangkat-digital/smartwatch-ft5gj/dataset/1) | CC BY 4.0 | 80 | 13 | 12 | smartwatch → smart_watch |
| [wearables-v1](https://universe.roboflow.com/ai-object-and-human-detection/wearables/dataset/1) | CC BY 4.0 | 574 | 89 | 91 | watch → watch?, bag → dropped, cap → dropped, id-lace → dropped |
| [watch-detection-q8t3g-v3](https://universe.roboflow.com/bwsza1/watch-detection-q8t3g/dataset/3) | CC BY 4.0 | 45 | 2 | 3 | watch → watch? |
| [watch-waoqs-v1](https://universe.roboflow.com/k-utryg/watch-waoqs/dataset/1) | CC BY 4.0 | 338 | 14 | 16 | watch → watch? |
| [watch-2d2ud-s9qmt-v3](https://universe.roboflow.com/imran-jutt/watch-2d2ud-s9qmt/dataset/3) | CC BY 4.0 | 75 | 6 | 13 | wristwatch → watch? |
| [watch-cozrm-v1](https://universe.roboflow.com/project-qysdi/watch-cozrm/dataset/1) | CC BY 4.0 | 41 | 6 | 5 | watch → watch? |
| [audio_device_detection-v2](https://universe.roboflow.com/jilson/audio_device_detection/dataset/2) | CC BY 4.0 | 136 | 20 | 20 | earbuds → electronic_gadget, neckband → electronic_gadget, headset → electronic_gadget |
| [audio-device-detection-v1](https://universe.roboflow.com/jilson/audio-device-detection/dataset/1) | CC BY 4.0 | 18 | 7 | 2 | earbuds → electronic_gadget, neckband → electronic_gadget |
| [earphone-recognition-v1](https://universe.roboflow.com/object-recognition-u9v3w/earphone-recognition/dataset/1) | CC BY 4.0 | 78 | 14 | 5 | earphone → electronic_gadget |
| [cup-earphone-v1](https://universe.roboflow.com/hanzhou-7mktt/cup-earphone/dataset/1) | CC BY 4.0 | 30 | 4 | 4 | earphone → electronic_gadget, cup → dropped |
| [bottle-and-earbuds-v2](https://universe.roboflow.com/jobby/bottle-and-earbuds/dataset/2) | CC BY 4.0 | 14 | 1 | 1 | earbud → electronic_gadget, bottle → dropped |
| [earphones-rfglm-v2](https://universe.roboflow.com/workspace-b3plo/earphones-rfglm/dataset/2) | CC BY 4.0 | 17 | 2 | 3 | buds → electronic_gadget, adapter → dropped |
| [offline-exam-monitoring-4-v6](https://universe.roboflow.com/cp2-sgbvv/offline-exam-monitoring-4/dataset/6) | CC BY 4.0 | 2871 | 102 | 102 | phone → mobile_phone, cheating-paper → notes_paper, cheating → dropped, hand-normalmove → dropped, non-cheating → dropped |
| [wrist-watch-v4](https://universe.roboflow.com/wristwatchv2/wrist-watch-lky3p/dataset/4) | CC BY 4.0 | 820 | 75 | 66 | wrist watch → watch? |
| [openimages-v7-ufm](https://storage.googleapis.com/openimages/web/index.html) | Annotations CC BY 4.0; images CC BY 2.0 (per-image list in attribution.csv) | 6642 | 898 | 911 | mobile phone → mobile_phone, tablet computer → laptop, laptop → laptop, watch → watch?, headphones → electronic_gadget |

### Open Images V7 detail

9211 images; per-image author / license / Flickr URL listed in `ai/dataset/external/openimages-v7-ufm/attribution.csv`.

Image licenses: https://creativecommons.org/licenses/by/2.0/ (9211)

Buckets: headphones (1166), laptop (1499), mobile phone (2594), neg:glasses (500), neg:hand_on_face (700), neg:wall_clock (500), neg:writing (26), tablet computer (770), watch (1456)

## Quality controls

- Every source was inspected with label sample grids (`ai/runs/qa/*.jpg`).
- `cheating-gjiev`: its *phone* boxes enclose whole students with no phone visible → those images excluded; its *normal* exam-hall images kept as hard negatives.
- `cheating-5fs9b` (v2/v3) no longer contains the *chit* class → not used.
- `classroom-phone-detection` labels tablets/laptops as *phone* → not used (laptop is its own class).
- Behaviour-level boxes ("Use_phone" person boxes, "Cheating", "Talking" …) are never used as object boxes; where the object inside them is unlabeled the image is excluded.
- Generic *watch* boxes (Open Images, wrist-watch, wearables …) are split into smart_watch / normal_watch by a CLIP ViT-B/32 zero-shot crop classifier (smart ≥ 0.92, normal ≥ 0.75); ambiguous crops drop the image. Result: {'ambiguous': 2156, 'smart_watch': 877, 'normal_watch': 3529}.
- Hard negatives: students writing (pen + hand), hands on face, glasses, wall clocks (Open Images), plus exam-hall *Non-Cheating* / *normal* images from the Roboflow sets.
- `watch-ehz2l` contributes 0 images: every image is a perceptual-hash duplicate of `smart-hpwfi` (same publisher) and was merged by de-duplication.
- Only 26 Open Images *writing* (pen + hand) negatives exist after filtering; writing posture is mostly covered by the exam-hall *normal / non-cheating* negatives.

## Evaluation-only footage (not used for training)

Free stock clips under the [Pexels License](https://www.pexels.com/license/) (free to use, no attribution required), listed in `ai/eval_videos/SOURCES.csv`: staged exam cheating with phones, cheat sheets, smartwatch use, and normal exam writing (negatives).

## Attribution

CC BY 4.0 sources require attribution: the table above links each Roboflow Universe dataset and its authors' workspace. Open Images: Kuznetsova et al., *The Open Images Dataset V4*, IJCV 2020; annotations © Google LLC, CC BY 4.0.
