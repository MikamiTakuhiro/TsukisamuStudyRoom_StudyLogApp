from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
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
    CalendarWeek,
    CheckInRequest,
    StudyRecordCreate,
    StudyRecordResponse,
    TimelineDay,
    CalendarDay,
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
                study_location=getattr(rec, "study_location", "school") or "school",
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
    location = body.study_location or ("school" if active else "home")
    rec = DailyStudyRecord(
        student_id=student_id,
        attendance_id=active.attendance_id if active else None,
        subject=body.subject,
        topic_unit=body.topic_unit,
        study_location=location,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return StudyRecordResponse(
        record_id=rec.record_id,
        subject=rec.subject,
        topic_unit=rec.topic_unit,
        study_location=rec.study_location,
        recorded_at=rec.recorded_at,
    )


def _week_start_sunday(d: date) -> date:
    return d - timedelta(days=(d.weekday() + 1) % 7)


def _format_time(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%H:%M")


@router.get("/calendar", response_model=list[CalendarWeek])
async def study_calendar(
    weeks: int = Query(default=26, ge=4, le=104),
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    att_result = await db.execute(
        select(Attendance, Seat.seat_name).join(Seat, Seat.seat_id == Attendance.seat_id).where(
            Attendance.student_id == student_id
        )
    )
    study_result = await db.execute(
        select(DailyStudyRecord).where(DailyStudyRecord.student_id == student_id)
    )

    day_att: dict[date, list] = {}
    day_study: dict[date, list] = {}
    for att, seat_name in att_result.all():
        d = att.check_in_time.date()
        day_att.setdefault(d, []).append((att, seat_name))
    for rec in study_result.scalars():
        d = rec.recorded_at.date()
        day_study.setdefault(d, []).append(rec)

    today = date.today()
    current_week_start = _week_start_sunday(today)
    calendar_weeks: list[CalendarWeek] = []

    for w in range(weeks):
        week_start = current_week_start - timedelta(weeks=w)
        days = []
        for i in range(7):
            d = week_start + timedelta(days=i)
            att_list = day_att.get(d, [])
            study_list = day_study.get(d, [])
            has_attendance = len(att_list) > 0
            has_home = any(getattr(s, "study_location", "school") == "home" for s in study_list)

            if has_attendance and has_home:
                color = "stripe"
            elif has_attendance:
                color = "yellow"
            elif has_home:
                color = "navy"
            else:
                color = "white"

            lines: list[str] = []
            for att, seat_name in att_list:
                cin = _format_time(att.check_in_time)
                cout = _format_time(att.check_out_time) if att.check_out_time else "未退室"
                subs = ", ".join(
                    f"{s.subject}" for s in study_list if getattr(s, "study_location", "school") == "school"
                )
                detail = f"塾 {cin}-{cout} ({seat_name or '?'})"
                if subs:
                    detail += f" ({subs})"
                lines.append(detail)
            for s in study_list:
                if getattr(s, "study_location", "school") == "home":
                    t = _format_time(s.recorded_at)
                    lines.append(f"家 {t} ({s.subject} {s.topic_unit})")

            days.append(CalendarDay(date=d, color=color, summary_lines=lines))

        calendar_weeks.append(CalendarWeek(week_start=week_start, days=days))

    return list(reversed(calendar_weeks))


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
