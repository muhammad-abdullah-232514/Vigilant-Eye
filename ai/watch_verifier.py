"""
Second-stage smart-vs-normal watch classifier for live monitoring.

The detector localises wrist watches; distinguishing a smartwatch from an analog
watch is a fine-grained decision, so every watch box is verified on its crop with
CLIP ViT-B/32 zero-shot (the same prompts / thresholds used to label the training
data in build_ufm_dataset.py). Results are cached per screen location for a few
seconds, so CLIP runs only when a new watch appears (~50-100 ms on CPU).

Disable with UFM_WATCH_VERIFIER=0 (detector labels are then used as-is).
"""

from __future__ import annotations

import os
import threading
import time

import numpy as np

SMART_PROMPTS = [
    "a photo of a smartwatch with a digital touchscreen display",
    "a photo of an apple watch on a wrist",
    "a photo of a fitness tracker band",
]
NORMAL_PROMPTS = [
    "a photo of an analog wristwatch with clock hands",
    "a photo of a classic wristwatch with a round dial",
    "a photo of a mechanical watch on a wrist",
]
SMART_MIN = float(os.getenv("UFM_WATCH_SMART_MIN", "0.80"))
CACHE_SEC = float(os.getenv("UFM_WATCH_CACHE_SEC", "3.0"))
ENABLED = os.getenv("UFM_WATCH_VERIFIER", "1").strip().lower() not in {"0", "false", "no"}

_lock = threading.Lock()
_model = None
_prep = None
_text = None
_load_error: str | None = None
_cache: list[tuple[float, tuple[float, float], float, str, float]] = []  # (t, centre, size, label, p)


def _load() -> bool:
    global _model, _prep, _text, _load_error
    if _model is not None or _load_error:
        return _model is not None
    try:
        import open_clip
        import torch

        model, _, prep = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
        model.eval()
        tok = open_clip.get_tokenizer("ViT-B-32")
        with torch.no_grad():
            t = model.encode_text(tok(SMART_PROMPTS + NORMAL_PROMPTS))
            _text = t / t.norm(dim=-1, keepdim=True)
        _model, _prep = model, prep
        print("[watch] CLIP smart/normal verifier loaded")
        return True
    except Exception as exc:  # noqa: BLE001 — optional component
        _load_error = f"{type(exc).__name__}: {exc}"
        print(f"[watch] verifier unavailable ({_load_error}); using detector labels")
        return False


def status() -> dict:
    return {"enabled": ENABLED, "loaded": _model is not None, "error": _load_error}


def _crop(frame: np.ndarray, xyxy, pad: float = 0.15) -> np.ndarray:
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = (float(v) for v in xyxy)
    bw, bh = x2 - x1, y2 - y1
    x1, y1 = int(max(0, x1 - pad * bw)), int(max(0, y1 - pad * bh))
    x2, y2 = int(min(w, x2 + pad * bw)), int(min(h, y2 + pad * bh))
    return frame[y1:max(y2, y1 + 2), x1:max(x2, x1 + 2)]


def classify(frame: np.ndarray, xyxy) -> tuple[str, float] | None:
    """Return ('smart_watch'|'normal_watch', probability) or None if unavailable."""
    if not ENABLED:
        return None
    x1, y1, x2, y2 = (float(v) for v in xyxy)
    centre, size = ((x1 + x2) / 2, (y1 + y2) / 2), max(x2 - x1, y2 - y1)
    now = time.monotonic()
    with _lock:
        _cache[:] = [c for c in _cache if now - c[0] < CACHE_SEC]
        for t, c, s, label, p in _cache:
            if abs(c[0] - centre[0]) + abs(c[1] - centre[1]) < 0.75 * max(s, size):
                return label, p
        if not _load():
            return None
        import torch
        from PIL import Image

        crop = _crop(frame, xyxy)
        img = _prep(Image.fromarray(crop[:, :, ::-1].copy())).unsqueeze(0)
        with torch.no_grad():
            f = _model.encode_image(img)
            f = f / f.norm(dim=-1, keepdim=True)
            probs = (100.0 * f @ _text.T).softmax(dim=-1)[0].numpy()
        p_smart = float(probs[: len(SMART_PROMPTS)].sum())
        label, p = ("smart_watch", p_smart) if p_smart >= SMART_MIN else ("normal_watch", 1 - p_smart)
        _cache.append((now, centre, size, label, p))
        return label, p
