"""Phase 23 — Exam enrollment, invigilator assignment, exam update schemas."""

from __future__ import annotations

from datetime import date, time

from pydantic import BaseModel, Field

from schemas._base import InputModel
from schemas.exam import ExamOut


class ExamUpdate(InputModel):
    course_code: str | None = Field(default=None, min_length=1, max_length=50)
    course_name: str | None = Field(default=None, min_length=1, max_length=150)
    semester: str | None = Field(default=None, min_length=1, max_length=50)
    exam_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    room_id: int | None = Field(default=None, gt=0)
    # end_time > start_time enforced at the endpoint layer (returns 400).
    title: str | None = Field(default=None, max_length=150)
    exam_type: str | None = Field(default=None, max_length=50)
    department: str | None = Field(default=None, max_length=100)
    section: str | None = Field(default=None, max_length=50)
    student_count: int | None = Field(default=None, ge=0, le=100000)
    required_invigilators: int | None = Field(default=None, ge=1, le=20)
    instructions: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=5000)


class ExamStatusUpdate(InputModel):
    """Controlled exam lifecycle transition (e.g. publish/cancel/complete)."""

    status: str = Field(min_length=1, max_length=30)


class ExamEnrollmentCreate(InputModel):
    student_id: int = Field(gt=0)


class ExamEnrollmentOut(BaseModel):
    id: int
    exam_id: int
    student_id: int
    student_roll: str | None = None
    student_name: str | None = None

    model_config = {"from_attributes": True}


class ExamInvigilatorCreate(InputModel):
    user_id: int = Field(gt=0)
    is_primary: bool = False


class ExamInvigilatorOut(BaseModel):
    id: int
    exam_id: int
    user_id: int
    user_email: str | None = None
    user_name: str | None = None
    is_primary: bool = False
    duty_status: str = "ASSIGNED"

    model_config = {"from_attributes": True}


class DutyStatusUpdate(InputModel):
    """Invigilator/Exam-Dept update of an assignment's duty status."""

    duty_status: str = Field(min_length=1, max_length=20)


class ExamDetailOut(ExamOut):
    enrollments: list[ExamEnrollmentOut] = []
    invigilators: list[ExamInvigilatorOut] = []
    room_cameras: list[dict] = []
    room_number: str | None = None
    room_building: str | None = None
    room_capacity: int | None = None


class DutyRosterRow(BaseModel):
    """One flattened row of the duty roster (Exam × Invigilator)."""

    exam_id: int
    assignment_id: int | None = None
    course_code: str
    course_name: str
    title: str | None = None
    exam_date: date
    start_time: time
    end_time: time
    status: str
    room_id: int
    room_number: str | None = None
    room_building: str | None = None
    department: str | None = None
    invigilator_user_id: int | None = None
    invigilator_name: str | None = None
    invigilator_email: str | None = None
    is_primary: bool = False
    duty_status: str | None = None


class MyDutyOut(BaseModel):
    """An invigilator's own assigned duty with full exam context."""

    exam_id: int
    assignment_id: int
    course_code: str
    course_name: str
    title: str | None = None
    exam_date: date
    start_time: time
    end_time: time
    status: str
    room_id: int
    room_number: str | None = None
    room_building: str | None = None
    is_primary: bool = False
    duty_status: str = "ASSIGNED"
    instructions: str | None = None
    cameras: list[dict] = []


class ExamToolkitStats(BaseModel):
    total: int
    today: int
    upcoming: int
    completed: int
    cancelled: int
    draft: int
    published: int
    unassigned: int
    missing_invigilators: int
    rooms_in_use_today: int
    by_status: dict[str, int] = {}
