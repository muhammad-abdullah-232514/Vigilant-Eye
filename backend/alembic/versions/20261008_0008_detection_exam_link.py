"""Link live detections to their examination."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261008_0008_detection_exam_link"
down_revision: Union[str, Sequence[str], None] = "20261007_0007_exam_toolkit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("detections")}

    if "exam_id" not in columns:
        op.add_column(
            "detections",
            sa.Column("exam_id", sa.Integer(), nullable=True),
        )

    foreign_keys = {
        (fk.get("name"), tuple(fk.get("constrained_columns") or ()))
        for fk in sa.inspect(bind).get_foreign_keys("detections")
    }
    if not any(columns == ("exam_id",) for _, columns in foreign_keys):
        op.create_foreign_key(
            "fk_detections_exam_id_exams",
            "detections",
            "exams",
            ["exam_id"],
            ["id"],
        )

    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("detections")}
    if "ix_detections_exam_id" not in indexes:
        op.create_index("ix_detections_exam_id", "detections", ["exam_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("detections")}
    indexes = {index["name"] for index in inspector.get_indexes("detections")}
    foreign_keys = {
        fk.get("name") for fk in inspector.get_foreign_keys("detections")
    }

    if "ix_detections_exam_id" in indexes:
        op.drop_index("ix_detections_exam_id", table_name="detections")
    if "fk_detections_exam_id_exams" in foreign_keys:
        op.drop_constraint(
            "fk_detections_exam_id_exams", "detections", type_="foreignkey"
        )
    if "exam_id" in columns:
        op.drop_column("detections", "exam_id")