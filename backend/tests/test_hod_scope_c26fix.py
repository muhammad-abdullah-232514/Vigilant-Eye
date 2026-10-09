"""
C26-FIX — HOD has no case creation, live monitoring, or detections.

Run from backend/:
  pytest -q tests/test_hod_scope_c26fix.py
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from case_access import DETECTION_STAFF_ROLES, MONITOR_ROLES
from database import get_db
from main import app
from models.base import Base
from models.case_review import CaseReview
from models.exam import Exam
from models.exam_room import ExamRoom
from models.student import Student
from models.ufm_case import UfmCase
from models.user import User
from security import create_access_token, hash_password

ROOT = Path(__file__).resolve().parents[2]
FE = ROOT / "frontend" / "src"


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
    hod = User(
        name="Hod C26Fix",
        email="hod.c26fix@demo.com",
        password_hash=hash_password("UnusedPass1!"),
        role="HOD",
        is_active=True,
    )
    dec = User(
        name="Dec C26Fix",
        email="dec.c26fix@demo.com",
        password_hash=hash_password("UnusedPass1!"),
        role="DEC",
        is_active=True,
    )
    exam_department = User(
        name="Exam Department C26Fix",
        email="exam.c26fix@demo.com",
        password_hash=hash_password("UnusedPass1!"),
        role="EXAM_DEPARTMENT",
        is_active=True,
    )
    db.add_all([hod, dec, exam_department])
    db.commit()
    db.refresh(hod)
    db.refresh(dec)
    db.refresh(exam_department)

    def token(user: User) -> str:
        return create_access_token(
            user_id=user.id, email=user.email, role=user.role
        )

    client = TestClient(app)
    yield {
        "client": client,
        "token": token,
        "hod": hod,
        "dec": dec,
        "exam_department": exam_department,
        "db": db,
    }
    app.dependency_overrides.clear()
    db.close()
    engine.dispose()


def test_role_sets_invigilator_only():
    assert MONITOR_ROLES == frozenset({"INVIGILATOR"})
    assert DETECTION_STAFF_ROLES == frozenset({"INVIGILATOR"})
    assert "HOD" not in MONITOR_ROLES
    assert "HOD" not in DETECTION_STAFF_ROLES


def test_hod_api_denied_monitor_detect_create(client_db):
    c = client_db["client"]
    h = {
        "Authorization": f"Bearer {client_db['token'](client_db['hod'])}"
    }
    assert c.get("/live/status", headers=h).status_code == 403
    assert c.get("/detections", headers=h).status_code == 403
    assert (
        c.post(
            "/ufm-cases",
            headers=h,
            json={
                "student_id": 1,
                "exam_id": 1,
                "violation_type": "MOBILE_PHONE",
                "description": "should fail",
                "signer_name": "Hod",
                "signature_ack": True,
            },
        ).status_code
        == 403
    )
    assert c.post(
        "/exam-rooms",
        headers=h,
        json={"room_number": "HOD-ROOM", "building": "A", "capacity": 30},
    ).status_code == 403
    assert c.post(
        "/exams",
        headers=h,
        json={
            "course_code": "HOD101",
            "course_name": "Unauthorized exam",
            "semester": "Spring 2026",
            "exam_date": "2026-06-01",
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "room_id": 1,
        },
    ).status_code == 403


def test_hod_dashboard_analytics_counts_monthly_case_events(client_db):
    db = client_db["db"]
    hod = client_db["hod"]
    room = ExamRoom(room_number="HOD-ANALYTICS", building="A", capacity=30)
    student = Student(
        student_id="HOD-ANALYTICS-1",
        name="Analytics Student",
        department="Computing",
        program="BSCS",
    )
    db.add_all([room, student])
    db.flush()
    exam = Exam(
        course_code="ANL101",
        course_name="Analytics",
        semester="Spring 2025",
        exam_date=date(2025, 2, 12),
        start_time=time(9),
        end_time=time(12),
        room_id=room.id,
    )
    db.add(exam)
    db.flush()
    first_case = UfmCase(
        case_number="HOD-ANALYTICS-1",
        student_id=student.id,
        exam_id=exam.id,
        reported_by=hod.id,
        violation_type="MOBILE_PHONE",
        description="Test case",
        status="APPROVED",
        created_at=datetime(2025, 2, 12, 8),
        updated_at=datetime(2025, 2, 12, 10),
    )
    second_case = UfmCase(
        case_number="HOD-ANALYTICS-2",
        student_id=student.id,
        exam_id=exam.id,
        reported_by=hod.id,
        violation_type="NOTES",
        description="Test case",
        status="REJECTED",
        created_at=datetime(2025, 2, 12, 8, 30),
        updated_at=datetime(2025, 2, 12, 10, 30),
    )
    db.add_all([first_case, second_case])
    db.flush()
    db.add_all(
        [
            CaseReview(
                case_id=first_case.id,
                reviewer_id=hod.id,
                reviewer_role="HOD",
                action="FORWARD",
                created_at=datetime(2025, 2, 12, 9),
            ),
            CaseReview(
                case_id=first_case.id,
                reviewer_id=hod.id,
                reviewer_role="EXAM_DEPARTMENT",
                action="IMPLEMENT",
                created_at=datetime(2025, 2, 12, 10),
            ),
            CaseReview(
                case_id=second_case.id,
                reviewer_id=hod.id,
                reviewer_role="UFM_COMMITTEE",
                action="REJECT",
                created_at=datetime(2025, 2, 12, 10, 30),
            ),
        ]
    )
    db.commit()

    response = client_db["client"].get(
        "/dashboard/hod-analytics?year=2025&month=2",
        headers={
            "Authorization": "Bearer " + client_db["token"](client_db["hod"])
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "year": 2025,
        "month": 2,
        "received": [{"date": "2025-02-12", "count": 2}],
        "forwarded": [{"date": "2025-02-12", "count": 1}],
        "resolved": [{"date": "2025-02-12", "count": 2}],
    }
    exam_department_response = client_db["client"].get(
        "/dashboard/hod-analytics?year=2025&month=2",
        headers={
            "Authorization": "Bearer "
            + client_db["token"](client_db["exam_department"])
        },
    )
    assert exam_department_response.status_code == 200
    assert exam_department_response.json() == response.json()
    assert client_db["client"].get(
        "/dashboard/hod-analytics?year=2025&month=2",
        headers={"Authorization": "Bearer " + client_db["token"](client_db["dec"])},
    ).status_code == 403


def test_dec_dashboard_analytics_counts_workflow_events(client_db):
    db = client_db["db"]
    hod = client_db["hod"]
    dec = client_db["dec"]
    room = ExamRoom(room_number="DEC-ANALYTICS", building="A", capacity=30)
    student = Student(
        student_id="DEC-ANALYTICS-1",
        name="Analytics Student",
        department="Computing",
        program="BSCS",
    )
    db.add_all([room, student])
    db.flush()
    exam = Exam(
        course_code="DEC101",
        course_name="DEC Analytics",
        semester="Fall 2026",
        exam_date=date.today(),
        start_time=time(9),
        end_time=time(12),
        room_id=room.id,
    )
    db.add(exam)
    db.flush()
    now = datetime.utcnow()
    cases = [
        UfmCase(
            case_number=f"DEC-ANALYTICS-{index}",
            student_id=student.id,
            exam_id=exam.id,
            reported_by=hod.id,
            violation_type="MOBILE_PHONE",
            description="Test case",
            status="DEC_REVIEW",
        )
        for index in range(1, 4)
    ]
    db.add_all(cases)
    db.flush()
    db.add_all(
        [
            CaseReview(
                case_id=cases[0].id,
                reviewer_id=hod.id,
                reviewer_role="HOD",
                action="FORWARD",
                created_at=now,
            ),
            CaseReview(
                case_id=cases[1].id,
                reviewer_id=dec.id,
                reviewer_role="DEC",
                action="FORWARD",
                created_at=now,
            ),
            CaseReview(
                case_id=cases[2].id,
                reviewer_id=dec.id,
                reviewer_role="DEC",
                action="RETURN",
                created_at=now,
            ),
        ]
    )
    db.commit()

    response = client_db["client"].get(
        "/dashboard/dec-analytics",
        headers={
            "Authorization": "Bearer " + client_db["token"](dec)
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "received_this_month": 1,
        "forwarded_this_week": 1,
        "returned_this_month": 1,
    }
    assert client_db["client"].get(
        "/dashboard/dec-analytics",
        headers={
            "Authorization": "Bearer " + client_db["token"](hod)
        },
    ).status_code == 403


def test_ufm_committee_dashboard_analytics_counts_project_workflow(client_db):
    db = client_db["db"]
    hod = client_db["hod"]
    committee = User(
        name="Committee C26Fix",
        email="committee.c26fix@demo.com",
        password_hash=hash_password("UnusedPass1!"),
        role="UFM_COMMITTEE",
        is_active=True,
    )
    room = ExamRoom(room_number="UFM-ANALYTICS", building="A", capacity=30)
    student = Student(
        student_id="UFM-ANALYTICS-1",
        name="Committee Analytics Student",
        department="Computing",
        program="BSCS",
    )
    db.add_all([committee, room, student])
    db.flush()
    exam = Exam(
        course_code="UFM101",
        course_name="UFM Analytics",
        semester="Fall 2026",
        exam_date=date.today(),
        start_time=time(9),
        end_time=time(12),
        room_id=room.id,
    )
    db.add(exam)
    db.flush()

    now = datetime.utcnow()
    old_date = now - timedelta(days=40)
    cases = [
        UfmCase(
            case_number=f"UFM-ANALYTICS-{index}",
            student_id=student.id,
            exam_id=exam.id,
            reported_by=hod.id,
            violation_type="MOBILE_PHONE",
            description="Committee dashboard test case",
            status=case_status,
            created_at=old_date,
            updated_at=updated_at,
        )
        for index, (case_status, updated_at) in enumerate(
            [
                ("UFM_COMMITTEE_REVIEW", now),
                ("EXAM_DEPARTMENT_IMPLEMENTATION", now),
                ("APPROVED", now),
                ("REJECTED", now),
                ("REJECTED", old_date),
            ],
            start=1,
        )
    ]
    db.add_all(cases)
    db.flush()
    db.add_all(
        [
            CaseReview(
                case_id=cases[0].id,
                reviewer_id=client_db["exam_department"].id,
                reviewer_role="EXAM_DEPARTMENT",
                action="FORWARD",
                created_at=now,
            ),
            CaseReview(
                case_id=cases[1].id,
                reviewer_id=committee.id,
                reviewer_role="UFM_COMMITTEE",
                action="APPROVE",
                created_at=now,
            ),
            CaseReview(
                case_id=cases[2].id,
                reviewer_id=committee.id,
                reviewer_role="UFM_COMMITTEE",
                action="APPROVE",
                created_at=now,
            ),
            CaseReview(
                case_id=cases[3].id,
                reviewer_id=committee.id,
                reviewer_role="UFM_COMMITTEE",
                action="REJECT",
                created_at=now,
            ),
            CaseReview(
                case_id=cases[2].id,
                reviewer_id=client_db["exam_department"].id,
                reviewer_role="EXAM_DEPARTMENT",
                action="IMPLEMENT",
                created_at=now,
            ),
            CaseReview(
                case_id=cases[4].id,
                reviewer_id=committee.id,
                reviewer_role="UFM_COMMITTEE",
                action="REJECT",
                created_at=old_date,
            ),
        ]
    )
    db.commit()

    response = client_db["client"].get(
        "/dashboard/ufm-committee-analytics",
        headers={
            "Authorization": "Bearer " + client_db["token"](committee)
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "cases_for_final_review": 1,
        "awaiting_implementation": 1,
        "decisions_this_month": 3,
        "closed_cases_this_month": 2,
        "total_closed_cases": 3,
        "year": now.year,
        "month": now.month,
        "received": [{"date": now.date().isoformat(), "count": 1}],
        "decided": [{"date": now.date().isoformat(), "count": 3}],
        "closed": [{"date": now.date().isoformat(), "count": 2}],
        "violation_distribution": [{"label": "MOBILE_PHONE", "count": 3}],
        "outcomes": {"penalty_implemented": 1, "case_dismissed": 1},
    }
    assert client_db["client"].get(
        "/dashboard/ufm-committee-analytics",
        headers={"Authorization": "Bearer " + client_db["token"](hod)},
    ).status_code == 403


def test_hod_exam_toolkit_navigation_and_route_are_denied():
    app = (FE / "App.jsx").read_text(encoding="utf-8")
    route = app.split('path="exam-toolkit"')[1].split("</Route>")[0]
    assert "roles={EXAM_TOOLKIT_ROLES}" in route


def test_hod_frontend_has_no_create_or_monitor_actions():
    nav = (FE / "config" / "navByRole.js").read_text(encoding="utf-8")
    dash = (FE / "config" / "dashboardByRole.js").read_text(encoding="utf-8")
    role_access = (FE / "config" / "roleAccess.js").read_text(encoding="utf-8")
    app = (FE / "App.jsx").read_text(encoding="utf-8")

    hod_block = nav.split("HOD: [")[1].split("DEC: [")[0]
    assert "/app/monitoring" not in hod_block
    assert "/app/detections" not in hod_block
    assert "/app/cases/new" not in hod_block
    assert "Live Monitoring" not in hod_block
    assert "Report UFM" not in hod_block
    assert "Create UFM" not in hod_block
    assert "Report a Case" not in hod_block
    assert "/app/exam-toolkit" not in hod_block

    qa = dash.split("export function quickActionsForRole")[1]
    hod_qa = qa.split('if (role === "HOD")')[1].split('if (role === "DEC")')[0]
    assert "/app/monitoring" not in hod_qa
    assert "/app/detections" not in hod_qa
    assert "/app/cases/new" not in hod_qa
    assert "Create UFM" not in hod_qa
    assert "Report UFM" not in hod_qa
    assert "/app/cases?status=PENDING" in hod_qa
    assert "/app/evidence" in hod_qa
    assert "/app/exam-toolkit" not in hod_qa

    toolkit_roles = role_access.split("EXAM_TOOLKIT_ROLES")[1].split(
        "EVIDENCE_UPLOAD_ROLES"
    )[0]
    assert "EXAM_DEPARTMENT" in toolkit_roles
    assert "HOD" not in toolkit_roles
    assert "roles={EXAM_TOOLKIT_ROLES}" in app

    mon = role_access.split("MONITOR_ROLES")[1].split("DETECTION_ROLES")[0]
    det = role_access.split("DETECTION_ROLES")[1].split("REPORTS_ROLES")[0]
    create = role_access.split("CASE_CREATE_ROLES")[1].split(
        "EVIDENCE_UPLOAD_ROLES"
    )[0]
    assert "HOD" not in mon
    assert "HOD" not in det
    assert "HOD" not in create
    assert "INVIGILATOR" in mon
    assert "INVIGILATOR" in det
    assert "INVIGILATOR" in create

    deny = nav.split("HOD_NAV_DENY_PATHS")[1].split("function sanitizeNavForRole")[
        0
    ]
    assert '"/app/monitoring"' in deny
    assert '"/app/detections"' in deny
    assert '"/app/cases/new"' in deny
    assert '"/app/exam-toolkit"' in deny
