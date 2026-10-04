"""
Download licensed public Roboflow Universe datasets for the UFM object detector.

Every source is listed in EXTERNAL_SOURCES with its license and how its raw
classes map onto ufm-od-taxonomy-v1. Mapping/merging happens in
build_ufm_dataset.py — this script only downloads (YOLOv8 export format).

Usage:
    python ai/fetch_external_datasets.py            # reads ROBOFLOW_API_KEY from env or backend/.env
    python ai/fetch_external_datasets.py --only smart-hpwfi
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parent
REPO_ROOT = AI_ROOT.parent
EXTERNAL_ROOT = AI_ROOT / "dataset" / "external"

# raw class name (lower-cased, stripped) -> ufm class | None (drop box)
# "__exclude_image__" marks behaviour-level boxes whose image must be dropped
# entirely, because the object inside the box (e.g. the phone) is unlabeled.
EXCLUDE = "__exclude_image__"

EXTERNAL_SOURCES: list[dict] = [
    # ---- mobile_phone / notes_paper (exam + classroom domain) ----
    {
        "workspace": "elgohary-5mdkx", "project": "cheat-detect-system-exd63", "version": 3,
        "license": "Public Domain",
        "map": {"phone": "mobile_phone", "cheating-paper": "notes_paper",
                "hand-gestures": None, "cheating": None, "non-cheating": None},
    },
    {
        "workspace": "cheating-detect", "project": "cheating-detection-u2v47-htwjz", "version": 3,
        "license": "CC BY 4.0",
        "map": {"cell phone": "mobile_phone", "talking": None, "normal": None},
    },
    {
        "workspace": "infocomm-project-work", "project": "phones-in-school", "version": 1,
        "license": "CC BY 4.0",
        "map": {"phones": "mobile_phone", "people": None},
    },
    {
        "workspace": "jo-qyhte", "project": "cheating-gjiev", "version": 1,
        "license": "CC BY 4.0",
        # QA: "phone" boxes enclose the whole student (no phone visible) -> exclude;
        # "normal" exam-hall images are kept as hard negatives.
        "map": {"phone": EXCLUDE, "normal": None},
    },
    {
        "workspace": "behavior-cheating", "project": "exam_cheating-keaor", "version": 2,
        "license": "CC BY 4.0",
        "map": {"cheat_paper": "notes_paper", "use_phone": EXCLUDE,
                "normal": None, "look_around": None},
    },
    {
        "workspace": "fyp-6zwpp", "project": "cheating-detection-during-exams", "version": 1,
        "license": "CC BY 4.0",
        "map": {"smart_watch": "smart_watch", "mobile_phone": "mobile_phone", "mobile": "mobile_phone",
                "paper_exchange": None, "suspicious": None, "normal": None},
    },
    {
        "workspace": "lgqtest", "project": "note-j4lga", "version": 1,
        "license": "CC BY 4.0",
        "map": {"note": "notes_paper"},
    },
    {
        "workspace": "project-5o9ot", "project": "smart-class-room", "version": 3,
        "license": "CC BY 4.0",
        "map": {"phone": "mobile_phone", "laptop": "laptop", "student": None},
    },
    # ---- smart_watch ----
    {
        "workspace": "verdpoc", "project": "train_smartwatch_granular", "version": 1,
        "license": "CC BY 4.0",
        "map": {"garmin": "smart_watch", "samsung": "smart_watch", "apple": "smart_watch"},
    },
    {
        "workspace": "detection-2s9hh", "project": "smart-hpwfi", "version": 1,
        "license": "CC BY 4.0",
        "map": {"smart watch": "smart_watch"},
    },
    {
        "workspace": "detection-2s9hh", "project": "watch-ehz2l", "version": 1,
        "license": "CC BY 4.0",
        "map": {"smart watch": "smart_watch", "smart watch - v2 2024-02-26 12-01pm": "smart_watch"},
    },
    {
        "workspace": "perangkat-digital", "project": "smartwatch-ft5gj", "version": 1,
        "license": "CC BY 4.0",
        "map": {"smartwatch": "smart_watch"},
    },
    # ---- generic watches: split into smart/normal by CLIP crop filter ----
    {
        "workspace": "ai-object-and-human-detection", "project": "wearables", "version": 1,
        "license": "CC BY 4.0",
        "map": {"watch": "watch?", "bag": None, "cap": None, "id-lace": None},
    },
    {
        "workspace": "bwsza1", "project": "watch-detection-q8t3g", "version": 3,
        "license": "CC BY 4.0",
        "map": {"watch": "watch?"},
    },
    {
        "workspace": "k-utryg", "project": "watch-waoqs", "version": 1,
        "license": "CC BY 4.0",
        "map": {"watch": "watch?"},
    },
    {
        "workspace": "imran-jutt", "project": "watch-2d2ud-s9qmt", "version": 3,
        "license": "CC BY 4.0",
        "map": {"wristwatch": "watch?"},
    },
    {
        "workspace": "project-qysdi", "project": "watch-cozrm", "version": 1,
        "license": "CC BY 4.0",
        "map": {"watch": "watch?"},
    },
    # ---- electronic_gadget (earbuds / earpieces / headsets) ----
    {
        "workspace": "jilson", "project": "audio_device_detection", "version": 2,
        "license": "CC BY 4.0",
        "map": {"earbuds": "electronic_gadget", "neckband": "electronic_gadget",
                "headset": "electronic_gadget"},
    },
    {
        "workspace": "jilson", "project": "audio-device-detection", "version": 1,
        "license": "CC BY 4.0",
        "map": {"earbuds": "electronic_gadget", "neckband": "electronic_gadget"},
    },
    {
        "workspace": "object-recognition-u9v3w", "project": "earphone-recognition", "version": 1,
        "license": "CC BY 4.0",
        "map": {"earphone": "electronic_gadget"},
    },
    {
        "workspace": "hanzhou-7mktt", "project": "cup-earphone", "version": 1,
        "license": "CC BY 4.0",
        "map": {"earphone": "electronic_gadget", "cup": None},
    },
    {
        "workspace": "jobby", "project": "bottle-and-earbuds", "version": 2,
        "license": "CC BY 4.0",
        "map": {"earbud": "electronic_gadget", "bottle": None},
    },
    {
        "workspace": "workspace-b3plo", "project": "earphones-rfglm", "version": 2,
        "license": "CC BY 4.0",
        "map": {"buds": "electronic_gadget", "adapter": None},
    },
]


def source_slug(src: dict) -> str:
    return f"{src['project']}-v{src['version']}"


def load_api_key() -> str:
    key = os.getenv("ROBOFLOW_API_KEY", "").strip()
    if key:
        return key
    env_file = REPO_ROOT / "backend" / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("ROBOFLOW_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("ROBOFLOW_API_KEY not set (env or backend/.env)")


def _get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=120) as resp:
        return json.load(resp)


def export_link(src: dict, key: str) -> str:
    url = (
        f"https://api.roboflow.com/{src['workspace']}/{src['project']}/"
        f"{src['version']}/yolov8?api_key={key}"
    )
    for _ in range(40):  # export may need generating server-side
        data = _get_json(url)
        link = (data.get("export") or {}).get("link")
        if link:
            return link
        time.sleep(5)
    raise RuntimeError(f"export not ready: {data}")


def download(src: dict, key: str, force: bool = False) -> Path:
    dest = EXTERNAL_ROOT / source_slug(src)
    if (dest / "data.yaml").exists() and not force:
        print(f"[skip] {dest.name} (already downloaded)")
        return dest
    link = export_link(src, key)
    print(f"[get ] {dest.name}")
    with urllib.request.urlopen(link, timeout=600) as resp:
        blob = resp.read()
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        zf.extractall(dest)
    (dest / "SOURCE.json").write_text(
        json.dumps(
            {
                "url": f"https://universe.roboflow.com/{src['workspace']}/{src['project']}/dataset/{src['version']}",
                "license": src["license"],
                "class_map": src["map"],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return dest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="project slugs to fetch")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    key = load_api_key()
    failures = []
    for src in EXTERNAL_SOURCES:
        if args.only and src["project"] not in args.only:
            continue
        try:
            download(src, key, force=args.force)
        except Exception as exc:  # keep going; report at end
            failures.append((source_slug(src), repr(exc)))
            print(f"[FAIL] {source_slug(src)}: {exc}")
    if failures:
        print(f"\n{len(failures)} source(s) failed:")
        for slug, err in failures:
            print(f"  {slug}: {err[:200]}")


if __name__ == "__main__":
    main()
