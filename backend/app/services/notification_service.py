import re

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.academic import Notification, StudyPlan

_PLAN_GAP_CONTENT = re.compile(r"「(.+?) (.+?)」の目標期限")


def plan_gap_content_prefix(subject: str, unit: str) -> str:
    return f"「{subject} {unit}」"


async def clear_plan_gap_notifications(
    db: AsyncSession,
    student_id: int,
    subject: str,
    unit: str,
) -> None:
    await db.execute(
        delete(Notification).where(
            Notification.student_id == student_id,
            Notification.notification_type == "plan_gap",
            Notification.content.like(f"{plan_gap_content_prefix(subject, unit)}%"),
        )
    )


async def purge_completed_plan_gap_notifications(db: AsyncSession, student_id: int) -> None:
    result = await db.execute(
        select(Notification).where(
            Notification.student_id == student_id,
            Notification.notification_type == "plan_gap",
        )
    )
    notifications = list(result.scalars())
    if not notifications:
        return

    plans_result = await db.execute(
        select(StudyPlan)
        .where(StudyPlan.student_id == student_id)
        .options(selectinload(StudyPlan.progress_entries))
    )
    plans = list(plans_result.scalars().unique())

    completed_keys = {
        (plan.subject, plan.unit)
        for plan in plans
        if any(entry.completion_date is not None for entry in plan.progress_entries)
    }

    for notification in notifications:
        match = _PLAN_GAP_CONTENT.match(notification.content)
        if not match:
            continue
        key = (match.group(1), match.group(2))
        if key in completed_keys:
            await db.delete(notification)
