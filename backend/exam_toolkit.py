"""Exam Toolkit — duty-roster scheduling rules.

Centralises the business logic the Exam Department relies on:

* exam lifecycle status transitions,
* invigilator duty status transitions,
* room double-booking prevention (same room, overlapping date+time),
* invigilator double-booking prevention,
* room-capacity validation,
* publish readiness validation.

All helpers raise ``HTTPException`` with user-facing messages so routers stay
thin, matching the existing ``workflow.py`` convention.
"""

from __future__ import annotations

from datetime import date, time

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from models.exam import Exam
from models.exam_invigilator import ExamInvigilator
from models.exam_room import ExamRoom

# --- Exam lifecycle -----------------------------------------------------------

EXAM_STATUSES: frozenset[str] = frozenset(
    {"DRAFT", "SCHEDULED", "PUBLISHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"}
)

# Allowed status → {next statuses}. CANCELLED is reachable from any live state.
EXAM_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"SCHEDULED", "PUBLISHED", "CANCELLED"},
    "SCHEDULED": {"DRAFT", "PUBLISHED", "CANCELLED"},
    "PUBLISHED": {"IN_PROGRESS", "SCHEDULED", "CANCELLED"},
    "IN_PROGRESS": {"COMPLETED", "CANCELLED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
}

# Statuses that still occupy a room / invigilator for conflict purposes.
ACTIVE_EXAM_STATUSES: frozenset[str] = frozenset(
    {"DRAFT", "SCHEDULED", "PUBLISHED", "IN_PROGRESS"}
)

# --- Invigilator duty lifecycle ----------------------------------------------

DUTY_STATUSES: frozenset[str] = frozenset(
    {"ASSIGNED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "ABSENT"}
)

DUTY_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "ASSIGNED": {"CONFIRMED", "ABSENT", "IN_PROGRESS"},
    "CONFIRMED": {"IN_PROGRESS", "ABSENT"},
    "IN_PROGRESS": {"COMPLETED", "ABSENT"},
    "COMPLETED": set(),
    "ABSENT": set(),
}


def _times_overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    """Half-open overlap: adjacent slots (end == next start) do NOT conflict."""
    return start_a < end_b and start_b < end_a


def assert_exam_status_transition(current: str, target: str) -> None:
    if target not in EXAM_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown exam status '{target}'. Allowed: {', '.join(sorted(EXAM_STATUSES))}",
        )
    if current == target:
        return
    allowed = EXAM_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot change exam status from '{current}' to '{target}'. "
                f"Allowed: {', '.join(sorted(allowed)) or 'none'}"
            ),
        )


def assert_duty_status_transition(current: str, target: str) -> None:
    if target not in DUTY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown duty status '{target}'. Allowed: {', '.join(sorted(DUTY_STATUSES))}",
        )
    if current == target:
        return
    allowed = DUTY_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot change duty status from '{current}' to '{target}'. "
                f"Allowed: {', '.join(sorted(allowed)) or 'none'}"
            ),
        )


def assert_capacity_ok(student_count: int | None, room: ExamRoom) -> None:
    if student_count is None:
        return
    if student_count < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="student_count cannot be negative",
        )
    if student_count > room.capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Room '{room.room_number}' holds {room.capacity} students "
                f"but {student_count} are allocated. Choose a larger room."
            ),
        )


def assert_no_room_conflict(
    db: Session,
    *,
    room_id: int,
    exam_date: date,
    start_time: time,
    end_time: time,
    exclude_exam_id: int | None = None,
) -> None:
    """Reject an active exam already occupying this room at an overlapping time."""
    rows = db.scalars(
        select(Exam).where(
            Exam.room_id == room_id,
            Exam.exam_date == exam_date,
            Exam.status.in_(sorted(ACTIVE_EXAM_STATUSES)),
        )
    ).all()
    for other in rows:
        if exclude_exam_id is not None and other.id == exclude_exam_id:
            continue
        if _times_overlap(start_time, end_time, other.start_time, other.end_time):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Room already booked by exam '{other.course_code}' "
                    f"({other.start_time:%H:%M}–{other.end_time:%H:%M}) on {exam_date}."
                ),
            )


def assert_no_invigilator_conflict(
    db: Session,
    *,
    user_id: int,
    exam_date: date,
    start_time: time,
    end_time: time,
    exclude_exam_id: int | None = None,
) -> None:
    """Reject assigning an invigilator already on duty at an overlapping time."""
    rows = db.scalars(
        select(Exam)
        .join(ExamInvigilator, ExamInvigilator.exam_id == Exam.id)
        .where(
            ExamInvigilator.user_id == user_id,
            Exam.exam_date == exam_date,
            Exam.status.in_(sorted(ACTIVE_EXAM_STATUSES)),
        )
    ).all()
    for other in rows:
        if exclude_exam_id is not None and other.id == exclude_exam_id:
            continue
        if _times_overlap(start_time, end_time, other.start_time, other.end_time):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Invigilator already on duty for exam '{other.course_code}' "
                    f"({other.start_time:%H:%M}–{other.end_time:%H:%M}) on {exam_date}."
                ),
            )


def publish_blockers(db: Session, exam: Exam) -> list[str]:
    """Return the list of reasons an exam cannot be published (empty = ready)."""
    problems: list[str] = []
    if exam.end_time <= exam.start_time:
        problems.append("End time must be after start time.")

    room = db.get(ExamRoom, exam.room_id)
    if room is None:
        problems.append("A valid exam room must be assigned.")
    elif exam.student_count is not None and exam.student_count > room.capacity:
        problems.append(
            f"Allocated students ({exam.student_count}) exceed room capacity ({room.capacity})."
        )

    invigilators = db.scalars(
        select(ExamInvigilator).where(ExamInvigilator.exam_id == exam.id)
    ).all()
    required = exam.required_invigilators or 1
    if len(invigilators) < required:
        problems.append(
            f"At least {required} invigilator(s) required; {len(invigilators)} assigned."
        )

    # Re-check room conflict at publish time (ignoring this exam itself).
    if room is not None:
        try:
            assert_no_room_conflict(
                db,
                room_id=exam.room_id,
                exam_date=exam.exam_date,
                start_time=exam.start_time,
                end_time=exam.end_time,
                exclude_exam_id=exam.id,
            )
        except HTTPException as exc:
            problems.append(str(exc.detail))

    return problems
