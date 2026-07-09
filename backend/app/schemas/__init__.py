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
    phone: str | None = None
    email: str | None = None
    birth_date: date | None = None
    school_name: str | None = None

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    phone: str | None = None
    email: str | None = None
    birth_date: date | None = None
    school_name: str | None = None


class StudentCreateRequest(BaseModel):
    last_name: str
    first_name: str
    grade: int = Field(ge=1, le=12)
    gender: str


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime
    session_type: str
    user: UserResponse


class StudentCreateResponse(BaseModel):
    student: UserResponse
    parent_user_id: str
    initial_password: str


class AdminCreateRequest(BaseModel):
    name: str
    grade: int = Field(default=1, ge=1, le=12)
    gender: str = "未設定"


class SeatCreateRequest(BaseModel):
    seat_name: str
    qr_code_data: str | None = None


class SeatUpdateRequest(BaseModel):
    seat_name: str | None = None
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
    study_location: str | None = None


class StudyRecordResponse(BaseModel):
    record_id: int
    subject: str
    topic_unit: str
    study_location: str = "school"
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


class NotificationUpdateRequest(BaseModel):
    content: str | None = None


class ActiveSeatStatus(BaseModel):
    seat_id: int
    seat_name: str
    student_name: str | None
    user_id: str | None
    check_in_time: datetime | None


class AspirationCreate(BaseModel):
    target_school: str
    priority_rank: int = 1
    date_recorded: date | None = None


class AspirationBulkCreate(BaseModel):
    schools: list[str] = Field(min_length=1, max_length=5)


class AspirationUpdate(BaseModel):
    target_school: str | None = None
    priority_rank: int | None = None
    date_recorded: date | None = None


class AspirationResponse(BaseModel):
    aspiration_id: int
    student_id: int
    date_recorded: date
    target_school: str
    priority_rank: int

    model_config = {"from_attributes": True}


class StudyPlanCreate(BaseModel):
    subject: str
    unit: str
    target_completion_date: date


class StudyPlanUpdate(BaseModel):
    subject: str | None = None
    unit: str | None = None
    target_completion_date: date | None = None


class StudyPlanResponse(BaseModel):
    plan_id: int
    student_id: int
    subject: str
    unit: str
    target_completion_date: date
    progress: list["ProgressResponse"] = []

    model_config = {"from_attributes": True}


class ProgressCreate(BaseModel):
    plan_id: int
    completion_date: date | None = None
    achievement_level: str | None = None


class ProgressUpdate(BaseModel):
    completion_date: date | None = None
    achievement_level: str | None = None


class ProgressResponse(BaseModel):
    progress_id: int
    plan_id: int
    completion_date: date | None
    achievement_level: str | None

    model_config = {"from_attributes": True}


class ExamResultCreate(BaseModel):
    exam_name: str
    exam_date: date
    subject_scores: dict = Field(default_factory=dict)
    total_score: int = 0
    school_judgment: str | None = None


class ExamResultUpdate(BaseModel):
    exam_name: str | None = None
    exam_date: date | None = None
    subject_scores: dict | None = None
    total_score: int | None = None
    school_judgment: str | None = None


class ExamResultFullResponse(ExamResultResponse):
    student_id: int

    model_config = {"from_attributes": True}


class StudentUpdateRequest(BaseModel):
    name: str | None = None
    grade: int | None = Field(default=None, ge=1, le=12)
    gender: str | None = None
    phone: str | None = None
    email: str | None = None
    birth_date: date | None = None
    school_name: str | None = None


class AccountExportResponse(BaseModel):
    name: str
    user_id: str
    parent_user_id: str | None
    new_password: str


class StudentFullProfile(BaseModel):
    student: UserResponse
    aspirations: list[AspirationResponse]
    study_plans: list[StudyPlanResponse]
    exam_results: list[ExamResultFullResponse]
    attendances: list[AttendanceResponse]
    study_records: list[StudyRecordResponse]
    notifications: list[NotificationResponse]


StudyPlanResponse.model_rebuild()


class CalendarDay(BaseModel):
    date: date
    color: str
    summary_lines: list[str]


class CalendarWeek(BaseModel):
    week_start: date
    days: list[CalendarDay]
