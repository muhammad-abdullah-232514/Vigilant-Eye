from datetime import datetime

from pydantic import BaseModel, Field


class CaseReviewCreate(BaseModel):
    """Body for adding a review / advancing workflow."""

    action: str = Field(min_length=1, max_length=50)
    remarks: str | None = None


class CaseReviewOut(BaseModel):
    id: int
    case_id: int
    reviewer_id: int
    reviewer_role: str
    action: str
    remarks: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
