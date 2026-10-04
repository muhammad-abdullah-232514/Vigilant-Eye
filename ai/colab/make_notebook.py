"""Generate ai/colab/train_ufm_od_v1.ipynb (run: python ai/colab/make_notebook.py)."""

import json
from pathlib import Path

CELLS = [
    ("md", """# VigilantEye — UFM object detector training (ufm-od-v1)

Classes: `mobile_phone`, `laptop` (laptop/tablet), `smart_watch`, `normal_watch` (allowed — reduces false alarms), `notes_paper`, `electronic_gadget` (earbuds/headsets)

**Before running:**
1. Runtime → Change runtime type → **T4 GPU** (or better).
2. Upload `ufm_od_v1.zip` to **My Drive/VigilantEye/** in Google Drive.
3. Runtime → **Run all**. Results are saved to `My Drive/VigilantEye/runs/` (survives disconnects; re-running resumes)."""),
    ("code", """# 1. Setup
!nvidia-smi -L
!pip -q install ultralytics==8.4.126
from google.colab import drive
drive.mount('/content/drive')
DRIVE = '/content/drive/MyDrive/VigilantEye'
import os; os.makedirs(f'{DRIVE}/runs', exist_ok=True)"""),
    ("code", """# 2. Unpack dataset to local disk (much faster than training from Drive)
!rm -rf /content/ufm_od_v1 && unzip -q {DRIVE}/ufm_od_v1.zip -d /content/
DATA = '/content/ufm_od_v1/data.yaml'
import yaml, json
cfg = yaml.safe_load(open(DATA)); cfg['path'] = '/content/ufm_od_v1'
yaml.safe_dump(cfg, open(DATA, 'w'), sort_keys=False)
print(json.dumps(json.load(open('/content/ufm_od_v1/manifest.json'))['splits'], indent=1))"""),
    ("code", """# 3. Train (YOLOv8s, 640px). Resumes automatically if a previous session was cut off.
from ultralytics import YOLO
from pathlib import Path
PROJECT, NAME = f'{DRIVE}/runs', 'ufm_od_v1_yolov8s'
last = Path(PROJECT) / NAME / 'weights' / 'last.pt'
if last.exists():
    model = YOLO(str(last)); model.train(resume=True)
else:
    model = YOLO('yolov8s.pt')
    model.train(
        data=DATA, imgsz=640, epochs=100, patience=25, batch=-1, cos_lr=True,
        close_mosaic=10, degrees=5, mixup=0.05, seed=0, deterministic=False,
        project=PROJECT, name=NAME, exist_ok=True, plots=True, workers=4,
    )"""),
    ("code", """# 4. Held-out TEST evaluation (never used for tuning)
best = f'{PROJECT}/{NAME}/weights/best.pt'
m = YOLO(best)
test = m.val(data=DATA, split='test', imgsz=640, plots=True, project=PROJECT, name=NAME + '_test', exist_ok=True)
names = m.names
rows = [{'class': names[i], 'precision': round(float(test.box.p[k]), 3), 'recall': round(float(test.box.r[k]), 3),
         'mAP50': round(float(test.box.ap50[k]), 3), 'mAP50-95': round(float(test.box.ap[k]), 3)}
        for k, i in enumerate(test.box.ap_class_index)]
summary = {'mAP50': round(float(test.box.map50), 4), 'mAP50-95': round(float(test.box.map), 4),
           'precision': round(float(test.box.mp), 4), 'recall': round(float(test.box.mr), 4), 'per_class': rows}
print(json.dumps(summary, indent=1))"""),
    ("code", """# 5. Per-class confidence thresholds tuned on VAL (target precision >= 0.90)
import numpy as np
v = m.val(data=DATA, split='val', imgsz=640, conf=0.001, plots=False, project=PROJECT, name=NAME + '_val', exist_ok=True)
px = np.linspace(0, 1, 1000)
thresholds = {}
for k, i in enumerate(v.box.ap_class_index):
    p, r = v.box.p_curve[k], v.box.r_curve[k]
    ok = np.where(p >= 0.90)[0]
    j = ok[np.argmax(r[ok])] if len(ok) else int(np.argmax(p))
    thresholds[names[i]] = {'conf': round(float(px[j]), 3), 'precision': round(float(p[j]), 3), 'recall': round(float(r[j]), 3)}
print(json.dumps(thresholds, indent=1))"""),
    ("code", """# 6. Package results -> My Drive/VigilantEye/ufm_od_v1_results.zip (download this)
import shutil
out = Path('/content/results'); shutil.rmtree(out, ignore_errors=True); out.mkdir()
shutil.copy(best, out / 'best.pt')
json.dump({'test': summary, 'val_thresholds_p90': thresholds, 'weights': 'yolov8s', 'imgsz': 640,
           'dataset_manifest': json.load(open('/content/ufm_od_v1/manifest.json'))},
          open(out / 'metrics.json', 'w'), indent=2)
for f in (Path(PROJECT) / NAME).glob('*.*'):
    if f.suffix in {'.csv', '.png', '.jpg', '.yaml'}: shutil.copy(f, out / f.name)
for f in (Path(PROJECT) / (NAME + '_test')).glob('*.png'): shutil.copy(f, out / ('test_' + f.name))
shutil.make_archive(f'{DRIVE}/ufm_od_v1_results', 'zip', out)
print('Saved', f'{DRIVE}/ufm_od_v1_results.zip')
print('Install: unzip, copy best.pt to <project>/ai/weights/ufm_od_v1.pt, restart the API.')"""),
]


def main():
    cells = []
    for kind, src in CELLS:
        cell = {"cell_type": "markdown" if kind == "md" else "code", "metadata": {},
                "source": src.splitlines(keepends=True)}
        if kind == "code":
            cell.update(outputs=[], execution_count=None)
        cells.append(cell)
    nb = {"cells": cells, "nbformat": 4, "nbformat_minor": 5,
          "metadata": {"accelerator": "GPU", "colab": {"gpuType": "T4"},
                       "kernelspec": {"name": "python3", "display_name": "Python 3"}}}
    out = Path(__file__).with_name("train_colab.ipynb")
    out.write_text(json.dumps(nb, indent=1), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
