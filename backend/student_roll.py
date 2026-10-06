"""
Student roll numbers: one validation rule + automatic portal-account linking.

A Student row is what a UFM case is filed against; case notifications / emails reach
the student only through Student.user_id. Two past failure modes this prevents:
  - an email typed as the roll ("232430@students.au.edu.pk") created a second,
    unlinked Student row, so cases filed against the real roll emailed nobody;
  - student rows created from Create Case / Students page were never linked to the
    student's existing portal account.
"""

from __future__ import annotations

import re

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # keep this module import-light: pydantic schemas use clean_student_roll
    from sqlalchemy.orm import Session

    from models.user import User

ROLL_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_/]{1,49}$")


def clean_student_roll(value: str | None) -> str:
    """Return the normalised roll number or raise ValueError with a user-facing message."""
    roll = (value or "").strip()
    if not roll:
        raise ValueError("Student roll number is required")
    if "@" in roll:
        raise ValueError(
            "Student roll must be the roll number (e.g. 232430), not an email address"
        )
    if not ROLL_PATTERN.match(roll):
        raise ValueError(
            "Student roll may contain only letters, digits, '-', '_' or '/' (e.g. 232430)"
        )
    return roll


def _like_literal(text: str) -> str:
    """Escape LIKE wildcards so a roll such as 'BS_01' matches literally."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def find_unlinked_student_user(db: "Session", roll: str) -> "User | None":
    """
    Active STUDENT account whose email starts with '<roll>@' (university pattern,
    e.g. 232430@students.au.edu.pk) and that is not yet linked to another Student row.
    Returns None unless exactly one match exists.
    """
    from sqlalchemy import func, select

    from models.student import Student
    from models.user import User

    linked_ids = select(Student.user_id).where(Student.user_id.is_not(None))
    matches = db.scalars(
        select(User).where(
            User.role == "STUDENT",
            User.is_active.is_(True),
            func.lower(User.email).like(f"{_like_literal(roll.lower())}@%", escape="\\"),
            User.id.not_in(linked_ids),
        )
    ).all()
    return matches[0] if len(matches) == 1 else None
