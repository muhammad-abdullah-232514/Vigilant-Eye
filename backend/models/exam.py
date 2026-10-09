from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_code: Mapped[str] = mapped_column(String(50), index=True)
    course_name: Mapped[str] = mapped_column(String(150))
    semester: Mapped[str] = mapped_column(String(50))
    exam_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    room_id: Mapped[int] = mapped_column(ForeignKey("exam_rooms.id"), index=True)

    # --- Exam Toolkit (duty-roster) lifecycle fields ---
    # Status chain: DRAFT → SCHEDULED → PUBLISHED → IN_PROGRESS → COMPLETED / CANCELLED.
    # Defaulted so existing rows and the case-filing manual_exam path remain valid.
    status: Mapped[str] = mapped_column(
        String(30), default="DRAFT", server_default="DRAFT", index=True
    )
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    exam_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    section: Mapped[str | None] = mapped_column(String(50), nullable=True)
    student_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    required_invigilators: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1"
    )
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
