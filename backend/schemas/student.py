from pydantic import BaseModel, Field, field_validator

from student_roll import clean_student_roll


class StudentCreate(BaseModel):
    """JSON body the client sends when creating a student."""

    student_id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    department: str = Field(min_length=1, max_length=100)
    program: str = Field(min_length=1, max_length=100)
    user_id: int | None = Field(default=None, gt=0)

    @field_validator("student_id")
    @classmethod
    def _valid_roll(cls, value: str) -> str:
        return clean_student_roll(value)


class StudentLinkUser(BaseModel):
    """Attach or clear a portal user for an existing student."""

    user_id: int | None = Field(default=None, gt=0)


class StudentOut(BaseModel):
    """JSON the API returns for a student."""

    id: int
    student_id: str
    name: str
    department: str
    program: str
    user_id: int | None = None

    model_config = {"from_attributes": True}
