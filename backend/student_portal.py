"""Helpers for the student portal prototype.

Demo login student@demo.com is linked to the student row with roll DEMO001.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.student import Student
from models.user import User

DEMO_STUDENT_ROLL = "DEMO001"


def resolve_linked_student(db: Session, user: User) -> Student | None:
    """Return the Student record linked to this portal user (STUDENT role only)."""
    if user.role != "STUDENT":
        return None
    return db.scalar(
        select(Student).where(Student.student_id == DEMO_STUDENT_ROLL)
    )
