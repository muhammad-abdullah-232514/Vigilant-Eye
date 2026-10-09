from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class EvidenceLinkRequest(BaseModel):
    """Existing evidence records to attach to an accessible case."""

    evidence_ids: list[int] = Field(min_length=1, max_length=25)

    @field_validator("evidence_ids")
    @classmethod
    def validate_evidence_ids(cls, value: list[int]) -> list[int]:
        if any(evidence_id <= 0 for evidence_id in value):
            raise ValueError("evidence_ids must contain positive integers")
        if len(set(value)) != len(value):
            raise ValueError("evidence_ids must not contain duplicates")
        return value


class EvidenceOut(BaseModel):
    """JSON the API returns for evidence metadata."""

    id: int
    case_id: int | None
    detection_id: int | None
    evidence_type: str
    file_path: str
    timestamp: datetime
    camera_id: int | None
    seat_location: str | None
    confidence: float | None
    uploaded_by: int | None
    is_demo: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
