"""Generate DATASETS.md (sources, licenses, class mapping, split counts) from the build manifest."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

from build_ufm_dataset import LOCAL_SOURCES, OUT_ROOT
from fetch_external_datasets import EXTERNAL_SOURCES, source_slug

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    manifest = json.loads((OUT_ROOT / "manifest.json").read_text())
    maps = {source_slug(s): s["map"] for s in EXTERNAL_SOURCES}
    maps.update({s["slug"]: s["map"] for s in LOCAL_SOURCES})

    lines = [
        "# Datasets used for the UFM object detector (ufm-od-v1)",
        "",
        "All training data comes from **public datasets whose licenses permit use and adaptation** "
        "(CC BY 4.0, Public Domain, Open Images CC BY 4.0 annotations / CC BY 2.0 images). "
        "No YouTube / social-media footage of real people was scraped. Built by "
        "`ai/fetch_external_datasets.py`, `ai/fetch_openimages.py` and `ai/build_ufm_dataset.py`.",
        "",
        "## Classes (ufm-od-taxonomy-v2)",
        "",
        "| id | class | meaning | alert? |",
        "|---:|---|---|---|",
        "| 0 | mobile_phone | phone in hand / on desk / in lap | yes |",
        "| 1 | laptop | laptop or tablet | yes |",
        "| 2 | smart_watch | smartwatch / fitness tracker | yes |",
        "| 3 | normal_watch | ordinary analog watch | **no** — trained so watches stop being mislabelled |",
        "| 4 | notes_paper | chit / cheat sheet / passed paper | yes (review-biased) |",
        "| 5 | electronic_gadget | earbuds, earphones, headsets | yes |",
        "",
        "## Splits",
        "",
        "| split | images | negatives (no box) | " + " | ".join(manifest["classes"]) + " |",
        "|---|---:|---:|" + "---:|" * len(manifest["classes"]),
    ]
    for split, d in manifest["splits"].items():
        lines.append(f"| {split} | {d['images']} | {d['negatives']} | "
                     + " | ".join(str(d["boxes"][c]) for c in manifest["classes"]) + " |")
    lines += [
        "",
        "Splits are made per **image group** (all Roboflow augment copies of one photo, plus exact "
        "perceptual-hash duplicates across sources) so no photo leaks between train / val / test. "
        "Val and test keep a single copy per group.",
        "",
        "## Sources and licenses",
        "",
        "| source | license | train | val | test | class mapping (raw → ufm) |",
        "|---|---|---:|---:|---:|---|",
    ]
    for src in manifest["sources"]:
        imgs = src["images"]
        cmap = maps.get(src["slug"], {})
        mapping = ", ".join(
            f"{k} → {v if v not in (None, '__exclude_image__') else ('dropped' if v is None else 'image excluded')}"
            for k, v in cmap.items()
        )
        lines.append(f"| [{src['slug']}]({src['url']}) | {src['license']} | {imgs.get('train', 0)} "
                     f"| {imgs.get('val', 0)} | {imgs.get('test', 0)} | {mapping} |")

    attrib = ROOT / "ai" / "dataset" / "external" / "openimages-v7-ufm" / "attribution.csv"
    if attrib.exists():
        with attrib.open() as f:
            rows = list(csv.DictReader(f))
        lic = Counter(r["license"] for r in rows)
        buckets = Counter(r["bucket"] for r in rows)
        lines += [
            "",
            "### Open Images V7 detail",
            "",
            f"{len(rows)} images; per-image author / license / Flickr URL listed in "
            "`ai/dataset/external/openimages-v7-ufm/attribution.csv`.",
            "",
            "Image licenses: " + ", ".join(f"{k} ({v})" for k, v in lic.most_common()),
            "",
            "Buckets: " + ", ".join(f"{k} ({v})" for k, v in sorted(buckets.items())),
        ]

    lines += [
        "",
        "## Quality controls",
        "",
        "- Every source was inspected with label sample grids (`ai/runs/qa/*.jpg`).",
        "- `cheating-gjiev`: its *phone* boxes enclose whole students with no phone visible → those images "
        "excluded; its *normal* exam-hall images kept as hard negatives.",
        "- `cheating-5fs9b` (v2/v3) no longer contains the *chit* class → not used.",
        "- `classroom-phone-detection` labels tablets/laptops as *phone* → not used (laptop is its own class).",
        "- Behaviour-level boxes (\"Use_phone\" person boxes, \"Cheating\", \"Talking\" …) are never used as "
        "object boxes; where the object inside them is unlabeled the image is excluded.",
        "- Generic *watch* boxes (Open Images, wrist-watch, wearables …) are split into smart_watch / "
        "normal_watch by a CLIP ViT-B/32 zero-shot crop classifier (smart ≥ 0.92, normal ≥ 0.75); "
        f"ambiguous crops drop the image. Result: {manifest.get('watch_clip_split', {})}.",
        "- Hard negatives: students writing (pen + hand), hands on face, glasses, wall clocks (Open Images), "
        "plus exam-hall *Non-Cheating* / *normal* images from the Roboflow sets.",
        "- `watch-ehz2l` contributes 0 images: every image is a perceptual-hash duplicate of `smart-hpwfi` "
        "(same publisher) and was merged by de-duplication.",
        "- Only 26 Open Images *writing* (pen + hand) negatives exist after filtering; writing posture is "
        "mostly covered by the exam-hall *normal / non-cheating* negatives.",
        "",
        "## Evaluation-only footage (not used for training)",
        "",
        "Free stock clips under the [Pexels License](https://www.pexels.com/license/) (free to use, no "
        "attribution required), listed in `ai/eval_videos/SOURCES.csv`: staged exam cheating with phones, "
        "cheat sheets, smartwatch use, and normal exam writing (negatives).",
        "",
        "## Attribution",
        "",
        "CC BY 4.0 sources require attribution: the table above links each Roboflow Universe dataset and "
        "its authors' workspace. Open Images: Kuznetsova et al., *The Open Images Dataset V4*, IJCV 2020; "
        "annotations © Google LLC, CC BY 4.0.",
        "",
    ]
    (ROOT / "DATASETS.md").write_text("\n".join(lines), encoding="utf-8")
    print(ROOT / "DATASETS.md")


if __name__ == "__main__":
    main()
