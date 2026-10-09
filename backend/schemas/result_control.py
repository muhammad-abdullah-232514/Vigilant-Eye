from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from schemas._base import InputModel


class ResultControlCreate(InputModel):
    student_id: int = Field(gt=0)
    case_id: int = Field(gt=0)
    reason: str = Field(min_length=1, max_length=2000)
    result_status: Literal["HELD", "RELEASED"] = "HELD"
    transcript_status: Literal["BLOCKED", "ALLOWED"] = "BLOCKED"


class ResultControlFinePayment(InputModel):
    fine_paid: bool = True


class ResultControlOut(BaseModel):
    id: int
    student_id: int
    case_id: int
    result_status: str
    transcript_status: str
    reason: str
    recommended_penalties: list[str] | None = None
    implemented_penalties: list[str] | None = None
    fine_amount: Decimal | None = None
    fine_paid: bool = False
    can_release: bool = True
    released_at: datetime | None
    released_by: int | None
    # Display enrichment from existing Student / UfmCase / AuditLog joins
    student_roll: str | None = None
    student_name: str | None = None
    student_department: str | None = None
    student_program: str | None = None
    case_number: str | None = None
    case_status: str | None = None
    released_by_name: str | None = None
    held_by: int | None = None
    held_by_name: str | None = None
    held_at: datetime | None = None
    hold_source: str | None = None

    model_config = {"from_attributes": True}


class ResultControlCaseSummary(BaseModel):
    """Compact hold summary nested on UFM case payloads."""

    id: int
    result_status: str
    transcript_status: str
    reason: str
    recommended_penalties: list[str] | None = None
    implemented_penalties: list[str] | None = None
    fine_amount: Decimal | None = None
    fine_paid: bool = False
    can_release: bool = True
    released_at: datetime | None = None
    released_by: int | None = None
    released_by_name: str | None = None
    held_by: int | None = None
    held_by_name: str | None = None
    held_at: datetime | None = None
    hold_source: str | None = None
    case_id: int
    case_number: str | None = None
    student_name: str | None = None
    student_roll: str | None = None
