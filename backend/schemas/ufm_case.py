from datetime import datetime

from pydantic import BaseModel, Field


class UfmCaseCreate(BaseModel):
    """JSON body the client sends when creating a UFM case."""

    student_id: int = Field(gt=0)
    exam_id: int = Field(gt=0)
    violation_type: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    remarks: str | None = None


class UfmCaseOut(BaseModel):
    """JSON the API returns for a UFM case."""

    id: int
    case_number: str
    student_id: int
    exam_id: int
    reported_by: int
    violation_type: str
    description: str
    remarks: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
