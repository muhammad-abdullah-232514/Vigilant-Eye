from datetime import datetime

from pydantic import BaseModel, Field


class ResultControlCreate(BaseModel):
    student_id: int = Field(gt=0)
    case_id: int = Field(gt=0)
    reason: str = Field(min_length=1)
    result_status: str = "HELD"
    transcript_status: str = "BLOCKED"


class ResultControlOut(BaseModel):
    id: int
    student_id: int
    case_id: int
    result_status: str
    transcript_status: str
    reason: str
    released_at: datetime | None
    released_by: int | None

    model_config = {"from_attributes": True}
