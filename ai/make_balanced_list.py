"""
Class-balanced training list for ufm-od-v1 (oversampling, no new data).

Images containing an under-represented class are listed several times so the
detector sees rare classes (earbuds, notes, laptops) more often per epoch.
Val/test are untouched, so metrics stay comparable.

    .venv/bin/python ai/make_balanced_list.py   # -> ai/dataset/ufm_od_v1/data_balanced.yaml
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent / "dataset" / "ufm_od_v1"
# repeat factor per class id: 0 phone,1 laptop,2 smart,3 normal,4 notes,5 gadget
REPEAT = {0: 1, 1: 2, 2: 1, 3: 2, 4: 3, 5: 3}


def main() -> None:
    lines: list[str] = []
    boxes = Counter()
    for img in sorted((ROOT / "images" / "train").glob("*.jpg")):
        lbl = ROOT / "labels" / "train" / (img.stem + ".txt")
        classes = {int(l.split()[0]) for l in lbl.read_text().splitlines() if l.strip()} if lbl.exists() else set()
        k = max((REPEAT[c] for c in classes), default=1)
        lines += [str(img)] * k
        for c in classes:
            boxes[c] += k
    (ROOT / "train_balanced.txt").write_text("\n".join(lines) + "\n")
    cfg = yaml.safe_load((ROOT / "data.yaml").read_text())
    cfg.update(path=str(ROOT), train=str(ROOT / "train_balanced.txt"))
    (ROOT / "data_balanced.yaml").write_text(yaml.safe_dump(cfg, sort_keys=False))
    print(f"{len(lines)} training entries; images-with-class after oversampling: {dict(sorted(boxes.items()))}")


if __name__ == "__main__":
    main()
