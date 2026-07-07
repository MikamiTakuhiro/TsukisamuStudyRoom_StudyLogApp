from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_writable
from app.models.student import Student
from app.schemas import ProfileUpdateRequest, UserResponse
from app.services.auth_service import is_read_only_user

router = APIRouter(prefix="/profile", tags=["profile"])


def _user_response(user: Student) -> UserResponse:
    return UserResponse(
        student_id=user.student_id,
        user_id=user.user_id,
        name=user.name,
        grade=user.grade,
        gender=user.gender,
        role=user.role,
        is_read_only=is_read_only_user(user),
        phone=user.phone,
        email=user.email,
        birth_date=user.birth_date,
        school_name=user.school_name,
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(user: Student = Depends(get_current_user)):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="生徒のみ編集できます")
    return _user_response(user)


@router.get("/view", response_model=UserResponse)
async def view_profile(
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "parent":
        if not user.linked_student_id:
            raise HTTPException(status_code=404, detail="紐づく生徒が見つかりません")
        result = await db.execute(select(Student).where(Student.student_id == user.linked_student_id))
        child = result.scalar_one_or_none()
        if not child:
            raise HTTPException(status_code=404, detail="生徒が見つかりません")
        resp = _user_response(child)
        resp.is_read_only = True
        return resp
    if user.role == "student":
        return _user_response(user)
    raise HTTPException(status_code=403, detail="権限がありません")


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="生徒のみ編集できます")
    if body.phone is not None:
        user.phone = body.phone
    if body.email is not None:
        user.email = body.email
    if body.birth_date is not None:
        user.birth_date = body.birth_date
    if body.school_name is not None:
        user.school_name = body.school_name
    await db.commit()
    await db.refresh(user)
    return _user_response(user)
