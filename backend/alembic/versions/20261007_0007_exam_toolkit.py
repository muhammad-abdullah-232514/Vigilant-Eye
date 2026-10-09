"""Exam Toolkit — exam lifecycle status + metadata and invigilator duty fields.

Revision ID: 20261007_0007_exam_toolkit
Revises: 20261004_0006_detection_model_version
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261007_0007_exam_toolkit"
down_revision: Union[str, Sequence[str], None] = "20261004_0006_detection_model_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_EXAM_COLUMNS = {
    "status": sa.Column(
        "status", sa.String(length=30), nullable=False, server_default="DRAFT"
    ),
    "title": sa.Column("title", sa.String(length=150), nullable=True),
    "exam_type": sa.Column("exam_type", sa.String(length=50), nullable=True),
    "department": sa.Column("department", sa.String(length=100), nullable=True),
    "section": sa.Column("section", sa.String(length=50), nullable=True),
    "student_count": sa.Column("student_count", sa.Integer(), nullable=True),
    "required_invigilators": sa.Column(
        "required_invigilators", sa.Integer(), nullable=False, server_default="1"
    ),
    "instructions": sa.Column("instructions", sa.Text(), nullable=True),
    "notes": sa.Column("notes", sa.Text(), nullable=True),
    "published_at": sa.Column("published_at", sa.DateTime(), nullable=True),
}

_INVIGILATOR_COLUMNS = {
    "is_primary": sa.Column(
        "is_primary", sa.Boolean(), nullable=False, server_default="0"
    ),
    "duty_status": sa.Column(
        "duty_status", sa.String(length=20), nullable=False, server_default="ASSIGNED"
    ),
}


def _existing(inspector, table: str) -> set[str]:
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    exam_cols = _existing(inspector, "exams")
    for name, column in _EXAM_COLUMNS.items():
        if name not in exam_cols:
            op.add_column("exams", column)
    if "status" not in exam_cols:
        op.create_index("ix_exams_status", "exams", ["status"])

    invig_cols = _existing(inspector, "exam_invigilators")
    for name, column in _INVIGILATOR_COLUMNS.items():
        if name not in invig_cols:
            op.add_column("exam_invigilators", column)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    invig_cols = _existing(inspector, "exam_invigilators")
    for name in _INVIGILATOR_COLUMNS:
        if name in invig_cols:
            op.drop_column("exam_invigilators", name)

    exam_cols = _existing(inspector, "exams")
    indexes = {i["name"] for i in inspector.get_indexes("exams")}
    if "ix_exams_status" in indexes:
        op.drop_index("ix_exams_status", table_name="exams")
    for name in _EXAM_COLUMNS:
        if name in exam_cols:
            op.drop_column("exams", name)
