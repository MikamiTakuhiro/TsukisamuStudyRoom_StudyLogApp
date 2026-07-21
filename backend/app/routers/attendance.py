from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user, require_admin, require_writable
from app.models.academic import StudyPlan
from app.models.attendance import Attendance, DailyStudyRecord, Seat
from app.models.student import Student
from app.schemas import (
    ActiveSeatStatus,
    AttendanceResponse,
    AttendanceUpdateRequest,
    CalendarTargetPlan,
    CalendarWeek,
    CheckInRequest,
    StudyRecordCreate,
    StudyRecordResponse,
    TimelineDay,
    CalendarDay,
    AttendanceSummaryResponse,
    AttendanceVisitItem,
    MonthlyAttendanceStats,
)
from app.services.auth_service import resolve_effective_student_id
from app.timezone_utils import app_date, ensure_aware_as_app, format_time_app, now_app, today_app

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

    att = Attendance(student_id=student_id, seat_id=seat.seat_id, check_in_time=now_app())
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
    att.check_out_time = now_app()
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
        d = app_date(att.check_in_time)
        if d not in days:
            days[d] = {"attendances": [], "study_records": []}
        days[d]["attendances"].append(_attendance_response(att, seat_name))

    for rec in study_result.scalars():
        d = app_date(rec.recorded_at)
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
        recorded_at=now_app(),
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


def _visit_duration_minutes(att: Attendance, *, end_at: datetime | None = None) -> int | None:
    if att.check_out_time:
        end = ensure_aware_as_app(att.check_out_time)
    elif end_at:
        end = end_at
    else:
        return None
    start = ensure_aware_as_app(att.check_in_time)
    return max(0, int((end - start).total_seconds() // 60))


@router.get("/summary", response_model=AttendanceSummaryResponse)
async def attendance_summary(
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    result = await db.execute(
        select(Attendance, Seat.seat_name)
        .join(Seat, Seat.seat_id == Attendance.seat_id)
        .where(Attendance.student_id == student_id)
        .order_by(Attendance.check_in_time.desc())
    )
    rows = result.all()
    now = now_app()
    today = today_app()

    monthly_map: dict[tuple[int, int], dict[str, int]] = {}
    total_minutes = 0
    completed_count = 0
    recent_visits: list[AttendanceVisitItem] = []

    for att, seat_name in rows:
        d = app_date(att.check_in_time)
        key = (d.year, d.month)
        if key not in monthly_map:
            monthly_map[key] = {"visit_count": 0, "total_minutes": 0, "completed_count": 0}
        monthly_map[key]["visit_count"] += 1

        duration = _visit_duration_minutes(att, end_at=now if att.check_out_time is None else None)
        if duration is not None:
            total_minutes += duration
            completed_count += 1
            monthly_map[key]["total_minutes"] += duration
            monthly_map[key]["completed_count"] += 1

        recent_visits.append(
            AttendanceVisitItem(
                attendance_id=att.attendance_id,
                date=d,
                seat_name=seat_name,
                check_in_time=att.check_in_time,
                check_out_time=att.check_out_time,
                duration_minutes=duration,
                is_forgotten_checkout=att.is_forgotten_checkout,
            )
        )

    monthly_stats: list[MonthlyAttendanceStats] = []
    for (year, month), stats in sorted(monthly_map.items(), reverse=True):
        avg = (
            round(stats["total_minutes"] / stats["completed_count"])
            if stats["completed_count"] > 0
            else 0
        )
        monthly_stats.append(
            MonthlyAttendanceStats(
                year=year,
                month=month,
                visit_count=stats["visit_count"],
                total_minutes=stats["total_minutes"],
                average_minutes=avg,
            )
        )

    this_month_key = (today.year, today.month)
    this_month_raw = monthly_map.get(this_month_key, {"visit_count": 0, "total_minutes": 0, "completed_count": 0})
    this_month_avg = (
        round(this_month_raw["total_minutes"] / this_month_raw["completed_count"])
        if this_month_raw["completed_count"] > 0
        else 0
    )
    this_month = MonthlyAttendanceStats(
        year=today.year,
        month=today.month,
        visit_count=this_month_raw["visit_count"],
        total_minutes=this_month_raw["total_minutes"],
        average_minutes=this_month_avg,
    )

    return AttendanceSummaryResponse(
        total_visits=len(rows),
        total_minutes=total_minutes,
        average_minutes=round(total_minutes / completed_count) if completed_count > 0 else 0,
        this_month=this_month,
        monthly_stats=monthly_stats,
        recent_visits=recent_visits[:50],
    )


def _format_time(dt: datetime) -> str:
    return format_time_app(dt)


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
    plans_result = await db.execute(
        select(StudyPlan)
        .where(StudyPlan.student_id == student_id)
        .options(selectinload(StudyPlan.progress_entries))
    )
    plans = plans_result.scalars().unique().all()

    target_by_date: dict[date, list[CalendarTargetPlan]] = {}
    for plan in plans:
        completed = any(pt.completion_date is not None for pt in plan.progress_entries)
        if completed:
            continue
        target_by_date.setdefault(plan.target_completion_date, []).append(
            CalendarTargetPlan(plan_id=plan.plan_id, subject=plan.subject, unit=plan.unit)
        )

    day_att: dict[date, list] = {}
    day_study: dict[date, list] = {}
    for att, seat_name in att_result.all():
        d = app_date(att.check_in_time)
        day_att.setdefault(d, []).append((att, seat_name))
    for rec in study_result.scalars():
        d = app_date(rec.recorded_at)
        day_study.setdefault(d, []).append(rec)

    today = today_app()
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
                school_records = [
                    s for s in study_list if getattr(s, "study_location", "school") == "school"
                ]
                detail = f"塾 {cin}-{cout} ({seat_name or '?'})"
                if school_records:
                    subs = "、".join(f"{s.subject} {s.topic_unit}" for s in school_records)
                    detail += f" ({subs})"
                lines.append(detail)
            for s in study_list:
                if getattr(s, "study_location", "school") == "home":
                    t = _format_time(s.recorded_at)
                    lines.append(f"家 {t} ({s.subject} {s.topic_unit})")

            days.append(
                CalendarDay(
                    date=d,
                    color=color,
                    summary_lines=lines,
                    target_plans=target_by_date.get(d, []),
                    is_today=d == today,
                )
            )

        calendar_weeks.append(CalendarWeek(week_start=week_start, days=days))

    return list(reversed(calendar_weeks))


@router.get("/live", response_model=list[ActiveSeatStatus])
async def live_status(
    _: Student = Depends(get_current_user),
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
        att.check_in_time = ensure_aware_as_app(body.check_in_time)
    if body.check_out_time is not None:
        att.check_out_time = ensure_aware_as_app(body.check_out_time)
    if body.is_forgotten_checkout is not None:
        att.is_forgotten_checkout = body.is_forgotten_checkout
    await db.commit()
    await db.refresh(att)
    return _attendance_response(att, seat_name)
