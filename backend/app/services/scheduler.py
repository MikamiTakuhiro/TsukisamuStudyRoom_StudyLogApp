import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import AsyncSessionLocal
from app.services.auth_service import detect_study_plan_gaps, process_forgotten_checkouts

logger = logging.getLogger(__name__)
JST = ZoneInfo(settings.timezone)

scheduler = AsyncIOScheduler(timezone=JST)


async def run_daily_midnight_jobs() -> None:
    """日本時間0:00に退室忘れ処理と乖離通知検出を実行する。"""
    logger.info("Running daily JST midnight jobs...")
    async with AsyncSessionLocal() as db:
        try:
            checkout_count = await process_forgotten_checkouts(db)
            gap_count = await detect_study_plan_gaps(db)
            logger.info(
                "Daily jobs completed: forgotten_checkouts=%s, gap_notifications=%s",
                checkout_count,
                gap_count,
            )
        except Exception:
            logger.exception("Daily midnight jobs failed")


def start_scheduler() -> None:
    scheduler.add_job(
        run_daily_midnight_jobs,
        CronTrigger(hour=0, minute=0, timezone=JST),
        id="daily_midnight_jobs",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: daily jobs at 00:00 %s", settings.timezone)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
