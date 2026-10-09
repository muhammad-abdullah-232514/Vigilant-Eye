from datetime import date, datetime, time

from pydantic import BaseModel, Field

from schemas._base import InputModel


class ExamCreate(InputModel):
    """JSON body the client sends when creating an exam."""

    course_code: str = Field(min_length=1, max_length=50)
    course_name: str = Field(min_length=1, max_length=150)
    semester: str = Field(min_length=1, max_length=50)
    exam_date: date
    start_time: time
    end_time: time
    room_id: int = Field(gt=0)
    # Note: end_time > start_time is enforced at the endpoint layer (returns 400)
    # to keep a single, consistent error contract — see main.py create/update exam.

    # --- Exam Toolkit optional metadata (all additive, safe defaults) ---
    title: str | None = Field(default=None, max_length=150)
    exam_type: str | None = Field(default=None, max_length=50)
    department: str | None = Field(default=None, max_length=100)
    section: str | None = Field(default=None, max_length=50)
    student_count: int | None = Field(default=None, ge=0, le=100000)
    required_invigilators: int = Field(default=1, ge=1, le=20)
    instructions: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=5000)


class ExamOut(BaseModel):
    """JSON the API returns for an exam."""

    id: int
    course_code: str
    course_name: str
    semester: str
    exam_date: date
    start_time: time
    end_time: time
    room_id: int
    status: str = "DRAFT"
    title: str | None = None
    exam_type: str | None = None
    department: str | None = None
    section: str | None = None
    student_count: int | None = None
    required_invigilators: int = 1
    instructions: str | None = None
    notes: str | None = None
    published_at: datetime | None = None

    model_config = {"from_attributes": True}
