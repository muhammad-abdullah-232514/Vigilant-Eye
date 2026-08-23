from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """JSON body the client sends when creating a user."""

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=4, max_length=100)
    role: str = Field(min_length=1, max_length=50)


class UserOut(BaseModel):
    """JSON the API returns. Never includes the password."""

    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
