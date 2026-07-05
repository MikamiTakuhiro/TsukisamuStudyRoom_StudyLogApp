from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.academic import Notification
from app.models.student import Student
from app.schemas import NotificationResponse
from app.services.auth_service import resolve_effective_student_id

router = APIRouter(prefix="/notifications", tags=["notifications"])


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
