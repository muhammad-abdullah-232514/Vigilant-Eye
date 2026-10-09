"""Exam ↔ Invigilator assignment (Phase 23)."""

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class ExamInvigilator(Base):
    __tablename__ = "exam_invigilators"
    __table_args__ = (
        UniqueConstraint("exam_id", "user_id", name="uq_exam_invigilators_exam_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # --- Exam Toolkit duty fields ---
    is_primary: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )
    # Duty chain: ASSIGNED → CONFIRMED → IN_PROGRESS → COMPLETED / ABSENT.
    duty_status: Mapped[str] = mapped_column(
        String(20), default="ASSIGNED", server_default="ASSIGNED"
    )
