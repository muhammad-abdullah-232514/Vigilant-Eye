from datetime import datetime

from pydantic import BaseModel, Field


class ClarificationCreate(BaseModel):
    case_id: int = Field(gt=0)
    statement: str = Field(min_length=10, max_length=5000)


class ClarificationOut(BaseModel):
    id: int
    case_id: int
    student_user_id: int
    statement: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
