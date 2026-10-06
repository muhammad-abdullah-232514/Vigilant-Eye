"""Student roll validation (no emails) used by every student-record creation path."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from schemas.student import StudentCreate
from student_roll import _like_literal, clean_student_roll


@pytest.mark.parametrize("roll", ["232430", " 232514 ", "BS-21/07", "DEMO001"])
def test_valid_rolls(roll):
    assert clean_student_roll(roll) == roll.strip()


@pytest.mark.parametrize("roll", ["232430@students.au.edu.pk", "a b", "", "-12", "x"])
def test_invalid_rolls(roll):
    with pytest.raises(ValueError):
        clean_student_roll(roll)


def test_schema_rejects_email_roll():
    with pytest.raises(ValidationError) as exc:
        StudentCreate(student_id="232430@students.au.edu.pk", name="A", department="CS", program="BSCS")
    assert "not an email" in str(exc.value)


def test_like_literal_escapes_wildcards():
    assert _like_literal("bs_01%") == "bs\\_01\\%"
