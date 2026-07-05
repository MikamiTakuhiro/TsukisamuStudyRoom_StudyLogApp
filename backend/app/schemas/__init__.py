from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    user_id: str
    password: str
    device_id: str
    session_type: str = Field(default="persistent", pattern="^(persistent|temporary)$")


class UserResponse(BaseModel):
    student_id: int
    user_id: str
    name: str
    grade: int
    gender: str
    role: str
    is_read_only: bool

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime
    session_type: str
    user: UserResponse


class StudentCreateRequest(BaseModel):
    name: str
    grade: int = Field(ge=1, le=12)
    gender: str


class StudentCreateResponse(BaseModel):
    student: UserResponse
    parent_user_id: str
    initial_password: str


class AdminCreateRequest(BaseModel):
    name: str
    grade: int = Field(default=0, ge=0, le=12)
    gender: str = "未設定"


class SeatCreateRequest(BaseModel):
    seat_name: str
    qr_code_data: str | None = None


class SeatResponse(BaseModel):
    seat_id: int
    seat_name: str
    qr_code_data: str

    model_config = {"from_attributes": True}


class AttendanceResponse(BaseModel):
    attendance_id: int
    student_id: int
    seat_id: int
    seat_name: str | None = None
    check_in_time: datetime
    check_out_time: datetime | None
    is_forgotten_checkout: bool

    model_config = {"from_attributes": True}


class CheckInRequest(BaseModel):
    qr_code_data: str


class StudyRecordCreate(BaseModel):
    subject: str
    topic_unit: str


class StudyRecordResponse(BaseModel):
    record_id: int
    subject: str
    topic_unit: str
    recorded_at: datetime

    model_config = {"from_attributes": True}


class TimelineDay(BaseModel):
    date: date
    attendances: list[AttendanceResponse]
    study_records: list[StudyRecordResponse]


class AttendanceUpdateRequest(BaseModel):
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    is_forgotten_checkout: bool | None = None


class ExamResultResponse(BaseModel):
    exam_result_id: int
    exam_name: str
    exam_date: date
    subject_scores: dict
    total_score: int
    school_judgment: str | None

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    notification_id: int
    notification_type: str
    content: str
    is_read: bool
    sent_at: datetime
    trigger_gap_detected: bool

    model_config = {"from_attributes": True}


class ActiveSeatStatus(BaseModel):
    seat_id: int
    seat_name: str
    student_name: str | None
    user_id: str | None
    check_in_time: datetime | None
