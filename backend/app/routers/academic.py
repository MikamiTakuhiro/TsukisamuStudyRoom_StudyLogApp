from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user, require_admin, require_writable
from app.models.academic import (
    AspirationSchoolHistory,
    ExamResult,
    ProgressTracking,
    StudyPlan,
)
from app.models.attendance import Attendance, DailyStudyRecord, Seat
from app.models.student import Student
from app.schemas import (
    AspirationBulkCreate,
    AspirationCreate,
    AspirationResponse,
    AspirationUpdate,
    ExamResultCreate,
    ExamResultFullResponse,
    ExamResultUpdate,
    ProgressCreate,
    ProgressResponse,
    ProgressUpdate,
    StudyPlanCreate,
    StudyPlanResponse,
    StudyPlanUpdate,
)
from app.services.auth_service import resolve_effective_student_id

router = APIRouter(prefix="/academic", tags=["academic"])


def _student_id_for(user: Student, student_id: int | None = None) -> int:
    effective = resolve_effective_student_id(user)
    if user.role == "admin":
        return student_id if student_id is not None else effective
    if student_id is not None and student_id != effective:
        raise HTTPException(status_code=403, detail="権限がありません")
    return effective


async def _plan_responses(db: AsyncSession, student_id: int) -> list[StudyPlanResponse]:
    result = await db.execute(
        select(StudyPlan)
        .where(StudyPlan.student_id == student_id)
        .options(selectinload(StudyPlan.progress_entries))
        .order_by(StudyPlan.target_completion_date)
    )
    plans = result.scalars().unique().all()
    out = []
    for p in plans:
        progress = [
            ProgressResponse(
                progress_id=pt.progress_id,
                plan_id=pt.plan_id,
                completion_date=pt.completion_date,
                achievement_level=pt.achievement_level,
            )
            for pt in (getattr(p, "progress_entries", None) or [])
        ]
        out.append(
            StudyPlanResponse(
                plan_id=p.plan_id,
                student_id=p.student_id,
                subject=p.subject,
                unit=p.unit,
                target_completion_date=p.target_completion_date,
                progress=progress,
            )
        )
    return out


