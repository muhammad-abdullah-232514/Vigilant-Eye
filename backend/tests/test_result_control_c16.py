"""C16 — Result control enrichment, lifecycle clarity, and RBAC."""

from __future__ import annotations

from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import get_db
from main import app
from models.base import Base
from models.exam import Exam
from models.exam_room import ExamRoom
from models.result_control import ResultControl
from models.student import Student
from models.ufm_case import UfmCase
from models.user import User
from security import create_access_token, hash_password


@pytest.fixture()
def client_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    def _get_db():
        db = TestingSession()
        try:
            yield db
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    db = TestingSession()

    room = ExamRoom(room_number="C16-R1", building="Block A", capacity=40)
    db.add(room)
    db.commit()
    db.refresh(room)

    def add_user(*, email, role, name=None):
        u = User(
            name=name or email.split("@")[0],
            email=email.lower(),
            password_hash=hash_password("UnusedPass1!"),
            role=role,
            is_active=True,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u

    inv = add_user(email="inv.c16@demo.com", role="INVIGILATOR", name="Inv C16")
    hod = add_user(email="hod.c16@demo.com", role="HOD", name="Hod C16")
    dec = add_user(email="dec.c16@demo.com", role="DEC", name="Dec C16")
    exam = add_user(email="exam.c16@demo.com", role="EXAM_DEPARTMENT", name="Exam C16")
    ufm = add_user(email="ufm.c16@demo.com", role="UFM_COMMITTEE", name="Ufm C16")
    stu_user = add_user(email="stu.c16@demo.com", role="STUDENT", name="Stu C16")

    student = Student(
        student_id="C16STU01",
        name="C16 Student",
        department="CS",
        program="BSCS",
        user_id=stu_user.id,
    )
    exam_row = Exam(
        course_code="C16101",
        course_name="C16 Exam",
        semester="Fall",
        exam_date=date(2026, 10, 1),
        start_time=time(9, 0),
        end_time=time(12, 0),
        room_id=room.id,
    )
    db.add_all([student, exam_row])
    db.commit()
    db.refresh(student)
    db.refresh(exam_row)

    def token(user: User) -> str:
        return create_access_token(
            user_id=user.id, email=user.email, role=user.role
        )

    client = TestClient(app)
    yield {
        "client": client,
        "db": db,
        "token": token,
        "inv": inv,
        "hod": hod,
        "dec": dec,
        "exam": exam,
        "ufm": ufm,
        "stu_user": stu_user,
        "student": student,
        "exam_row": exam_row,
    }
    app.dependency_overrides.clear()
    db.close()
    engine.dispose()


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _sign(action: str, remarks: str = "ok", **extra) -> dict:
    return {
        "action": action,
        "remarks": remarks,
        "signer_name": "C16 Tester",
        "signature_ack": True,
        **extra,
    }


def _create_case(client_db) -> int:
    c = client_db["client"]
    r = c.post(
        "/ufm-cases",
        headers=_h(client_db["token"](client_db["inv"])),
        json={
            "student_id": client_db["student"].id,
            "exam_id": client_db["exam_row"].id,
            "violation_type": "OTHER",
            "description": "C16 fixture case",
            "signer_name": "Invigilator",
            "signature_ack": True,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _advance_to_committee(client_db, case_id: int):
    c = client_db["client"]
    for role_key, action in (
        ("hod", "FORWARD"),
        ("dec", "FORWARD"),
        ("exam", "FORWARD"),
    ):
        r = c.post(
            f"/ufm-cases/{case_id}/reviews",
            headers=_h(client_db["token"](client_db[role_key])),
            json=_sign(action),
        )
        assert r.status_code == 201, r.text


def test_result_controls_list_shows_student_and_case(client_db):
    c = client_db["client"]
    case_id = _create_case(client_db)
    _advance_to_committee(client_db, case_id)

    r = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["ufm"])),
        json=_sign(
            "APPROVE",
            "sustained",
            recommended_penalties=["F_GRADE"],
        ),
    )
    assert r.status_code == 201, r.text

    r = c.get(
        "/result-controls",
        headers=_h(client_db["token"](client_db["exam"])),
    )
    assert r.status_code == 200
    rows = r.json()
    assert rows
    row = next(x for x in rows if x["case_id"] == case_id)
    assert row["result_status"] == "HELD"
    assert row["student_name"] == "C16 Student"
    assert row["student_roll"] == "C16STU01"
    assert row["case_number"]
    assert row["case_status"] == "EXAM_DEPARTMENT_IMPLEMENTATION"
    assert "Automatic hold" in (row["reason"] or "")
    assert row["hold_source"] == "AUTOMATIC_APPROVE"
    assert row["held_by_name"] == "Ufm C16"
    assert row["held_at"] is not None
    reviews = c.get(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["ufm"])),
    )
    assert reviews.status_code == 200
    assert reviews.json()[-1]["recommended_penalties"] == ["F_GRADE"]


