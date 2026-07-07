from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AspirationSchoolHistory(Base):
    __tablename__ = "aspiration_school_history"

    aspiration_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.student_id"))
    date_recorded: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    target_school: Mapped[str] = mapped_column(String(200))
    priority_rank: Mapped[int] = mapped_column(Integer, default=1)


class ExamResult(Base):
    __tablename__ = "exam_results"

    exam_result_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.student_id"))
    exam_name: Mapped[str] = mapped_column(String(200))
    exam_date: Mapped[date] = mapped_column(Date)
    subject_scores: Mapped[dict] = mapped_column(JSONB, default=dict)
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    school_judgment: Mapped[str | None] = mapped_column(String(10), nullable=True)


class StudyPlan(Base):
    __tablename__ = "study_plans"

    plan_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.student_id"))
    subject: Mapped[str] = mapped_column(String(50))
    unit: Mapped[str] = mapped_column(String(200))
    target_completion_date: Mapped[date] = mapped_column(Date)

    progress_entries: Mapped[list["ProgressTracking"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )


class ProgressTracking(Base):
    __tablename__ = "progress_tracking"

    progress_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("study_plans.plan_id"))
    completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    achievement_level: Mapped[str | None] = mapped_column(String(50), nullable=True)

    plan: Mapped["StudyPlan"] = relationship(back_populates="progress_entries")


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.student_id"))
    notification_type: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    trigger_gap_detected: Mapped[bool] = mapped_column(Boolean, default=False)
