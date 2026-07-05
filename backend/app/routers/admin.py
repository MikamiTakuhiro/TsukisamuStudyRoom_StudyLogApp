from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.academic import ExamResult, Notification
from app.models.student import Student
from app.schemas import (
    AdminCreateRequest,
    ExamResultResponse,
    NotificationResponse,
    SeatCreateRequest,
    SeatResponse,
    StudentCreateRequest,
    StudentCreateResponse,
    UserResponse,
)
from app.services.auth_service import (
    detect_study_plan_gaps,
    is_read_only_user,
    process_forgotten_checkouts,
    register_student_account,
)

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
    )


@router.post("/students", response_model=StudentCreateResponse)
async def create_student(
    body: StudentCreateRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    student, password = await register_student_account(
        db, name=body.name, grade=body.grade, gender=body.gender, role="student"
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


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).order_by(Notification.sent_at.desc()).limit(100)
    )
    return list(result.scalars())


@router.post("/cron/forgotten-checkout")
async def run_forgotten_checkout(
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    count = await process_forgotten_checkouts(db)
    return {"processed": count}


@router.post("/cron/detect-gaps")
async def run_gap_detection(
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    count = await detect_study_plan_gaps(db)
    return {"notifications_created": count}


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