def test_committee_approval_requires_recommended_penalty(client_db):
    c = client_db["client"]
    case_id = _create_case(client_db)
    _advance_to_committee(client_db, case_id)

    response = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["ufm"])),
        json=_sign("APPROVE"),
    )
    assert response.status_code == 400
    assert "Select at least one" in response.json()["detail"]
    assert c.get(
        f"/ufm-cases/{case_id}",
        headers=_h(client_db["token"](client_db["ufm"])),
    ).json()["status"] == "UFM_COMMITTEE_REVIEW"


def test_approved_case_can_recover_missing_implementation(client_db):
    c = client_db["client"]
    case_id = _create_case(client_db)
    _advance_to_committee(client_db, case_id)

    approved = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["ufm"])),
        json=_sign(
            "APPROVE",
            recommended_penalties=["F_GRADE", "FINE"],
        ),
    )
    assert approved.status_code == 201, approved.text

    db = client_db["db"]
    case = db.get(UfmCase, case_id)
    case.status = "APPROVED"
    db.commit()

    result_control = db.scalar(
        select(ResultControl).where(ResultControl.case_id == case_id)
    )
    blocked = c.patch(
        f"/result-controls/{result_control.id}/release",
        headers=_h(client_db["token"](client_db["exam"])),
    )
    assert blocked.status_code == 409
    assert "implement" in blocked.json()["detail"].lower()

    implementation = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["exam"])),
        json=_sign(
            "IMPLEMENT",
            implemented_penalties=["F_GRADE", "FINE"],
            fine_amount="1000.00",
        ),
    )
    assert implementation.status_code == 201, implementation.text
    db.expire_all()
    result_control = db.get(ResultControl, result_control.id)
    db.refresh(case)
    assert case.status == "APPROVED"
    assert result_control.implemented_penalties == '["F_GRADE", "FINE"]'

    paid = c.patch(
        f"/result-controls/{result_control.id}/fine-payment",
        headers=_h(client_db["token"](client_db["exam"])),
        json={"fine_paid": True},
    )
    assert paid.status_code == 200, paid.text

    released = c.patch(
        f"/result-controls/{result_control.id}/release",
        headers=_h(client_db["token"](client_db["exam"])),
    )
    assert released.status_code == 200, released.text


def test_case_detail_includes_result_control_summary(client_db):
    c = client_db["client"]
    case_id = _create_case(client_db)
    _advance_to_committee(client_db, case_id)
    r = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["ufm"])),
        json=_sign("APPROVE", recommended_penalties=["F_GRADE"]),
    )
    assert r.status_code == 201

    for role_key in ("exam", "ufm", "hod", "inv", "stu_user"):
        r = c.get(
            f"/ufm-cases/{case_id}",
            headers=_h(client_db["token"](client_db[role_key])),
        )
        assert r.status_code == 200, role_key
        rc = r.json().get("result_control")
        assert rc is not None, role_key
        assert rc["result_status"] == "HELD"
        assert rc["case_id"] == case_id


def test_return_does_not_create_result_hold(client_db):
    c = client_db["client"]
    case_id = _create_case(client_db)
    r = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["hod"])),
        json=_sign("FORWARD"),
    )
    assert r.status_code == 201
    r = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["dec"])),
        json=_sign("RETURN", "need more detail"),
    )
    assert r.status_code == 201
    db = client_db["db"]
    db.expire_all()
    hold = db.scalar(select(ResultControl).where(ResultControl.case_id == case_id))
    assert hold is None
    case = db.get(UfmCase, case_id)
    assert case.status == "PENDING"


