from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.academic import AspirationSchoolHistory, ExamResult, Notification, StudyPlan
from app.models.attendance import Attendance, DailyStudyRecord, Seat
from app.models.student import Student
from app.schemas import (
    AccountExportResponse,
    AdminCreateRequest,
    AspirationResponse,
    AttendanceResponse,
    ExamResultFullResponse,
    ExamResultResponse,
    BroadcastNotificationRequest,
    NotificationResponse,
    SeatCreateRequest,
    SeatResponse,
    SeatUpdateRequest,
    StudentCreateRequest,
    StudentCreateResponse,
    StudentFullProfile,
    StudentUpdateRequest,
    StudyPlanResponse,
    StudyRecordResponse,
    UserResponse,
)
from app.services.auth_service import (
    is_read_only_user,
    register_student_account,
    reset_student_passwords,
)
from app.routers.academic import _plan_responses

router = APIRouter(prefix="/admin", tags=["admin"])


def _user_response(user: Student) -> UserResponse:
    return UserResponse(
        student_id=user.student_id,
        user_id=user.user_id,
        name=user.name,
        grade=user.grade,
        gender=user.gender,
        role=user.role,
        is_read_only=is_read_only_user(user),
        phone=user.phone,
        email=user.email,
        birth_date=user.birth_date,
        school_name=user.school_name,
    )


