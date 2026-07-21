from datetime import date, datetime, timedelta
import json
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_admin, require_writable
from app.models.attendance import Seat, SeatReservation
from app.models.student import Student
from app.schemas import (
    AvailabilitySlot,
    DayAvailabilityResponse,
    ReservationCreateRequest,
    ReservationResponse,
    ReservationUpdateRequest,
)
from app.services.auth_service import is_admin_user, resolve_effective_student_id
from app.timezone_utils import APP_TZ, app_date, combine_date_time_app, now_app

router = APIRouter(prefix="/reservations", tags=["reservations"])

DAY_OPEN_HOUR = 9
DAY_CLOSE_HOUR = 21
SLOT_MINUTES = 60
DEBUG_LOG = "/Users/mikamitakuhiroshi/TsukisamuStudyRoom_StudyLogApp/.cursor/debug-36a705.log"


def _debug_log(location: str, message: str, data: dict, hypothesis_id: str) -> None:
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "36a705",
                        "runId": "pre-fix",
                        "hypothesisId": hypothesis_id,
                        "location": location,
                        "message": message,
                        "data": data,
                        "timestamp": int(time.time() * 1000),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    except OSError:
        pass


def _reservation_response(res: SeatReservation, student_name: str | None = None) -> ReservationResponse:
    return ReservationResponse(
        reservation_id=res.reservation_id,
        student_id=res.student_id,
        student_name=student_name,
        start_time=res.start_time,
        end_time=res.end_time,
    )


async def _total_seats(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(Seat))
    return int(result.scalar() or 0)


async def _day_reservations(db: AsyncSession, target: date) -> list[tuple[SeatReservation, str]]:
    day_start = datetime(target.year, target.month, target.day, 0, 0, tzinfo=APP_TZ)
    day_end = day_start + timedelta(days=1)
    result = await db.execute(
        select(SeatReservation, Student.name)
        .join(Student, Student.student_id == SeatReservation.student_id)
        .where(SeatReservation.start_time < day_end, SeatReservation.end_time > day_start)
        .order_by(SeatReservation.start_time)
    )
    return list(result.all())


def _max_concurrent(reservations: list, window_start: datetime, window_end: datetime) -> int:
    events: list[tuple[datetime, int]] = []
    for res in reservations:
        start = max(res.start_time, window_start)
        end = min(res.end_time, window_end)
        if start >= end:
            continue
        events.append((start, 1))
        events.append((end, -1))
    events.sort(key=lambda x: (x[0], x[1]))
    current = 0
    peak = 0
    for _, delta in events:
        current += delta
        peak = max(peak, current)
    return peak


async def _validate_capacity(
    db: AsyncSession,
    start: datetime,
    end: datetime,
    *,
    exclude_id: int | None = None,
) -> None:
    total = await _total_seats(db)
    if total <= 0:
        raise HTTPException(status_code=400, detail="座席が登録されていません")

    day_res = await _day_reservations(db, app_date(start))
    reservations = [r for r, _ in day_res if exclude_id is None or r.reservation_id != exclude_id]

    class _Interval:
        def __init__(self, s: datetime, e: datetime):
            self.start_time = s
            self.end_time = e

    with_new = reservations + [_Interval(start, end)]
    peak = _max_concurrent(with_new, start, end)
    if peak > total:
        raise HTTPException(
            status_code=409,
            detail="この時間帯は満席のため予約できません。別の時間を選んでください。",
        )


