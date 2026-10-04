"""
VigilantEye custom UFM detector classes + weight resolution.

Maps YOLO labels (custom or limited COCO aliases) -> portal categories.
Ordinary watches are NOT mapped to smart_watch (COCO cannot tell them apart).
"""

from __future__ import annotations

from pathlib import Path

AI_ROOT = Path(__file__).resolve().parent

# Target custom-detector vocabulary (train for these — do not invent under COCO)
UFM_CLASS_NAMES = [
    "mobile_phone",
    "laptop",  # laptops + tablets
    "smart_watch",
    "normal_watch",  # ALLOWED — required to stop watch↔phone confusion
    "notes_paper",
    "electronic_gadget",
    "suspicious_object",
]

# Custom YOLO class name -> backend violation_type (normal_watch has none)
CLASS_TO_VIOLATION = {
    "mobile_phone": "MOBILE_PHONE",
    "laptop": "ELECTRONIC_GADGET",
    "smart_watch": "SMART_WATCH",
    "notes_paper": "NOTES_PAPER",
    "electronic_gadget": "ELECTRONIC_GADGET",
    "suspicious_object": "SUSPICIOUS_OBJECT",
}

# Allowed custom classes (never violation)
ALLOWED_CLASS_NAMES = {
    "normal_watch",
    "non_cheating",
    "hand_normal",
}

# COCO aliases that are safe to treat as prohibited exam items.
# Intentionally OMITTED: remote, watch, wristwatch, clock — false-positive sources.
COCO_ALIASES_TO_CLASS = {
    "cell phone": "mobile_phone",
    "cellphone": "mobile_phone",
    "mobile phone": "mobile_phone",
    "phone": "mobile_phone",
    "handphone": "mobile_phone",
    "laptop": "laptop",
    "keyboard": "electronic_gadget",
    "mouse": "electronic_gadget",
    "book": "notes_paper",
}

# Custom-model-only aliases (ignored under COCO mode by detection_policy)
CUSTOM_ALIASES_TO_CLASS = {
    "smartwatch": "smart_watch",
    "smart watch": "smart_watch",
    "smart-watch": "smart_watch",
}

VIOLATION_TO_CLASS = {v: k for k, v in CLASS_TO_VIOLATION.items()}

UFM_WATCHLIST_LABELS = set(CLASS_TO_VIOLATION.keys()) | set(
    COCO_ALIASES_TO_CLASS.keys()
)


def normalize_label(raw: str, *, model_mode: str = "coco") -> str:
    """
    Map raw YOLO name -> app class name when possible; otherwise return raw.
    Does not map generic 'watch' to smart_watch.
    """
    key = (raw or "").strip().lower()
    if key in CLASS_TO_VIOLATION or key in ALLOWED_CLASS_NAMES:
        return key
    if key in COCO_ALIASES_TO_CLASS:
        return COCO_ALIASES_TO_CLASS[key]
    if model_mode != "coco" and key in CUSTOM_ALIASES_TO_CLASS:
        return CUSTOM_ALIASES_TO_CLASS[key]
    return key


def to_violation_type(raw_label: str, *, model_mode: str = "coco") -> str | None:
    normalized = normalize_label(raw_label, model_mode=model_mode)
    if normalized in ALLOWED_CLASS_NAMES:
        return None
    if normalized in CLASS_TO_VIOLATION:
        return CLASS_TO_VIOLATION[normalized]
    upper = (raw_label or "").strip().upper()
    if upper in VIOLATION_TO_CLASS:
        return upper
    return None


def is_ufm_watchlist(raw_label: str, *, model_mode: str = "coco") -> bool:
    """True if label can become a UFM candidate (still subject to policy thresholds)."""
    from detection_policy import decide, Decision

    decision, _ = decide(raw_label=raw_label, confidence=1.0, model_mode=model_mode)
    return decision != Decision.IGNORE


WEIGHTS_DIR = AI_ROOT / "weights"

# Human-readable names for overlays / alerts (internal category -> display)
DISPLAY_NAMES = {
    "mobile_phone": "phone",
    "laptop": "laptop/tablet",
    "smart_watch": "smartwatch",
    "normal_watch": "watch",
    "notes_paper": "notes/paper",
    "electronic_gadget": "earbuds/gadget",
    "looking_away": "looking away",
}


def display_name(category: str | None) -> str:
    return DISPLAY_NAMES.get(category or "", (category or "").replace("_", " "))


def default_custom_weights() -> Path:
    """Custom UFM detector: YOLO_CUSTOM_WEIGHTS or ai/weights/ufm_od_v1.pt."""
    import os

    env = os.getenv("YOLO_CUSTOM_WEIGHTS", "").strip()
    if env:
        p = Path(env)
        return p if p.is_absolute() else (AI_ROOT.parent / p)
    return WEIGHTS_DIR / "ufm_od_v1.pt"


def default_coco_weights() -> Path:
    return WEIGHTS_DIR / "yolov8n.pt"


def resolve_weights(explicit: str | None = None) -> tuple[Path, str]:
    """
    Pick weights for live / offline inference.

    YOLO_MODEL = auto (default) | custom | coco
      auto   -> trained UFM detector if its weights file exists, else COCO yolov8n
      custom -> trained UFM detector (falls back to COCO with a warning if missing)
      coco   -> stock COCO yolov8n (phone / laptop / book only)
    Legacy: YOLO_USE_CUSTOM=1 == custom, YOLO_USE_CUSTOM=0 == coco.

    Returns (path, mode) where mode is 'explicit' | 'custom' | 'coco'.
    """
    import os

    if explicit:
        path = Path(explicit)
        if path.is_file():
            return path.resolve(), "explicit"
        raise FileNotFoundError(f"Weights not found: {path}")

    choice = os.getenv("YOLO_MODEL", "").strip().lower()
    if not choice:
        legacy = os.getenv("YOLO_USE_CUSTOM", "").strip().lower()
        if legacy in {"1", "true", "yes"}:
            choice = "custom"
        elif legacy in {"0", "false", "no"}:
            choice = "coco"
        else:
            choice = "auto"

    custom = default_custom_weights()
    coco = default_coco_weights()

    if choice in {"auto", "custom"} and custom.is_file():
        return custom.resolve(), "custom"
    if choice == "custom":
        print(f"[weights] YOLO_MODEL=custom but {custom} is missing; using COCO fallback")
    if not coco.is_file():
        return Path("yolov8n.pt"), "coco"  # Ultralytics downloads it on first use
    return coco.resolve(), "coco"
