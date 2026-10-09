from datetime import datetime
from decimal import Decimal
import json
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from schemas._base import InputModel

PenaltyCode = Literal[
    "F_GRADE",
    "FINE",
    "SEMESTER_RELEGATION",
    "SEMESTER_F_ALL_SUBJECTS",
    "EXPULSION",
]


class CaseReviewCreate(InputModel):
    """Body for adding a review / advancing workflow."""

    action: str = Field(min_length=1, max_length=50)
    remarks: str | None = Field(default=None, max_length=5000)
    signer_name: str = Field(min_length=2, max_length=150)
    signature_ack: bool = True
    recommended_penalties: list[PenaltyCode] | None = None
    implemented_penalties: list[PenaltyCode] | None = None
    fine_amount: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    fine_paid: bool = False


class CaseReviewOut(BaseModel):
    id: int
    case_id: int
    reviewer_id: int
    reviewer_role: str
    action: str
    remarks: str | None
    created_at: datetime
    signer_name: str | None = None
    signed_at: datetime | None = None
    signature_ack: bool = False
    recommended_penalties: list[PenaltyCode] | None = None

    @field_validator("recommended_penalties", mode="before")
    @classmethod
    def decode_recommended_penalties(cls, value):
        if isinstance(value, str):
            return json.loads(value)
        return value

    model_config = {"from_attributes": True}
