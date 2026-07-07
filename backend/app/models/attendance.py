from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Seat(Base):
    __tablename__ = "seats"

    seat_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    seat_name: Mapped[str] = mapped_column(String(50), unique=True)
    qr_code_data: Mapped[str] = mapped_column(String(500), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.student_id"))
    seat_id: Mapped[int] = mapped_column(Integer, ForeignKey("seats.seat_id"))
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_forgotten_checkout: Mapped[bool] = mapped_column(Boolean, default=False)


class DailyStudyRecord(Base):
    __tablename__ = "daily_study_records"

    record_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attendance_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("attendance.attendance_id"), nullable=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.student_id"))
    subject: Mapped[str] = mapped_column(String(50))
    topic_unit: Mapped[str] = mapped_column(String(200))
    study_location: Mapped[str] = mapped_column(String(20), default="school")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
