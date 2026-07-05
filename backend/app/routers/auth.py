from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.student import Student
from app.schemas import LoginRequest, LoginResponse, UserResponse
from app.services.auth_service import (
    authenticate_user,
    create_login_session,
    is_read_only_user,
    revoke_session,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_response(user: Student) -> UserResponse:
    return UserResponse(
        student_id=user.student_id,
        user_id=user.user_id,
        name=user.name,
        grade=user.grade,
        gender=user.gender,
        role=user.role,
        is_read_only=is_read_only_user(user),
    )


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.user_id, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="IDまたはパスワードが正しくありません")

    session = await create_login_session(db, user, body.device_id, body.session_type)
    return LoginResponse(
        token=session.token,
        expires_at=session.expires_at,
        session_type=session.session_type,
        user=_user_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def me(user: Student = Depends(get_current_user)):
    return _user_response(user)


@router.post("/logout")
async def logout(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        await revoke_session(db, token)
    return {"ok": True}
