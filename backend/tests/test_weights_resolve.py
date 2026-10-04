"""Weights resolution: YOLO_MODEL=auto|custom|coco with COCO as the fallback."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai"))

from ufm_classes import default_coco_weights, resolve_weights  # noqa: E402


def _clear(monkeypatch):
    for k in ("YOLO_MODEL", "YOLO_USE_CUSTOM", "YOLO_CUSTOM_WEIGHTS"):
        monkeypatch.delenv(k, raising=False)


def test_auto_prefers_custom_when_present(monkeypatch, tmp_path):
    _clear(monkeypatch)
    w = tmp_path / "ufm.pt"
    w.write_bytes(b"x")
    monkeypatch.setenv("YOLO_CUSTOM_WEIGHTS", str(w))
    path, mode = resolve_weights(None)
    assert (path, mode) == (w.resolve(), "custom")


def test_auto_falls_back_to_coco(monkeypatch, tmp_path):
    _clear(monkeypatch)
    monkeypatch.setenv("YOLO_CUSTOM_WEIGHTS", str(tmp_path / "missing.pt"))
    _, mode = resolve_weights(None)
    assert mode == "coco"


def test_force_coco(monkeypatch, tmp_path):
    _clear(monkeypatch)
    w = tmp_path / "ufm.pt"
    w.write_bytes(b"x")
    monkeypatch.setenv("YOLO_CUSTOM_WEIGHTS", str(w))
    monkeypatch.setenv("YOLO_MODEL", "coco")
    path, mode = resolve_weights(None)
    assert mode == "coco"
    if default_coco_weights().is_file():
        assert path == default_coco_weights().resolve()


def test_legacy_flag_disables_custom(monkeypatch, tmp_path):
    _clear(monkeypatch)
    w = tmp_path / "ufm.pt"
    w.write_bytes(b"x")
    monkeypatch.setenv("YOLO_CUSTOM_WEIGHTS", str(w))
    monkeypatch.setenv("YOLO_USE_CUSTOM", "0")
    assert resolve_weights(None)[1] == "coco"