# --- 志望校 ---
@router.get("/aspirations", response_model=list[AspirationResponse])
async def list_aspirations(
    student_id: int | None = None,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = _student_id_for(user, student_id)
    result = await db.execute(
        select(AspirationSchoolHistory)
        .where(AspirationSchoolHistory.student_id == sid)
        .order_by(AspirationSchoolHistory.priority_rank)
    )
    return list(result.scalars())


@router.post("/aspirations/bulk", response_model=list[AspirationResponse])
async def create_aspirations_bulk(
    body: AspirationBulkCreate,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    sid = _student_id_for(user, None)
    created = []
    for idx, school in enumerate(body.schools, start=1):
        school = school.strip()
        if not school:
            continue
        row = AspirationSchoolHistory(
            student_id=sid,
            target_school=school,
            priority_rank=idx,
            date_recorded=date.today(),
        )
        db.add(row)
        created.append(row)
    await db.commit()
    for row in created:
        await db.refresh(row)
    return created


@router.post("/aspirations", response_model=AspirationResponse)
async def create_aspiration(
    body: AspirationCreate,
    student_id: int | None = None,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    sid = _student_id_for(user, student_id)
    row = AspirationSchoolHistory(
        student_id=sid,
        target_school=body.target_school,
        priority_rank=body.priority_rank,
        date_recorded=body.date_recorded or date.today(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/aspirations/{aspiration_id}", response_model=AspirationResponse)
async def update_aspiration(
    aspiration_id: int,
    body: AspirationUpdate,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AspirationSchoolHistory).where(AspirationSchoolHistory.aspiration_id == aspiration_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="志望校が見つかりません")
    sid = _student_id_for(user, row.student_id)
    if row.student_id != sid and user.role != "admin":
        raise HTTPException(status_code=403, detail="権限がありません")
    if user.role == "parent":
        raise HTTPException(status_code=403, detail="閲覧専用モードです")
    if body.target_school is not None:
        row.target_school = body.target_school
    if body.priority_rank is not None:
        row.priority_rank = body.priority_rank
    if body.date_recorded is not None:
        row.date_recorded = body.date_recorded
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/aspirations/{aspiration_id}")
async def delete_aspiration(
    aspiration_id: int,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AspirationSchoolHistory).where(AspirationSchoolHistory.aspiration_id == aspiration_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="志望校が見つかりません")
    if user.role == "parent" or (user.role == "student" and row.student_id != user.student_id):
        raise HTTPException(status_code=403, detail="権限がありません")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


# --- 学習計画 ---
@router.get("/study-plans", response_model=list[StudyPlanResponse])
async def list_study_plans(
    student_id: int | None = None,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = _student_id_for(user, student_id)
    return await _plan_responses(db, sid)


@router.post("/study-plans", response_model=StudyPlanResponse)
async def create_study_plan(
    body: StudyPlanCreate,
    student_id: int | None = None,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    sid = _student_id_for(user, student_id)
    plan = StudyPlan(
        student_id=sid,
        subject=body.subject,
        unit=body.unit,
        target_completion_date=body.target_completion_date,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return StudyPlanResponse(
        plan_id=plan.plan_id,
        student_id=plan.student_id,
        subject=plan.subject,
        unit=plan.unit,
        target_completion_date=plan.target_completion_date,
        progress=[],
    )


@router.put("/study-plans/{plan_id}", response_model=StudyPlanResponse)
async def update_study_plan(
    plan_id: int,
    body: StudyPlanUpdate,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudyPlan).where(StudyPlan.plan_id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")
    if user.role == "parent":
        raise HTTPException(status_code=403, detail="閲覧専用モードです")
    if user.role == "student" and plan.student_id != user.student_id:
        raise HTTPException(status_code=403, detail="権限がありません")
    if body.subject is not None:
        plan.subject = body.subject
    if body.unit is not None:
        plan.unit = body.unit
    if body.target_completion_date is not None:
        plan.target_completion_date = body.target_completion_date
    await db.commit()
    plans = await _plan_responses(db, plan.student_id)
    return next(p for p in plans if p.plan_id == plan_id)


@router.delete("/study-plans/{plan_id}")
async def delete_study_plan(
    plan_id: int,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudyPlan).where(StudyPlan.plan_id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")
    if user.role == "parent" or (user.role == "student" and plan.student_id != user.student_id):
        raise HTTPException(status_code=403, detail="権限がありません")
    await db.delete(plan)
    await db.commit()
    return {"ok": True}


# --- 進捗 ---
@router.post("/progress", response_model=ProgressResponse)
async def create_progress(
    body: ProgressCreate,
    user: Student = Depends(require_writable),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudyPlan).where(StudyPlan.plan_id == body.plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")
    sid = _student_id_for(user, plan.student_id)
    if plan.student_id != sid:
        raise HTTPException(status_code=403, detail="権限がありません")
    pt = ProgressTracking(
        plan_id=body.plan_id,
        completion_date=body.completion_date,
        achievement_level=body.achievement_level,
    )
    db.add(pt)
    await db.commit()
    await db.refresh(pt)
    return pt


@router.put("/progress/{progress_id}", response_model=ProgressResponse)
async def update_progress(
    progress_id: int,
    body: ProgressUpdate,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProgressTracking, StudyPlan)
        .join(StudyPlan, StudyPlan.plan_id == ProgressTracking.plan_id)
        .where(ProgressTracking.progress_id == progress_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="進捗が見つかりません")
    pt, plan = row
    if user.role == "parent":
        raise HTTPException(status_code=403, detail="閲覧専用モードです")
    if user.role == "student" and plan.student_id != user.student_id:
        raise HTTPException(status_code=403, detail="権限がありません")
    if body.completion_date is not None:
        pt.completion_date = body.completion_date
    if body.achievement_level is not None:
        pt.achievement_level = body.achievement_level
    await db.commit()
    await db.refresh(pt)
    return pt


# --- 模試 ---
@router.get("/exams", response_model=list[ExamResultFullResponse])
async def list_exams(
    student_id: int | None = None,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = _student_id_for(user, student_id)
    result = await db.execute(
        select(ExamResult).where(ExamResult.student_id == sid).order_by(ExamResult.exam_date.desc())
    )
    return list(result.scalars())


@router.post("/exams", response_model=ExamResultFullResponse)
async def create_exam(
    body: ExamResultCreate,
    student_id: int | None = None,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "parent":
        raise HTTPException(status_code=403, detail="閲覧専用モードです")
    sid = _student_id_for(user, student_id)
    row = ExamResult(
        student_id=sid,
        exam_name=body.exam_name,
        exam_date=body.exam_date,
        subject_scores=body.subject_scores,
        total_score=body.total_score,
        school_judgment=body.school_judgment,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/exams/{exam_result_id}", response_model=ExamResultFullResponse)
async def update_exam(
    exam_result_id: int,
    body: ExamResultUpdate,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ExamResult).where(ExamResult.exam_result_id == exam_result_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="模試結果が見つかりません")
    if user.role == "parent":
        raise HTTPException(status_code=403, detail="閲覧専用モードです")
    if user.role == "student" and row.student_id != user.student_id:
        raise HTTPException(status_code=403, detail="権限がありません")
    if body.exam_name is not None:
        row.exam_name = body.exam_name
    if body.exam_date is not None:
        row.exam_date = body.exam_date
    if body.subject_scores is not None:
        row.subject_scores = body.subject_scores
    if body.total_score is not None:
        row.total_score = body.total_score
    if body.school_judgment is not None:
        row.school_judgment = body.school_judgment
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/exams/{exam_result_id}")
async def delete_exam(
    exam_result_id: int,
    user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ExamResult).where(ExamResult.exam_result_id == exam_result_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="模試結果が見つかりません")
    if user.role == "parent" or (user.role == "student" and row.student_id != user.student_id):
        raise HTTPException(status_code=403, detail="権限がありません")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
