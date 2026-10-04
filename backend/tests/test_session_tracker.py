"""Persistence + cooldown rules of detection_policy.SessionTracker."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai"))

from detection_policy import Decision, SessionTracker  # noqa: E402

BOX = (100.0, 100.0, 160.0, 220.0)


def _obs(t: SessionTracker, now: float, decision=Decision.CONFIRM, box=BOX, cat="mobile_phone"):
    return t.observe(category=cat, decision=decision, confidence=0.8, bin_id="x", now=now, xyxy=box)


def test_needs_consecutive_frames():
    t = SessionTracker(confirm_frames=3, review_frames=2, cooldown_sec=30)
    assert _obs(t, 0.0) is None
    assert _obs(t, 0.1) is None
    assert _obs(t, 0.2) == Decision.CONFIRM


def test_moving_object_keeps_streak():
    t = SessionTracker(confirm_frames=3, cooldown_sec=30)
    assert _obs(t, 0.0, box=(100, 100, 160, 220)) is None
    assert _obs(t, 0.1, box=(130, 110, 190, 230)) is None  # crossed an old 80px grid bin
    assert _obs(t, 0.2, box=(150, 120, 210, 240)) == Decision.CONFIRM


def test_cooldown_survives_track_loss():
    t = SessionTracker(confirm_frames=2, cooldown_sec=30, stale_sec=1.0)
    _obs(t, 0.0)
    assert _obs(t, 0.1) == Decision.CONFIRM
    # object hidden for 5 s -> new track, but same place within cooldown: muted
    assert _obs(t, 5.0) is None
    assert _obs(t, 5.1) is None
    # after cooldown it may alert again
    _obs(t, 40.0)
    assert _obs(t, 40.1) == Decision.CONFIRM


def test_review_can_escalate_to_confirm_once():
    t = SessionTracker(confirm_frames=3, review_frames=2, cooldown_sec=30)
    _obs(t, 0.0, Decision.REVIEW)
    assert _obs(t, 0.1, Decision.REVIEW) == Decision.REVIEW
    _obs(t, 0.2)
    _obs(t, 0.3)
    assert _obs(t, 0.4) == Decision.CONFIRM
    _obs(t, 0.5)
    _obs(t, 0.6)
    assert _obs(t, 0.7) is None  # no second confirm within cooldown


def test_different_places_are_independent():
    t = SessionTracker(confirm_frames=2, cooldown_sec=30)
    _obs(t, 0.0)
    assert _obs(t, 0.1) == Decision.CONFIRM
    far = (600.0, 100.0, 660.0, 220.0)
    _obs(t, 0.2, box=far)
    assert _obs(t, 0.3, box=far) == Decision.CONFIRM
