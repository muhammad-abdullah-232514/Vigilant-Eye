"""Field-constraint audit regression tests.

Covers the whitespace-trimming base, max-length caps, enum restrictions and
cross-field rules added during the project-wide constraint audit. These are
schema-level tests — fast and independent of the DB / full app wiring.

Run from backend/:
  pytest -q tests/test_field_constraints_audit.py
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from schemas.camera import CameraCreate
from schemas.case_review import CaseReviewCreate
from schemas.result_control import ResultControlCreate
from schemas.student import StudentCreate
from schemas.ufm_case import UfmCaseCreate
from schemas.user import UserCreate


# --- whitespace-only must not satisfy min_length -------------------------------

def test_whitespace_only_name_rejected_student():
    with pytest.raises(ValidationError):
        StudentCreate(
            student_id="232430", name="   ", department="CS", program="BSCS"
        )


def test_whitespace_trimmed_on_valid_student():
    s = StudentCreate(
        student_id="  232430  ", name="  Ada  ", department=" CS ", program=" BSCS "
    )
    assert s.name == "Ada"
    assert s.student_id == "232430"
    assert s.department == "CS"


def test_whitespace_only_camera_name_rejected():
    with pytest.raises(ValidationError):
        CameraCreate(
            camera_id="CAM-1", name="   ", room_id=1, stream_url="webcam:0"
        )


def test_user_name_whitespace_rejected_but_password_preserved():
    with pytest.raises(ValidationError):
        UserCreate(name="  ", email="a@b.com", password="Secret12", role="STUDENT")
    u = UserCreate(
        name="  Ada  ", email="a@b.com", password="  spaced pw  ", role=" STUDENT "
    )
    assert u.name == "Ada"
    assert u.role == "STUDENT"
    # Password is intentionally NOT trimmed.
    assert u.password == "  spaced pw  "


# --- max-length caps ----------------------------------------------------------

def test_ufm_description_max_length_enforced():
    with pytest.raises(ValidationError):
        UfmCaseCreate(
            student_id=1,
            exam_id=1,
            violation_type="MOBILE_PHONE",
            description="x" * 5001,
            signer_name="Jane Doe",
        )


def test_case_review_remarks_max_length_enforced():
    with pytest.raises(ValidationError):
        CaseReviewCreate(action="FORWARD", remarks="y" * 5001, signer_name="Jane Doe")


# --- enum / Literal restrictions ----------------------------------------------

def test_result_control_rejects_unknown_status():
    with pytest.raises(ValidationError):
        ResultControlCreate(
            student_id=1, case_id=1, reason="held", result_status="HACKED"
        )


def test_result_control_accepts_known_status():
    rc = ResultControlCreate(student_id=1, case_id=1, reason="held")
    assert rc.result_status == "HELD"
    assert rc.transcript_status == "BLOCKED"


# --- mass-assignment guard: server-owned fields are ignored -------------------

def test_ufm_case_ignores_unknown_fields():
    body = UfmCaseCreate(
        student_id=1,
        exam_id=1,
        violation_type="MOBILE_PHONE",
        description="Observed phone use",
        signer_name="Jane Doe",
        status="APPROVED",  # server-owned — must be ignored, not bound
        id=999,
    )
    assert not hasattr(body, "status") or getattr(body, "status", None) != "APPROVED"
    assert "id" not in body.model_dump()
