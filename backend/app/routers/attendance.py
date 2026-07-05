from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_admin, require_writable
from app.models.attendance import Attendance, DailyStudyRecord, Seat
from app.models.student import Student
from app.schemas import (
    ActiveSeatStatus,
    AttendanceResponse,
    AttendanceUpdateRequest,
    CheckInRequest,
    StudyRecordCreate,
    StudyRecordResponse,
    TimelineDay,
)
from app.services.auth_service import resolve_effective_student_id

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _attendance_response(att: Attendance, seat_name: str | None = None) -> AttendanceResponse:
    return AttendanceResponse(
        attendance_id=att.attendance_id,
        student_id=att.student_id,
        seat_id=att.seat_id,
        seat_name=seat_name,
        check_in_time=att.check_in_time,
        check_out_time=att.check_out_time,
        is_forgotten_checkout=att.is_forgotten_checkout,
    )


@router.get("/active", response_model=AttendanceResponse | None)
async def get_active_attendance(
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    result = await db.execute(
        select(Attendance, Seat.seat_name)
        .join(Seat, Seat.seat_id == Attendance.seat_id)
        .where(Attendance.student_id == student_id, Attendance.check_out_time.is_(None))
        .order_by(Attendance.check_in_time.desc())
        .limit(1)
    )
    row = result.first()
    if not row:
        return None
    att, seat_name = row
    return _attendance_response(att, seat_name)


@router.post("/scan", response_model=dict)
async def scan_qr(
    body: CheckInRequest,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    seat_result = await db.execute(select(Seat).where(Seat.qr_code_data == body.qr_code_data))
    seat = seat_result.scalar_one_or_none()
    if not seat:
        raise HTTPException(status_code=404, detail="座席が見つかりません")

    student_id = resolve_effective_student_id(user)
    active_result = await db.execute(
        select(Attendance)
        .where(Attendance.student_id == student_id, Attendance.check_out_time.is_(None))
        .limit(1)
    )
    active = active_result.scalar_one_or_none()

    mode = "check_out" if active else "check_in"
    return {
        "mode": mode,
        "seat": {"seat_id": seat.seat_id, "seat_name": seat.seat_name, "qr_code_data": seat.qr_code_data},
        "student_name": user.name,
        "active_attendance_id": active.attendance_id if active else None,
    }


@router.post("/check-in", response_model=AttendanceResponse)
async def check_in(
    body: CheckInRequest,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    seat_result = await db.execute(select(Seat).where(Seat.qr_code_data == body.qr_code_data))
    seat = seat_result.scalar_one_or_none()
    if not seat:
        raise HTTPException(status_code=404, detail="座席が見つかりません")

    student_id = resolve_effective_student_id(user)
    active_result = await db.execute(
        select(Attendance).where(Attendance.student_id == student_id, Attendance.check_out_time.is_(None))
    )
    if active_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="すでに入室中です")

    att = Attendance(student_id=student_id, seat_id=seat.seat_id)
    db.add(att)
    await db.commit()
    await db.refresh(att)
    return _attendance_response(att, seat.seat_name)


@router.post("/check-out", response_model=AttendanceResponse)
async def check_out(
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    result = await db.execute(
        select(Attendance, Seat.seat_name)
        .join(Seat, Seat.seat_id == Attendance.seat_id)
        .where(Attendance.student_id == student_id, Attendance.check_out_time.is_(None))
        .limit(1)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=400, detail="入室記録がありません")
    att, seat_name = row
    att.check_out_time = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(att)
    return _attendance_response(att, seat_name)


@router.get("/timeline", response_model=list[TimelineDay])
async def timeline(
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    att_result = await db.execute(
        select(Attendance, Seat.seat_name)
        .join(Seat, Seat.seat_id == Attendance.seat_id)
        .where(Attendance.student_id == student_id)
        .order_by(Attendance.check_in_time.desc())
    )
    study_result = await db.execute(
        select(DailyStudyRecord)
        .where(DailyStudyRecord.student_id == student_id)
        .order_by(DailyStudyRecord.recorded_at.desc())
    )

    days: dict = {}
    for att, seat_name in att_result.all():
        d = att.check_in_time.date()
        if d not in days:
            days[d] = {"attendances": [], "study_records": []}
        days[d]["attendances"].append(_attendance_response(att, seat_name))

    for rec in study_result.scalars():
        d = rec.recorded_at.date()
        if d not in days:
            days[d] = {"attendances": [], "study_records": []}
        days[d]["study_records"].append(
            StudyRecordResponse(
                record_id=rec.record_id,
                subject=rec.subject,
                topic_unit=rec.topic_unit,
                recorded_at=rec.recorded_at,
            )
        )

    return [
        TimelineDay(date=d, attendances=v["attendances"], study_records=v["study_records"])
        for d, v in sorted(days.items(), reverse=True)
    ]


@router.post("/study-records", response_model=StudyRecordResponse)
async def create_study_record(
    body: StudyRecordCreate,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    active_result = await db.execute(
        select(Attendance)
        .where(Attendance.student_id == student_id, Attendance.check_out_time.is_(None))
        .limit(1)
    )
    active = active_result.scalar_one_or_none()
    rec = DailyStudyRecord(
        student_id=student_id,
        attendance_id=active.attendance_id if active else None,
        subject=body.subject,
        topic_unit=body.topic_unit,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return StudyRecordResponse(
        record_id=rec.record_id,
        subject=rec.subject,
        topic_unit=rec.topic_unit,
        recorded_at=rec.recorded_at,
    )


@router.get("/live", response_model=list[ActiveSeatStatus])
async def live_status(
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    seats_result = await db.execute(select(Seat).order_by(Seat.seat_name))
    seats = seats_result.scalars().all()
    active_result = await db.execute(
        select(Attendance, Student, Seat)
        .join(Student, Student.student_id == Attendance.student_id)
        .join(Seat, Seat.seat_id == Attendance.seat_id)
        .where(Attendance.check_out_time.is_(None))
    )
    active_map = {seat.seat_id: (att, student) for att, student, seat in active_result.all()}

    return [
        ActiveSeatStatus(
            seat_id=seat.seat_id,
            seat_name=seat.seat_name,
            student_name=active_map[seat.seat_id][1].name if seat.seat_id in active_map else None,
            user_id=active_map[seat.seat_id][1].user_id if seat.seat_id in active_map else None,
            check_in_time=active_map[seat.seat_id][0].check_in_time if seat.seat_id in active_map else None,
        )
        for seat in seats
    ]


@router.patch("/{attendance_id}", response_model=AttendanceResponse)
async def update_attendance(
    attendance_id: int,
    body: AttendanceUpdateRequest,
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Attendance, Seat.seat_name)
        .join(Seat, Seat.seat_id == Attendance.seat_id)
        .where(Attendance.attendance_id == attendance_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="出席記録が見つかりません")
    att, seat_name = row
    if body.check_in_time is not None:
        att.check_in_time = body.check_in_time
    if body.check_out_time is not None:
        att.check_out_time = body.check_out_time
    if body.is_forgotten_checkout is not None:
        att.is_forgotten_checkout = body.is_forgotten_checkout
    await db.commit()
    await db.refresh(att)
    return _attendance_response(att, seat_name)