@router.post("/students", response_model=StudentCreateResponse)
async def create_student(
    body: StudentCreateRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    student, password = await register_student_account(
        db,
        last_name=body.last_name,
        first_name=body.first_name,
        grade=body.grade,
        gender=body.gender,
        role="student",
    )
    return StudentCreateResponse(
        student=_user_response(student),
        parent_user_id=f"{student.user_id}-p",
        initial_password=password,
    )


@router.post("/admins", response_model=StudentCreateResponse)
async def create_admin(
    body: AdminCreateRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    admin, password = await register_student_account(
        db,
        name=body.name,
        grade=body.grade,
        gender=body.gender,
        role="admin",
    )
    return StudentCreateResponse(
        student=_user_response(admin),
        parent_user_id="",
        initial_password=password,
    )


@router.get("/students", response_model=list[UserResponse])
async def list_students(
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.role == "student").order_by(Student.user_id))
    return [_user_response(s) for s in result.scalars()]


@router.get("/students/{student_id}/full", response_model=StudentFullProfile)
async def get_student_full(
    student_id: int,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "student" and user.student_id != student_id:
        raise HTTPException(status_code=403, detail="権限がありません")
    if user.role == "parent" and user.linked_student_id != student_id:
        raise HTTPException(status_code=403, detail="権限がありません")
    if user.role not in ("admin", "student", "parent"):
        raise HTTPException(status_code=403, detail="権限がありません")

    student_result = await db.execute(
        select(Student).where(Student.student_id == student_id, Student.role == "student")
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")

    asp = await db.execute(
        select(AspirationSchoolHistory)
        .where(AspirationSchoolHistory.student_id == student_id)
        .order_by(AspirationSchoolHistory.priority_rank)
    )
    exams = await db.execute(
        select(ExamResult).where(ExamResult.student_id == student_id).order_by(ExamResult.exam_date.desc())
    )
    att = await db.execute(
        select(Attendance, Seat.seat_name)
        .join(Seat, Seat.seat_id == Attendance.seat_id)
        .where(Attendance.student_id == student_id)
        .order_by(Attendance.check_in_time.desc())
    )
    study = await db.execute(
        select(DailyStudyRecord)
        .where(DailyStudyRecord.student_id == student_id)
        .order_by(DailyStudyRecord.recorded_at.desc())
    )
    notif = await db.execute(
        select(Notification).where(Notification.student_id == student_id).order_by(Notification.sent_at.desc())
    )

    attendances = [
        AttendanceResponse(
            attendance_id=a.attendance_id,
            student_id=a.student_id,
            seat_id=a.seat_id,
            seat_name=seat_name,
            check_in_time=a.check_in_time,
            check_out_time=a.check_out_time,
            is_forgotten_checkout=a.is_forgotten_checkout,
        )
        for a, seat_name in att.all()
    ]

    return StudentFullProfile(
        student=_user_response(student),
        aspirations=list(asp.scalars()),
        study_plans=await _plan_responses(db, student_id),
        exam_results=list(exams.scalars()),
        attendances=attendances,
        study_records=[
            StudyRecordResponse(
                record_id=r.record_id,
                subject=r.subject,
                topic_unit=r.topic_unit,
                study_location=getattr(r, "study_location", "school") or "school",
                recorded_at=r.recorded_at,
            )
            for r in study.scalars()
        ],
        notifications=list(notif.scalars()),
    )


@router.patch("/students/{student_id}", response_model=UserResponse)
async def update_student(
    student_id: int,
    body: StudentUpdateRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student).where(Student.student_id == student_id, Student.role == "student")
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")
    if body.name is not None:
        student.name = body.name
    if body.grade is not None:
        student.grade = body.grade
    if body.gender is not None:
        student.gender = body.gender
    if body.phone is not None:
        student.phone = body.phone or None
    if body.email is not None:
        student.email = body.email or None
    if body.birth_date is not None:
        student.birth_date = body.birth_date
    if body.school_name is not None:
        student.school_name = body.school_name or None
    await db.commit()
    await db.refresh(student)
    return _user_response(student)


@router.post("/students/{student_id}/account-export", response_model=AccountExportResponse)
async def export_student_account(
    student_id: int,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student).where(Student.student_id == student_id, Student.role == "student")
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")
    new_password = await reset_student_passwords(db, student)
    parent_result = await db.execute(
        select(Student).where(Student.role == "parent", Student.linked_student_id == student_id)
    )
    parent = parent_result.scalar_one_or_none()
    return AccountExportResponse(
        name=student.name,
        user_id=student.user_id,
        parent_user_id=parent.user_id if parent else None,
        new_password=new_password,
    )


@router.get("/students/{student_id}/exams", response_model=list[ExamResultResponse])
async def student_exams(
    student_id: int,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "student" and user.student_id != student_id:
        raise HTTPException(status_code=403, detail="権限がありません")
    if user.role == "parent" and user.linked_student_id != student_id:
        raise HTTPException(status_code=403, detail="権限がありません")
    if user.role not in ("admin", "student", "parent"):
        raise HTTPException(status_code=403, detail="権限がありません")

    result = await db.execute(
        select(ExamResult).where(ExamResult.student_id == student_id).order_by(ExamResult.exam_date.desc())
    )
    return list(result.scalars())


@router.post("/seats", response_model=SeatResponse)
async def create_seat(
    body: SeatCreateRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.attendance import Seat

    qr = body.qr_code_data or f"seat:{body.seat_name}"
    seat = Seat(seat_name=body.seat_name, qr_code_data=qr)
    db.add(seat)
    await db.commit()
    await db.refresh(seat)
    return seat


@router.get("/seats", response_model=list[SeatResponse])
async def list_seats(
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.attendance import Seat

    result = await db.execute(select(Seat).order_by(Seat.seat_name))
    return list(result.scalars())


@router.patch("/seats/{seat_id}", response_model=SeatResponse)
async def update_seat(
    seat_id: int,
    body: SeatUpdateRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.attendance import Seat

    result = await db.execute(select(Seat).where(Seat.seat_id == seat_id))
    seat = result.scalar_one_or_none()
    if not seat:
        raise HTTPException(status_code=404, detail="座席が見つかりません")
    if body.seat_name is not None:
        seat.seat_name = body.seat_name
    if body.qr_code_data is not None:
        seat.qr_code_data = body.qr_code_data
    elif body.seat_name is not None:
        seat.qr_code_data = f"seat:{body.seat_name}"
    await db.commit()
    await db.refresh(seat)
    return seat


@router.delete("/seats/{seat_id}")
async def delete_seat(
    seat_id: int,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.attendance import Seat

    result = await db.execute(select(Seat).where(Seat.seat_id == seat_id))
    seat = result.scalar_one_or_none()
    if not seat:
        raise HTTPException(status_code=404, detail="座席が見つかりません")
    await db.delete(seat)
    await db.commit()
    return {"ok": True}


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).order_by(Notification.sent_at.desc()).limit(100)
    )
    return list(result.scalars())


@router.post("/notifications/broadcast")
async def broadcast_notification(
    body: BroadcastNotificationRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="内容を入力してください")

    students_result = await db.execute(select(Student).where(Student.role == "student"))
    students = students_result.scalars().all()
    if not students:
        return {"sent_count": 0}

    for student in students:
        db.add(
            Notification(
                student_id=student.student_id,
                notification_type="broadcast",
                content=content,
                trigger_gap_detected=False,
            )
        )
    await db.commit()
    return {"sent_count": len(students)}


@router.post("/seed/demo")
async def seed_demo_admin(db: AsyncSession = Depends(get_db)):
    """初回セットアップ用: デモ管理者を1件作成（既存ならスキップ）"""
    result = await db.execute(select(Student).where(Student.role == "admin").limit(1))
    if result.scalar_one_or_none():
        return {"message": "管理者は既に存在します"}

    admin, password = await register_student_account(
        db,
        name="デモ管理者",
        grade=1,
        gender="未設定",
        role="admin",
    )
    return {
        "user_id": admin.user_id,
        "initial_password": password,
        "message": "デモ管理者を作成しました",
    }