def test_reject_does_not_create_result_hold(client_db):
    c = client_db["client"]
    case_id = _create_case(client_db)
    _advance_to_committee(client_db, case_id)
    r = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["ufm"])),
        json=_sign("REJECT", "not sustained"),
    )
    assert r.status_code == 201
    db = client_db["db"]
    db.expire_all()
    hold = db.scalar(select(ResultControl).where(ResultControl.case_id == case_id))
    assert hold is None
    case = db.get(UfmCase, case_id)
    assert case.status == "REJECTED"

    r = c.get(
        f"/ufm-cases/{case_id}",
        headers=_h(client_db["token"](client_db["exam"])),
    )
    assert r.status_code == 200
    assert r.json().get("result_control") is None


def test_release_authorized_and_denied(client_db):
    c = client_db["client"]
    case_id = _create_case(client_db)
    _advance_to_committee(client_db, case_id)
    r = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["ufm"])),
        json=_sign(
            "APPROVE",
            recommended_penalties=["F_GRADE", "FINE"],
        ),
    )
    assert r.status_code == 201
    db = client_db["db"]
    hold = db.scalar(select(ResultControl).where(ResultControl.case_id == case_id))
    assert hold is not None

    ufm_headers = _h(client_db["token"](client_db["ufm"]))
    assert c.get("/result-controls", headers=ufm_headers).status_code == 403
    assert c.post(
        "/result-controls",
        headers=ufm_headers,
        json={
            "student_id": client_db["student"].id,
            "case_id": case_id,
            "reason": "manual committee hold",
        },
    ).status_code == 403
    assert c.patch(
        f"/result-controls/{hold.id}/release",
        headers=ufm_headers,
    ).status_code == 403
    assert c.patch(
        f"/result-controls/{hold.id}/fine-payment",
        headers=ufm_headers,
        json={"fine_paid": True},
    ).status_code == 403

    r = c.patch(
        f"/result-controls/{hold.id}/release",
        headers=_h(client_db["token"](client_db["hod"])),
    )
    assert r.status_code == 403

    r = c.patch(
        f"/result-controls/{hold.id}/release",
        headers=_h(client_db["token"](client_db["exam"])),
    )
    assert r.status_code == 409
    assert "implement" in r.json()["detail"].lower()

    implemented = c.post(
        f"/ufm-cases/{case_id}/reviews",
        headers=_h(client_db["token"](client_db["exam"])),
        json=_sign(
            "IMPLEMENT",
            implemented_penalties=["F_GRADE", "FINE"],
            fine_amount="2500.00",
        ),
    )
    assert implemented.status_code == 201, implemented.text
    assert c.patch(
        f"/result-controls/{hold.id}/release",
        headers=_h(client_db["token"](client_db["exam"])),
    ).status_code == 409

    paid = c.patch(
        f"/result-controls/{hold.id}/fine-payment",
        headers=_h(client_db["token"](client_db["exam"])),
        json={"fine_paid": True},
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["fine_paid"] is True
    r = c.patch(
        f"/result-controls/{hold.id}/release",
        headers=_h(client_db["token"](client_db["exam"])),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["result_status"] == "RELEASED"
    assert body["transcript_status"] == "ALLOWED"
    assert body["released_by_name"] == "Exam C16"
    assert body["student_name"] == "C16 Student"
    assert float(body["fine_amount"]) == 2500.00
    assert body["fine_paid"] is True


def test_result_controls_page_student_first_ux_markers():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2] / "frontend" / "src"
    page = (root / "pages" / "ResultControlsPage.jsx").read_text(encoding="utf-8")
    access = (root / "config" / "roleAccess.js").read_text(encoding="utf-8")
    assert "Affected students" in page
    assert "Release Result Hold" in page
    assert "Open case to record implementation" in page
    assert "This administrative view is limited to Exam Department accounts." in page
    assert "portal-data-cards" in page
    assert "portal-table-desktop" in page
    assert "Search student" in page
    assert 'export const RESULT_CONTROL_ROLES = Object.freeze(["EXAM_DEPARTMENT"]);' in access
    assert "Place Result Hold" not in page
