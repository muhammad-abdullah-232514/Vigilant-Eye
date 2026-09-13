"""
VigilantEye custom UFM detector classes + weight resolution.

Maps YOLO labels (custom or COCO aliases) -> portal violation_type.
"""

from __future__ import annotations

from pathlib import Path

AI_ROOT = Path(__file__).resolve().parent

UFM_CLASS_NAMES = [
    "mobile_phone",
    "smart_watch",
    "notes_paper",
    "electronic_gadget",
    "suspicious_object",
]

# Custom YOLO class name -> backend violation_type
CLASS_TO_VIOLATION = {
    "mobile_phone": "MOBILE_PHONE",
    "smart_watch": "SMART_WATCH",
    "notes_paper": "NOTES_PAPER",
    "electronic_gadget": "ELECTRONIC_GADGET",
    "suspicious_object": "SUSPICIOUS_OBJECT",
}

# Common pretrained COCO / alternate names -> same portal types
COCO_ALIASES_TO_CLASS = {
    "cell phone": "mobile_phone",
    "cellphone": "mobile_phone",
    "mobile phone": "mobile_phone",
    "phone": "mobile_phone",
    "handphone": "mobile_phone",
    "laptop": "electronic_gadget",
    "keyboard": "electronic_gadget",
    "mouse": "electronic_gadget",
    "remote": "electronic_gadget",
    "calculator": "electronic_gadget",
    "headphone": "electronic_gadget",
    "headphones": "electronic_gadget",
    "book": "notes_paper",
    "paper": "notes_paper",
    "cheating-paper": "notes_paper",
    "cheating_paper": "notes_paper",
    "smartwatch": "smart_watch",
    "smart watch": "smart_watch",
    "smart-watch": "smart_watch",
    "wrist watch": "smart_watch",
    "wrist-watch": "smart_watch",
    "wristwatch": "smart_watch",
    "watch": "smart_watch",
    "cheating": "suspicious_object",
    "student cheating": "suspicious_object",
    "suitcase": "suspicious_object",
    "handbag": "suspicious_object",
    "backpack": "suspicious_object",
}

VIOLATION_TO_CLASS = {v: k for k, v in CLASS_TO_VIOLATION.items()}

# Labels that may auto-draft a UFM case (custom + COCO aliases)
UFM_WATCHLIST_LABELS = set(UFM_CLASS_NAMES) | set(COCO_ALIASES_TO_CLASS.keys())


def normalize_label(raw: str) -> str:
    """Lowercase + strip; map COCO aliases to custom class names when possible."""
    key = (raw or "").strip().lower()
    if key in CLASS_TO_VIOLATION:
        return key
    return COCO_ALIASES_TO_CLASS.get(key, key)


def to_violation_type(raw_label: str) -> str | None:
    """Return portal violation_type or None if unmapped."""
    normalized = normalize_label(raw_label)
    if normalized in CLASS_TO_VIOLATION:
        return CLASS_TO_VIOLATION[normalized]
    # Already a portal enum?
    upper = (raw_label or "").strip().upper()
    if upper in VIOLATION_TO_CLASS:
        return upper
    return None


def is_ufm_watchlist(raw_label: str) -> bool:
    key = (raw_label or "").strip().lower()
    return key in UFM_WATCHLIST_LABELS or normalize_label(raw_label) in CLASS_TO_VIOLATION


def default_custom_weights() -> Path:
    """Preferred trained weight from last train_yolo.py run."""
    return AI_ROOT / "runs" / "train" / "ufm_custom" / "weights" / "best.pt"


def default_coco_weights() -> Path:
    return AI_ROOT / "weights" / "yolov8n.pt"


def resolve_weights(explicit: str | None = None) -> tuple[Path, str]:
    """
    Pick weights in order:
      1) --weights path if given and exists
      2) custom trained best.pt
      3) pretrained yolov8n.pt (COCO PoC fallback)

    Returns (path, mode) where mode is 'explicit' | 'custom' | 'coco'.
    """
    if explicit:
        path = Path(explicit)
        if path.is_file():
            return path.resolve(), "explicit"
        raise FileNotFoundError(f"Weights not found: {path}")

    custom = default_custom_weights()
    if custom.is_file():
        return custom.resolve(), "custom"

    coco = default_coco_weights()
    return coco.resolve(), "coco"
