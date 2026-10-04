"""
Fetch an Open Images V7 subset (validation + test splits, human-verified boxes)
for the UFM detector, plus behaviour-confusable hard negatives.

Positives (raw class -> ufm class, mapped in build_ufm_dataset.py):
  Mobile phone -> mobile_phone; Tablet computer / Laptop -> laptop
  Watch                                   -> watch? (CLIP smart/normal split)
  Headphones                              -> electronic_gadget
Negatives (no prohibited box, verified-absent where Open Images verified it):
  writing      : Pen + Human hand
  hand_on_face : Human hand box overlapping a Human face box
  glasses      : Glasses + Human face
  wall_clock   : Clock

Licenses: annotations CC BY 4.0 (Google); every image's own license, author and
landing URL are written to attribution.csv (mostly CC BY 2.0 via Flickr).

Usage: python ai/fetch_openimages.py   (stdlib only)
"""

from __future__ import annotations

import csv
import json
import random
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parent
META = AI_ROOT / "dataset" / "openimages" / "meta"
OUT = AI_ROOT / "dataset" / "external" / "openimages-v7-ufm"

CLS = {
    "/m/050k8": "mobile phone",
    "/m/0bh9flk": "tablet computer",
    "/m/01c648": "laptop",
    "/m/0gjkl": "watch",
    "/m/01b7fy": "headphones",
}
NAMES = list(dict.fromkeys(CLS.values()))
PEN, HAND, FACE, GLASSES, CLOCK = "/m/0k1tl", "/m/0k65p", "/m/0dzct", "/m/0jyfg", "/m/01x3z"
CAPS = {"mobile phone": 2600, "tablet computer": 900, "laptop": 1500, "watch": 2600, "headphones": 1300}
NEG_CAPS = {"writing": 700, "hand_on_face": 700, "glasses": 500, "wall_clock": 500}
SPLITS = tuple(s for s in ("train", "validation", "test")
               if (META / f"{s}-images-with-rotation.csv").exists())


def load_rows(name: str):
    with open(META / name, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def main() -> None:
    rng = random.Random(0)
    boxes = defaultdict(list)  # image -> [(label, xmin, xmax, ymin, ymax)]
    bad = set()  # images with group-of / depiction boxes for our classes
    for split in SPLITS:
        for r in load_rows(f"{split}-annotations-bbox.csv"):
            lab = r["LabelName"]
            if lab not in CLS and lab not in {PEN, HAND, FACE, GLASSES, CLOCK}:
                continue
            key = (split, r["ImageID"])
            if lab in CLS and (r["IsGroupOf"] == "1" or r["IsDepiction"] == "1"):
                bad.add(key)
            boxes[key].append((lab, *(float(r[k]) for k in ("XMin", "XMax", "YMin", "YMax"))))

    positive_label = set()  # images verified to contain a prohibited class
    for split in SPLITS:
        for r in load_rows(f"{split}-annotations-human-imagelabels-boxable.csv"):
            if r["LabelName"] in CLS and r["Confidence"] == "1":
                positive_label.add((split, r["ImageID"]))

    meta = {}
    for split in SPLITS:
        for r in load_rows(f"{split}-images-with-rotation.csv"):
            if r["Rotation"] not in ("", "0", "0.0"):
                continue
            meta[(split, r["ImageID"])] = r

    by_class = defaultdict(list)
    negs = defaultdict(list)
    for key, bl in boxes.items():
        if key in bad or key not in meta:
            continue
        labels = {b[0] for b in bl}
        prohibited = labels & CLS.keys()
        if prohibited:
            # bucket by rarest class present so caps balance classes
            for lab in sorted(prohibited, key=lambda l: CAPS[CLS[l]]):
                by_class[CLS[lab]].append(key)
                break
            continue
        if key in positive_label:
            continue  # contains a prohibited object without a box -> unsafe negative
        if CLOCK in labels:
            negs["wall_clock"].append(key)
        elif PEN in labels and HAND in labels:
            negs["writing"].append(key)
        elif GLASSES in labels and FACE in labels:
            negs["glasses"].append(key)
        elif HAND in labels and FACE in labels:
            hands = [b for b in bl if b[0] == HAND]
            faces = [b for b in bl if b[0] == FACE]
            if any(h[1] < f[2] and f[1] < h[2] and h[3] < f[4] and f[3] < h[4] for h in hands for f in faces):
                negs["hand_on_face"].append(key)

    chosen = []
    for name, keys in by_class.items():
        rng.shuffle(keys)
        chosen += [(k, name) for k in keys[: CAPS[name]]]
        print(f"positive {name:16s} available={len(keys):5d} taken={min(len(keys), CAPS[name])}")
    for name, keys in negs.items():
        rng.shuffle(keys)
        chosen += [(k, f"neg:{name}") for k in keys[: NEG_CAPS[name]]]
        print(f"negative {name:16s} available={len(keys):5d} taken={min(len(keys), NEG_CAPS[name])}")

    img_dir, lbl_dir = OUT / "train" / "images", OUT / "train" / "labels"
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    def fetch(item):
        (split, iid), bucket = item
        dst = img_dir / f"{iid}.jpg"
        if not dst.exists():
            m = meta[(split, iid)]
            urls = [m["Thumbnail300KURL"], f"https://open-images-dataset.s3.amazonaws.com/{split}/{iid}.jpg"]
            for url in filter(None, urls):
                try:
                    with urllib.request.urlopen(url, timeout=60) as resp:
                        data = resp.read()
                    if len(data) > 5000:
                        dst.write_bytes(data)
                        break
                except Exception:
                    continue
            else:
                return None
        lines = []
        for lab, x0, x1, y0, y1 in boxes[(split, iid)]:
            if lab in CLS:
                cid = NAMES.index(CLS[lab])
                lines.append(f"{cid} {(x0 + x1) / 2:.6f} {(y0 + y1) / 2:.6f} {x1 - x0:.6f} {y1 - y0:.6f}")
        (lbl_dir / f"{iid}.txt").write_text("\n".join(lines) + ("\n" if lines else ""))
        return (split, iid, bucket)

    done = []
    with ThreadPoolExecutor(16) as ex:
        for i, res in enumerate(ex.map(fetch, chosen)):
            if res:
                done.append(res)
            if i % 500 == 0:
                print(f"downloaded {i}/{len(chosen)}", flush=True)

    with open(OUT / "attribution.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["image_id", "split", "bucket", "license", "author", "landing_url"])
        for split, iid, bucket in done:
            m = meta[(split, iid)]
            w.writerow([iid, split, bucket, m["License"], m["Author"], m["OriginalLandingURL"]])
    (OUT / "data.yaml").write_text(
        "train: train/images\nval: train/images\nnames: " + json.dumps(NAMES) + "\n", encoding="utf-8"
    )
    (OUT / "SOURCE.json").write_text(json.dumps({
        "url": "https://storage.googleapis.com/openimages/web/index.html",
        "license": "Annotations CC BY 4.0; images per attribution.csv (Flickr CC BY 2.0)",
        "class_map": {n: n for n in NAMES},
    }, indent=2), encoding="utf-8")
    print(f"done: {len(done)}/{len(chosen)} images -> {OUT}")


if __name__ == "__main__":
    main()
