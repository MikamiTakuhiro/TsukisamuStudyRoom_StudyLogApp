from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.config import settings

APP_TZ = ZoneInfo(settings.timezone)


def now_app() -> datetime:
    return datetime.now(APP_TZ)


def today_app() -> date:
    return now_app().date()


def to_app_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=APP_TZ)
    return dt.astimezone(APP_TZ)


def app_date(dt: datetime) -> date:
    return to_app_tz(dt).date()


def format_time_app(dt: datetime) -> str:
    return to_app_tz(dt).strftime("%H:%M")


def ensure_aware_as_app(dt: datetime) -> datetime:
    """Admin forms send naive datetimes; treat them as JST."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=APP_TZ)
    return dt.astimezone(APP_TZ)


def combine_date_time_app(d: date, time_hm: str) -> datetime:
    hour, minute = map(int, time_hm.split(":"))
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=APP_TZ)
