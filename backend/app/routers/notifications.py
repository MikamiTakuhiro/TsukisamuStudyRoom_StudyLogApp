from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_writable
from app.models.academic import Notification
from app.models.student import Student
from app.schemas import NotificationResponse, NotificationUpdateRequest
from app.services.auth_service import resolve_effective_student_id

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def _get_owned_notification(
    notification_id: int,
    user: Student,
    db: AsyncSession,
) -> Notification:
    student_id = resolve_effective_student_id(user)
    result = await db.execute(
        select(Notification).where(
            Notification.notification_id == notification_id,
            Notification.student_id == student_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="通知が見つかりません")
    return row


@router.get("", response_model=list[NotificationResponse])
async def my_notifications(
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_id = resolve_effective_student_id(user)
    result = await db.execute(
        select(Notification)
        .where(Notification.student_id == student_id)
        .order_by(Notification.sent_at.desc())
        .limit(20)
    )
    return list(result.scalars())


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: int,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_owned_notification(notification_id, user, db)


@router.patch("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: int,
    body: NotificationUpdateRequest,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_owned_notification(notification_id, user, db)
    if body.content is not None:
        content = body.content.strip()
        if not content:
            raise HTTPException(status_code=400, detail="内容を入力してください")
        row.content = content
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_owned_notification(notification_id, user, db)
    await db.delete(row)
    await db.commit()
    return {"ok": True}
