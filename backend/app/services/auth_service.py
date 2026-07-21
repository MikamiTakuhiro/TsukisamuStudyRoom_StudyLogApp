import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.student import LoginSession, Student


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def generate_initial_password(length: int | None = None) -> str:
    length = length or settings.default_password_length
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


async def generate_user_id(db: AsyncSession, role: str) -> str:
    result = await db.execute(text("SELECT generate_user_id(:role)"), {"role": role})
    return result.scalar_one()


async def create_supabase_auth_user(user_id: str, password: str, role: str) -> str | None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    try:
        from supabase import create_client

        client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        email = f"{user_id}@study.tsukisamu.local"
        response = client.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": {"role": role, "user_id": user_id},
            }
        )
        return response.user.id if response.user else None
    except Exception:
        return None


async def register_student_account(
    db: AsyncSession,
    *,
    name: str | None = None,
    last_name: str | None = None,
    first_name: str | None = None,
    grade: int,
    gender: str,
    role: str = "student",
    linked_student_id: int | None = None,
    user_id: str | None = None,
) -> tuple[Student, str]:
    password = generate_initial_password()
    if user_id is None:
        user_id = await generate_user_id(db, role)

    full_name = name or f"{last_name or ''}{first_name or ''}"
    auth_id = await create_supabase_auth_user(user_id, password, role)

    student = Student(
        name=full_name,
        last_name=last_name,
        first_name=first_name,
        grade=grade,
        gender=gender,
        user_id=user_id,
        password_hash=hash_password(password),
        role=role,
        linked_student_id=linked_student_id,
        supabase_auth_id=auth_id,
    )
    db.add(student)
    await db.flush()

    if role == "student":
        parent = Student(
            name=f"{full_name} 保護者",
            grade=grade,
            gender=gender,
            user_id=f"{user_id}-p",
            password_hash=hash_password(password),
            role="parent",
            linked_student_id=student.student_id,
        )
        parent_auth = await create_supabase_auth_user(f"{user_id}-p", password, "parent")
        parent.supabase_auth_id = parent_auth
        db.add(parent)

    await db.commit()
    await db.refresh(student)
    return student, password


async def authenticate_user(db: AsyncSession, user_id: str, password: str) -> Student | None:
    result = await db.execute(select(Student).where(Student.user_id == user_id))
    student = result.scalar_one_or_none()
    if not student or not verify_password(password, student.password_hash):
        return None
    return student


def _session_expiry(session_type: str) -> datetime:
    now = datetime.now(timezone.utc)
    if session_type == "persistent":
        return now + timedelta(days=settings.session_persistent_days)
    return now + timedelta(hours=settings.session_temporary_hours)


async def create_login_session(
    db: AsyncSession,
    student: Student,
    device_id: str,
    session_type: str,
) -> LoginSession:
    session = LoginSession(
        session_id=uuid.uuid4(),
        student_id=student.student_id,
        device_id=device_id,
        token=generate_session_token(),
        session_type=session_type,
        expires_at=_session_expiry(session_type),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_session_by_token(db: AsyncSession, token: str) -> LoginSession | None:
    result = await db.execute(
        select(LoginSession).where(LoginSession.token == token)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    now = datetime.now(timezone.utc)
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        await db.delete(session)
        await db.commit()
        return None
    session.last_accessed_at = now
    await db.commit()
    return session


async def revoke_session(db: AsyncSession, token: str) -> None:
    result = await db.execute(select(LoginSession).where(LoginSession.token == token))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.commit()


async def revoke_all_sessions(db: AsyncSession, student_id: int) -> None:
    result = await db.execute(select(LoginSession).where(LoginSession.student_id == student_id))
    for session in result.scalars():
        await db.delete(session)
    await db.commit()


def resolve_effective_student_id(user: Student) -> int:
    if user.role == "parent" and user.linked_student_id:
        return user.linked_student_id
    return user.student_id


def is_read_only_user(user: Student) -> bool:
    return user.role == "parent"


def is_admin_user(user: Student) -> bool:
    return user.role == "admin"


async def process_forgotten_checkouts(db: AsyncSession) -> int:
    result = await db.execute(text("SELECT process_forgotten_checkouts()"))
    count = result.scalar_one()
    await db.commit()
    return count


async def reset_student_passwords(db: AsyncSession, student: Student) -> str:
    """生徒と紐づく保護者のパスワードを同じ新パスワードにリセット"""
    password = generate_initial_password()
    student.password_hash = hash_password(password)
    parent_result = await db.execute(
        select(Student).where(
            Student.role == "parent", Student.linked_student_id == student.student_id
        )
    )
    parent = parent_result.scalar_one_or_none()
    if parent:
        parent.password_hash = hash_password(password)
    await db.commit()
    return password


async def detect_study_plan_gaps(db: AsyncSession) -> int:
    result = await db.execute(text("SELECT detect_study_plan_gaps()"))
    count = result.scalar_one()
    await db.commit()
    return count
