from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """JSON body the client sends when creating a user.

    Password is intentionally NOT whitespace-stripped — trimming would silently
    alter the secret the user typed. Name/role are trimmed to reject
    whitespace-only values that would otherwise satisfy min_length.
    """

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    # Production minimum: 8 characters. Demo seed password Demo@123 satisfies this.
    password: str = Field(min_length=8, max_length=100)
    role: str = Field(min_length=1, max_length=50)

    @field_validator("name", "role")
    @classmethod
    def _strip_required(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Value cannot be empty or whitespace only")
        return cleaned


class UserOut(BaseModel):
    """JSON the API returns. Never includes the password."""

    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
