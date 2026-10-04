"""
Build the ufm-od-v1 training set from licensed external sources.

Pipeline (deterministic, seed-free hashing):
  1. Read every source (ai/dataset/external/* + two local Roboflow exports).
  2. Remap raw classes -> ufm-od-taxonomy-v2 via each source's class map.
     Behaviour-level boxes whose object is unlabeled exclude the whole image.
  3. Generic "watch" boxes are split into smart_watch / normal_watch by a
     CLIP zero-shot crop classifier; ambiguous crops drop the image.
  4. Group Roboflow augment copies (same stem before ".rf.") and exact
     perceptual-hash duplicates; each group lands in exactly one split.
  5. 80/10/10 group split; val/test keep one copy per group (no augments).
  6. Negatives: only images whose original boxes were all "safe" classes
     (normal / bag / cup ...), capped at NEG_FRACTION of positives.
  7. Resize to MAX_SIDE, write YOLO dataset + data.yaml + manifest.json.

Run inside the API image (needs cv2, torch, open_clip_torch):
    python ai/build_ufm_dataset.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np

from fetch_external_datasets import EXCLUDE, EXTERNAL_ROOT, EXTERNAL_SOURCES, source_slug

AI_ROOT = Path(__file__).resolve().parent
LOCAL_ROOT = AI_ROOT / "dataset" / "ufm" / "dataset"
OUT_ROOT = AI_ROOT / "dataset" / "ufm_od_v1"

CLASSES = ["mobile_phone", "laptop", "smart_watch", "normal_watch", "notes_paper", "electronic_gadget"]
CLS_ID = {c: i for i, c in enumerate(CLASSES)}
WATCH_UNKNOWN = "watch?"

# Raw classes that mean "nothing prohibited here" — images whose boxes are all
# in this set may serve as hard negatives.
SAFE_NEGATIVE_RAW = {
    "non-cheating", "normal", "hand-normalmove", "bag", "cap", "id-lace",
    "cup", "bottle", "adapter", "student", "study", "people", "person",
}

LOCAL_SOURCES = [
    {
        "dir": LOCAL_ROOT / "offline-exam-monitoring-4",
        "slug": "offline-exam-monitoring-4-v6",
        "url": "https://universe.roboflow.com/cp2-sgbvv/offline-exam-monitoring-4/dataset/6",
        "license": "CC BY 4.0",
        "map": {"phone": "mobile_phone", "cheating-paper": "notes_paper",
                "cheating": None, "hand-normalmove": None, "non-cheating": None},
    },
    {
        "dir": LOCAL_ROOT / "wrist-watch",
        "slug": "wrist-watch-v4",
        "url": "https://universe.roboflow.com/wristwatchv2/wrist-watch-lky3p/dataset/4",
        "license": "CC BY 4.0",
        "map": {"wrist watch": WATCH_UNKNOWN},
    },
    {
        "dir": EXTERNAL_ROOT / "openimages-v7-ufm",
        "slug": "openimages-v7-ufm",
        "url": "https://storage.googleapis.com/openimages/web/index.html",
        "license": "Annotations CC BY 4.0; images CC BY 2.0 (per-image list in attribution.csv)",
        # tablets share the laptop class ("using a laptop/tablet" behaviour)
        "map": {"mobile phone": "mobile_phone", "tablet computer": "laptop",
                "laptop": "laptop", "watch": WATCH_UNKNOWN,
                "headphones": "electronic_gadget"},
    },
]

MAX_SIDE = 832
NEG_FRACTION = 0.20
SPLIT_RATIOS = (0.8, 0.1, 0.1)
CLIP_CONF = 0.75          # normal_watch
CLIP_CONF_SMART = 0.92    # stricter: a wrong smart_watch label becomes a false alarm
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ---------------------------------------------------------------- sources
def read_names(data_yaml: Path) -> list[str]:
    import yaml

    data = yaml.safe_load(data_yaml.read_text(encoding="utf-8"))
    names = data["names"]
    if isinstance(names, dict):
        names = [names[k] for k in sorted(names)]
    return [str(n) for n in names]


def iter_sources():
    for src in EXTERNAL_SOURCES:
        root = EXTERNAL_ROOT / source_slug(src)
        if not (root / "data.yaml").exists():
            print(f"[warn] missing download: {root.name}")
            continue
        meta = json.loads((root / "SOURCE.json").read_text(encoding="utf-8"))
        yield {"dir": root, "slug": root.name, "url": meta["url"],
               "license": src["license"], "map": src["map"]}
    for src in LOCAL_SOURCES:
        if (src["dir"] / "data.yaml").exists():
            yield src


def group_key(slug: str, name: str) -> str:
    stem = Path(name).stem
    stem = re.split(r"\.rf\.", stem)[0]
    return f"{slug}:{stem}"


def collect(src: dict) -> list[dict]:
    names = read_names(src["dir"] / "data.yaml")
    cmap = {k.strip().lower(): v for k, v in src["map"].items()}
    unknown = Counter()
    items = []
    for img in sorted(src["dir"].rglob("*")):
        if img.suffix.lower() not in IMG_EXT or img.parent.name != "images":
            continue
        lbl = img.parent.parent / "labels" / (img.stem + ".txt")
        raw_classes, boxes, excluded = [], [], False
        if lbl.exists():
            for line in lbl.read_text(encoding="utf-8").splitlines():
                parts = line.split()
                if len(parts) < 5:
                    continue
                try:
                    cid = int(float(parts[0]))
                    coords = [float(x) for x in parts[1:]]
                except ValueError:
                    continue
                if not 0 <= cid < len(names):
                    continue
                raw = names[cid].strip().lower()
                raw_classes.append(raw)
                if raw not in cmap:
                    unknown[raw] += 1
                    excluded = True  # unmapped class: be conservative
                    continue
                target = cmap[raw]
                if target == EXCLUDE:
                    excluded = True
                    continue
                if target is None:
                    continue
                if len(coords) > 4:  # polygon -> bbox
                    xs, ys = coords[0::2], coords[1::2]
                    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
                    coords = [(x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0]
                xc, yc, w, h = coords
                x0, y0 = max(0.0, xc - w / 2), max(0.0, yc - h / 2)
                x1, y1 = min(1.0, xc + w / 2), min(1.0, yc + h / 2)
                if x1 - x0 < 0.004 or y1 - y0 < 0.004:
                    continue
                boxes.append([target, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0])
        if excluded:
            continue
        safe_neg = not boxes and all(r in SAFE_NEGATIVE_RAW for r in raw_classes)
        if not boxes and not safe_neg:
            continue
        items.append({
            "path": img, "source": src["slug"], "group": group_key(src["slug"], img.name),
            "boxes": boxes, "negative": not boxes,
        })
    if unknown:
        print(f"[warn] {src['slug']}: unmapped classes excluded images: {dict(unknown)}")
    return items


# ---------------------------------------------------------------- CLIP watch split
class WatchClassifier:
    SMART = [
        "a photo of a smartwatch with a digital touchscreen display",
        "a photo of an apple watch on a wrist",
        "a photo of a fitness tracker band",
    ]
    NORMAL = [
        "a photo of an analog wristwatch with clock hands",
        "a photo of a classic wristwatch with a round dial",
        "a photo of a mechanical watch on a wrist",
    ]

    def __init__(self):
        import open_clip
        import torch

        self.torch = torch
        self.model, _, self.prep = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="laion2b_s34b_b79k"
        )
        self.model.eval()
        tok = open_clip.get_tokenizer("ViT-B-32")
        with torch.no_grad():
            t = self.model.encode_text(tok(self.SMART + self.NORMAL))
            self.text = t / t.norm(dim=-1, keepdim=True)

    def classify(self, crops: list[np.ndarray]) -> list[tuple[str | None, float]]:
        from PIL import Image

        torch = self.torch
        batch = torch.stack([self.prep(Image.fromarray(c[:, :, ::-1])) for c in crops])
        with torch.no_grad():
            f = self.model.encode_image(batch)
            f = f / f.norm(dim=-1, keepdim=True)
            probs = (100.0 * f @ self.text.T).softmax(dim=-1).numpy()
        n = len(self.SMART)
        out = []
        for p in probs:
            ps, pn = float(p[:n].sum()), float(p[n:].sum())
            if ps >= CLIP_CONF_SMART:
                out.append(("smart_watch", ps))
            elif pn >= CLIP_CONF:
                out.append(("normal_watch", pn))
            else:
                out.append((None, max(ps, pn)))
        return out


def crop(img: np.ndarray, box: list) -> np.ndarray:
    h, w = img.shape[:2]
    _, xc, yc, bw, bh = box
    pad = 0.15
    x0 = int(max(0, (xc - bw / 2 - bw * pad) * w)); x1 = int(min(w, (xc + bw / 2 + bw * pad) * w))
    y0 = int(max(0, (yc - bh / 2 - bh * pad) * h)); y1 = int(min(h, (yc + bh / 2 + bh * pad) * h))
    return img[y0:max(y1, y0 + 2), x0:max(x1, x0 + 2)]


def resolve_watches(items: list[dict]) -> Counter:
    stats = Counter()
    pending = [it for it in items if any(b[0] == WATCH_UNKNOWN for b in it["boxes"])]
    if not pending:
        return stats
    clf = WatchClassifier()
    for i, it in enumerate(pending):
        img = cv2.imread(str(it["path"]))
        if img is None:
            it["drop"] = True
            continue
        idx = [k for k, b in enumerate(it["boxes"]) if b[0] == WATCH_UNKNOWN]
        results = clf.classify([crop(img, it["boxes"][k]) for k in idx])
        for k, (label, _) in zip(idx, results):
            if label is None:
                it["drop"] = True
                stats["ambiguous"] += 1
            else:
                it["boxes"][k][0] = label
                stats[label] += 1
        if i % 500 == 0:
            print(f"  CLIP watches {i}/{len(pending)} {dict(stats)}")
    return stats


# ---------------------------------------------------------------- dedupe + split
def dhash(path: Path) -> str | None:
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    small = cv2.resize(img, (17, 16), interpolation=cv2.INTER_AREA)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return np.packbits(bits).tobytes().hex()


def merge_duplicate_groups(items: list[dict]) -> int:
    parent: dict[str, str] = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_hash = defaultdict(list)
    for it in items:
        h = dhash(it["path"])
        if h is None:
            it["drop"] = True
            continue
        it["hash"] = h
        by_hash[h].append(it["group"])
    merged = 0
    for groups in by_hash.values():
        for g in groups[1:]:
            a, b = find(groups[0]), find(g)
            if a != b:
                parent[b] = a
                merged += 1
    for it in items:
        it["group"] = find(it["group"])
    return merged


def split_of(group: str) -> str:
    h = int(hashlib.sha1(group.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    if h < SPLIT_RATIOS[0]:
        return "train"
    if h < SPLIT_RATIOS[0] + SPLIT_RATIOS[1]:
        return "val"
    return "test"


# ---------------------------------------------------------------- write
def write_item(it: dict, split: str, out: Path) -> bool:
    img = cv2.imread(str(it["path"]))
    if img is None:
        return False
    h, w = img.shape[:2]
    s = MAX_SIDE / max(h, w)
    if s < 1:
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    name = hashlib.sha1(f"{it['source']}/{it['path'].name}".encode()).hexdigest()[:16]
    name = f"{it['source'][:24]}_{name}"
    cv2.imwrite(str(out / "images" / split / f"{name}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    lines = [f"{CLS_ID[b[0]]} {b[1]:.6f} {b[2]:.6f} {b[3]:.6f} {b[4]:.6f}" for b in it["boxes"]]
    (out / "labels" / split / f"{name}.txt").write_text("\n".join(lines) + ("\n" if lines else ""))
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT_ROOT)
    args = ap.parse_args()
    out: Path = args.out

    sources = list(iter_sources())
    items: list[dict] = []
    for src in sources:
        got = collect(src)
        print(f"[src ] {src['slug']}: {len(got)} usable images")
        items.extend(got)

    watch_stats = resolve_watches(items)
    items = [it for it in items if not it.get("drop")]
    print(f"[clip] watches: {dict(watch_stats)}")

    merged = merge_duplicate_groups(items)
    items = [it for it in items if not it.get("drop")]
    print(f"[dup ] merged {merged} duplicate groups")

    # one copy per group outside train; cap negatives
    by_group = defaultdict(list)
    for it in items:
        by_group[it["group"]].append(it)
    rng = random.Random(0)
    chosen = {"train": [], "val": [], "test": []}
    for g, members in sorted(by_group.items()):
        split = split_of(g)
        members.sort(key=lambda x: str(x["path"]))
        if split == "train":
            seen = set()
            for m in members:  # drop exact pixel-duplicates inside a group
                if m["hash"] not in seen:
                    seen.add(m["hash"])
                    chosen["train"].append(m)
        else:
            chosen[split].append(members[0])
    for split, lst in chosen.items():
        pos = [x for x in lst if not x["negative"]]
        neg = [x for x in lst if x["negative"]]
        rng.shuffle(neg)
        chosen[split] = pos + neg[: int(len(pos) * NEG_FRACTION)]

    if out.exists():
        shutil.rmtree(out)
    for split in chosen:
        (out / "images" / split).mkdir(parents=True)
        (out / "labels" / split).mkdir(parents=True)

    manifest = {"dataset_version": "ufm-od-v1", "taxonomy": "ufm-od-taxonomy-v2",
                "classes": CLASSES, "splits": {}, "sources": []}
    per_source = defaultdict(Counter)
    for split, lst in chosen.items():
        counts = Counter()
        n_img = n_neg = 0
        for it in lst:
            if not write_item(it, split, out):
                continue
            n_img += 1
            n_neg += it["negative"]
            per_source[it["source"]][split] += 1
            for b in it["boxes"]:
                counts[b[0]] += 1
        manifest["splits"][split] = {"images": n_img, "negatives": n_neg,
                                     "boxes": {c: counts[c] for c in CLASSES}}
        print(f"[out ] {split}: {n_img} images ({n_neg} negatives) {dict(counts)}")
    for src in sources:
        manifest["sources"].append({"slug": src["slug"], "url": src["url"],
                                    "license": src["license"],
                                    "images": dict(per_source[src["slug"]])})
    manifest["watch_clip_split"] = dict(watch_stats)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (out / "data.yaml").write_text(
        "# ufm-od-v1 — built by ai/build_ufm_dataset.py (see manifest.json for sources/licenses)\n"
        "train: images/train\nval: images/val\ntest: images/test\nnames:\n"
        + "".join(f"  {i}: {c}\n" for i, c in enumerate(CLASSES)),
        encoding="utf-8",
    )
    print(f"[done] {out}")


if __name__ == "__main__":
    main()