@router.get("/availability", response_model=DayAvailabilityResponse)
async def day_availability(
    target_date: date = Query(..., alias="date"),
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _debug_log("reservations.py:day_availability", "entry", {"date": str(target_date), "user_id": user.user_id}, "D")
    try:
        total = await _total_seats(db)
        day_res = await _day_reservations(db, target_date)
    except Exception as e:
        _debug_log("reservations.py:day_availability", "db_error", {"error": type(e).__name__, "msg": str(e)[:200]}, "D")
        raise
    reservations = [r for r, _ in day_res]

    slots: list[AvailabilitySlot] = []
    for hour in range(DAY_OPEN_HOUR, DAY_CLOSE_HOUR):
        slot_start = combine_date_time_app(target_date, f"{hour:02d}:00")
        slot_end = slot_start + timedelta(minutes=SLOT_MINUTES)
        reserved = _max_concurrent(reservations, slot_start, slot_end)
        available = max(0, total - reserved)
        slots.append(
            AvailabilitySlot(
                start_time=f"{hour:02d}:00",
                end_time=f"{(hour + 1):02d}:00",
                reserved_count=reserved,
                total_seats=total,
                available_seats=available,
                is_full=total > 0 and reserved >= total,
            )
        )

    reservation_items = [_reservation_response(r, name) for r, name in day_res]
    if not is_admin_user(user):
        student_id = resolve_effective_student_id(user)
        reservation_items = [r for r in reservation_items if r.student_id == student_id]

    return DayAvailabilityResponse(
        date=target_date,
        total_seats=total,
        slots=slots,
        reservations=reservation_items,
    )


@router.get("/mine", response_model=list[ReservationResponse])
async def my_reservations(
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    result = await db.execute(
        select(SeatReservation, Student.name)
        .join(Student, Student.student_id == SeatReservation.student_id)
        .where(
            SeatReservation.student_id == student_id,
            SeatReservation.end_time >= now_app(),
        )
        .order_by(SeatReservation.start_time)
    )
    return [_reservation_response(r, name) for r, name in result.all()]


@router.get("", response_model=list[ReservationResponse])
async def all_reservations(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    _: Student = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(SeatReservation, Student.name)
        .join(Student, Student.student_id == SeatReservation.student_id)
        .order_by(SeatReservation.start_time)
    )
    if from_date:
        q = q.where(SeatReservation.end_time >= combine_date_time_app(from_date, "00:00"))
    if to_date:
        q = q.where(SeatReservation.start_time < combine_date_time_app(to_date, "23:59") + timedelta(minutes=1))
    result = await db.execute(q)
    return [_reservation_response(r, name) for r, name in result.all()]


@router.post("", response_model=ReservationResponse)
async def create_reservation(
    body: ReservationCreateRequest,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    _debug_log("reservations.py:create_reservation", "entry", {"date": str(body.reservation_date), "user_id": user.user_id}, "D")
    start = combine_date_time_app(body.reservation_date, body.start_time)
    end = combine_date_time_app(body.reservation_date, body.end_time)
    if end <= start:
        raise HTTPException(status_code=400, detail="退室予定は来室予定より後にしてください")
    if start < now_app():
        raise HTTPException(status_code=400, detail="過去の日時は予約できません")

    await _validate_capacity(db, start, end)

    student_id = resolve_effective_student_id(user)
    res = SeatReservation(student_id=student_id, start_time=start, end_time=end)
    db.add(res)
    await db.commit()
    await db.refresh(res)
    return _reservation_response(res, user.name)


@router.patch("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: int,
    body: ReservationUpdateRequest,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SeatReservation, Student.name)
        .join(Student, Student.student_id == SeatReservation.student_id)
        .where(SeatReservation.reservation_id == reservation_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="予約が見つかりません")
    res, student_name = row

    if not is_admin_user(user):
        if user.role == "parent":
            raise HTTPException(status_code=403, detail="閲覧専用モードです")
        student_id = resolve_effective_student_id(user)
        if res.student_id != student_id:
            raise HTTPException(status_code=403, detail="この予約を編集する権限がありません")

    current_date = app_date(res.start_time)
    start_hm = res.start_time.astimezone(APP_TZ).strftime("%H:%M")
    end_hm = res.end_time.astimezone(APP_TZ).strftime("%H:%M")

    new_date = body.reservation_date or current_date
    new_start_hm = body.start_time or start_hm
    new_end_hm = body.end_time or end_hm
    start = combine_date_time_app(new_date, new_start_hm)
    end = combine_date_time_app(new_date, new_end_hm)

    if end <= start:
        raise HTTPException(status_code=400, detail="退室予定は来室予定より後にしてください")

    await _validate_capacity(db, start, end, exclude_id=reservation_id)

    res.start_time = start
    res.end_time = end
    await db.commit()
    await db.refresh(res)
    return _reservation_response(res, student_name)


@router.delete("/{reservation_id}")
async def delete_reservation(
    reservation_id: int,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SeatReservation).where(SeatReservation.reservation_id == reservation_id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="予約が見つかりません")

    if not is_admin_user(user):
        if user.role == "parent":
            raise HTTPException(status_code=403, detail="閲覧専用モードです")
        student_id = resolve_effective_student_id(user)
        if res.student_id != student_id:
            raise HTTPException(status_code=403, detail="この予約を削除する権限がありません")

    await db.delete(res)
    await db.commit()
    return {"ok": True}
