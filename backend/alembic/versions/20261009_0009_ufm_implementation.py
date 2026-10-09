"""Persist UFM committee recommendations and Exam Department implementation."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_0009_ufm_implementation"
down_revision: Union[str, Sequence[str], None] = "20261008_0008_detection_exam_link"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "case_reviews",
        sa.Column("recommended_penalties", sa.Text(), nullable=True),
    )
    op.add_column(
        "result_controls",
        sa.Column("implemented_penalties", sa.Text(), nullable=True),
    )
    op.add_column(
        "result_controls",
        sa.Column("fine_amount", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "result_controls",
        sa.Column("fine_paid", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("result_controls", "fine_paid")
    op.drop_column("result_controls", "fine_amount")
    op.drop_column("result_controls", "implemented_penalties")
    op.drop_column("case_reviews", "recommended_penalties")
