"""Serialize enriched result-control payloads for the portal.

Uses existing ResultControl rows + Student/UfmCase joins + AuditLog hold-creation
records. Does not invent statuses, roles, or lifecycle rules.
"""

from __future__ import annotations

import json

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models.audit_log import AuditLog
from models.case_review import CaseReview
from models.result_control import ResultControl
from models.student import Student
from models.ufm_case import UfmCase
from models.user import User


def _hold_created_audit(db: Session, control: ResultControl) -> AuditLog | None:
    """Find RESULT_HOLD_CREATED for this control.

    Auto-approve path historically logged entity_id=case.id; manual create logs
    entity_id=control.id. Accept either so placed-by/at can surface when present.
    """
    return db.scalar(
        select(AuditLog)
        .where(
            AuditLog.action == "RESULT_HOLD_CREATED",
            AuditLog.entity_type == "result_control",
            or_(
                AuditLog.entity_id == control.id,
                AuditLog.entity_id == control.case_id,
            ),
        )
        .order_by(AuditLog.id.asc())
        .limit(1)
    )


def enrich_result_control(db: Session, control: ResultControl) -> dict:
    student = db.get(Student, control.student_id)
    case = db.get(UfmCase, control.case_id)
    releaser = (
        db.get(User, control.released_by) if control.released_by is not None else None
    )
    created = _hold_created_audit(db, control)
    holder = db.get(User, created.user_id) if created and created.user_id else None
    committee_review = db.scalar(
        select(CaseReview)
        .where(
            CaseReview.case_id == control.case_id,
            CaseReview.reviewer_role == "UFM_COMMITTEE",
            CaseReview.action == "APPROVE",
        )
        .order_by(CaseReview.id.desc())
    )
    recommendations = (
        json.loads(committee_review.recommended_penalties)
        if committee_review and committee_review.recommended_penalties
        else None
    )
    implemented = (
        json.loads(control.implemented_penalties)
        if control.implemented_penalties
        else None
    )
    can_release = not recommendations or (
        case is not None
        and case.status == "APPROVED"
        and bool(implemented)
        and ("FINE" not in recommendations or control.fine_paid)
    )

    reason = control.reason or ""
    automatic = "automatic hold" in reason.lower()

    return {
        "id": control.id,
        "student_id": control.student_id,
        "case_id": control.case_id,
        "result_status": control.result_status,
        "transcript_status": control.transcript_status,
        "reason": control.reason,
        "recommended_penalties": recommendations,
        "implemented_penalties": implemented,
        "fine_amount": control.fine_amount,
        "fine_paid": control.fine_paid,
        "can_release": can_release,
        "released_at": control.released_at,
        "released_by": control.released_by,
        "student_roll": student.student_id if student else None,
        "student_name": student.name if student else None,
        "student_department": student.department if student else None,
        "student_program": student.program if student else None,
        "case_number": case.case_number if case else None,
        "case_status": case.status if case else None,
        "released_by_name": releaser.name if releaser else None,
        "held_by": created.user_id if created else None,
        "held_by_name": holder.name if holder else None,
        "held_at": created.timestamp if created else None,
        "hold_source": "AUTOMATIC_APPROVE" if automatic else "MANUAL",
    }


def result_control_summary_for_case(db: Session, case_id: int) -> dict | None:
    control = db.scalar(
        select(ResultControl).where(ResultControl.case_id == case_id)
    )
    if control is None:
        return None
    enriched = enrich_result_control(db, control)
    return {
        "id": enriched["id"],
        "result_status": enriched["result_status"],
        "transcript_status": enriched["transcript_status"],
        "reason": enriched["reason"],
        "recommended_penalties": enriched["recommended_penalties"],
        "implemented_penalties": enriched["implemented_penalties"],
        "fine_amount": enriched["fine_amount"],
        "fine_paid": enriched["fine_paid"],
        "can_release": enriched["can_release"],
        "released_at": enriched["released_at"],
        "released_by": enriched["released_by"],
        "released_by_name": enriched["released_by_name"],
        "held_by": enriched["held_by"],
        "held_by_name": enriched["held_by_name"],
        "held_at": enriched["held_at"],
        "hold_source": enriched["hold_source"],
        "case_id": enriched["case_id"],
        "case_number": enriched["case_number"],
        "student_name": enriched["student_name"],
        "student_roll": enriched["student_roll"],
    }
