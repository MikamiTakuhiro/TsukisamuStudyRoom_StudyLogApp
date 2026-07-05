from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.student import Student
from app.services.auth_service import get_session_by_token, is_admin_user, is_read_only_user


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Student:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="認証が必要です")
    token = authorization.removeprefix("Bearer ").strip()
    session = await get_session_by_token(db, token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="セッションが無効です")
    await db.refresh(session, ["student"])
    return session.student


async def require_admin(user: Student = Depends(get_current_user)) -> Student:
    if not is_admin_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者権限が必要です")
    return user


async def require_writable(user: Student = Depends(get_current_user)) -> Student:
    if is_read_only_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="閲覧専用モードです")
    return user
