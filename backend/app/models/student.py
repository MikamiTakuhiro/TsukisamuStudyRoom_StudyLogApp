from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"

    student_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    grade: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(20))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    school_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    user_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    linked_student_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("students.student_id"), nullable=True
    )
    supabase_auth_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    linked_student: Mapped["Student | None"] = relationship(
        "Student", remote_side="Student.student_id", foreign_keys=[linked_student_id]
    )
    sessions: Mapped[list["LoginSession"]] = relationship(back_populates="student")


class LoginSession(Base):
    __tablename__ = "login_sessions"

    session_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.student_id"))
    device_id: Mapped[str] = mapped_column(String(100))
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    session_type: Mapped[str] = mapped_column(String(20))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped[Student] = relationship(back_populates="sessions")
