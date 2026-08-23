from pydantic import BaseModel, Field


class StudentCreate(BaseModel):
    """JSON body the client sends when creating a student."""

    student_id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    department: str = Field(min_length=1, max_length=100)
    program: str = Field(min_length=1, max_length=100)


class StudentOut(BaseModel):
    """JSON the API returns for a student."""

    id: int
    student_id: str
    name: str
    department: str
    program: str

    model_config = {"from_attributes": True}
