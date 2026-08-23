from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    """JSON the API returns for an audit log entry."""

    id: int
    user_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    description: str
    timestamp: datetime

    model_config = {"from_attributes": True}
