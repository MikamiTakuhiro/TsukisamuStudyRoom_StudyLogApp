"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, Select, EmptyState } from "@/components/ui/Input";
import { academicApi, ACHIEVEMENT_LEVELS, type StudyPlan } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";
import { Ft, FuriganaSubject, FormatDateJa } from "@/components/FuriganaText";
import { getSubjects, displaySubject, storageSubject } from "@/lib/subjects";

const SLIDE_MS = 350;

function isPlanCompleted(plan: StudyPlan): boolean {
  return plan.progress.some((pr) => pr.completion_date != null);
}

function latestCompletionDate(plan: StudyPlan): string | null {
  const dates = plan.progress
    .map((pr) => pr.completion_date)
    .filter((d): d is string => d != null);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

function sortPlans(plans: StudyPlan[]): StudyPlan[] {
  const incomplete = plans.filter((p) => !isPlanCompleted(p));
  const completed = plans.filter((p) => isPlanCompleted(p));

  incomplete.sort((a, b) => a.target_completion_date.localeCompare(b.target_completion_date));
  completed.sort((a, b) => {
    const dateA = latestCompletionDate(a) ?? a.target_completion_date;
    const dateB = latestCompletionDate(b) ?? b.target_completion_date;
    return dateA.localeCompare(dateB);
  });

  return [...incomplete, ...completed];
}

const defaultProgressForm = (targetDate = "") => ({
  achievement_level: ACHIEVEMENT_LEVELS[0],
  target_completion_date: targetDate,
});

export default function StudyPlansPage() {
  const { user, loading } = useAuth();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [form, setForm] = useState({ subject: "国語", unit: "", target_completion_date: "" });
  const [progressPlanId, setProgressPlanId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [progressForm, setProgressForm] = useState(defaultProgressForm());
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrolledRef = useRef(false);
  const openedProgressRef = useRef(false);
  const isReadOnly = user?.is_read_only ?? false;
  const subjects = useMemo(() => (user ? getSubjects(user.grade) : []), [user]);
  const sortedPlans = useMemo(() => sortPlans(plans), [plans]);

  useEffect(() => {
    if (!user || subjects.length === 0) return;
    setForm((f) => ({ ...f, subject: subjects[0] }));
  }, [user, subjects]);

  async function reload() {
    setPlans(await academicApi.studyPlans());
  }

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const animateOpen = useCallback((planId: number, targetDate: string) => {
    clearCloseTimer();
    setProgressForm(defaultProgressForm(targetDate));
    setProgressPlanId(planId);
    setPanelOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelOpen(true));
    });
  }, [clearCloseTimer]);

  const closeProgress = useCallback(() => {
    clearCloseTimer();
    setPanelOpen(false);
    closeTimerRef.current = setTimeout(() => {
      setProgressPlanId(null);
      closeTimerRef.current = null;
    }, SLIDE_MS);
  }, [clearCloseTimer]);

  const openProgress = useCallback((planId: number, targetDate: string) => {
    if (progressPlanId === planId && panelOpen) {
      closeProgress();
      return;
    }
    if (progressPlanId !== null) {
      clearCloseTimer();
      setPanelOpen(false);
      closeTimerRef.current = setTimeout(() => animateOpen(planId, targetDate), SLIDE_MS);
      return;
    }
    animateOpen(planId, targetDate);
  }, [progressPlanId, panelOpen, closeProgress, clearCloseTimer, animateOpen]);

  useEffect(() => {
    if (user) reload().catch(console.error);
  }, [user]);

  useEffect(() => {
    if (plans.length === 0 || scrolledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const focusSubject = params.get("subject");
    const focusUnit = params.get("unit");
    if (!focusSubject || !focusUnit) return;

    const match = plans.find(
      (p) =>
        p.unit === focusUnit &&
        (p.subject === focusSubject ||
          (focusSubject === "算数" && p.subject === "数学") ||
          (focusSubject === "数学" && p.subject === "算数")),
    );
    if (!match) return;

    scrolledRef.current = true;
    requestAnimationFrame(() => {
      const el = document.getElementById(`study-plan-${match.plan_id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("study-plan-focus");
      window.setTimeout(() => el.classList.remove("study-plan-focus"), 2500);
    });

    if (!openedProgressRef.current && params.get("openProgress") === "1" && !isPlanCompleted(match)) {
      openedProgressRef.current = true;
      openProgress(match.plan_id, match.target_completion_date);
    }
  }, [plans, openProgress]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => {
    if (progressPlanId === null) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as HTMLElement;
      if (target.closest(`[data-progress-trigger="${progressPlanId}"]`)) return;
      if (target.closest(`[data-progress-panel="${progressPlanId}"]`)) return;
      closeProgress();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [progressPlanId, closeProgress]);

  if (loading || !user) {
    return (
      <div className="p-8 font-bold text-black">
        <Ft>読み込み中...</Ft>
      </div>
    );
  }

  return (
    <StudentShell title="学習計画" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3"><Ft>学習計画を追加</Ft></h2>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await academicApi.createStudyPlan({
                  ...form,
                  subject: storageSubject(form.subject, user.grade),
                });
                setForm({ subject: subjects[0], unit: "", target_completion_date: "" });
                reload();
              }}
            >
              <Label>科目</Label>
              <Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Label>単元</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
              <Label>目標完了日</Label>
              <Input type="date" value={form.target_completion_date} onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })} required />
              <button type="submit" className="btn-primary w-full"><Ft>追加</Ft></button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3"><Ft>計画一覧</Ft></h2>
          {sortedPlans.length === 0 && <EmptyState />}
          {sortedPlans.map((p) => {
            const completed = isPlanCompleted(p);
            const completionDate = latestCompletionDate(p);
            const isMounted = progressPlanId === p.plan_id;
            return (
              <div
                key={p.plan_id}
                id={`study-plan-${p.plan_id}`}
                className="mb-3 scroll-mt-24 rounded-xl bg-[var(--surface)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-black">
                    <FuriganaSubject subject={p.subject} grade={user.grade} /> — {displayValue(p.unit)}
                  </p>
                  {completed && (
                    <span className="badge-complete shrink-0"><Ft>完了</Ft></span>
                  )}
                </div>
                <p className="text-sm text-black">
                  <Ft>目標</Ft>: <FormatDateJa iso={p.target_completion_date} />
                </p>
                {completed && completionDate ? (
                  <p className="text-sm text-black">
                    <Ft>完了日</Ft>: <FormatDateJa iso={completionDate} />
                  </p>
                ) : p.progress.length === 0 ? (
                  <p className="text-sm text-black"><Ft>進捗: 情報なし</Ft></p>
                ) : (
                  p.progress.map((pr) => (
                    <p key={pr.progress_id} className="text-sm text-black">
                      <Ft>{displayValue(pr.achievement_level)}</Ft>
                      {pr.completion_date ? (
                        <>
                          {" / "}
                          <Ft>完了日</Ft>: <FormatDateJa iso={pr.completion_date} />
                        </>
                      ) : null}
                    </p>
                  ))
                )}
                {!isReadOnly && !completed && (
                  <>
                    <button
                      type="button"
                      data-progress-trigger={p.plan_id}
                      className="btn-secondary mt-2 w-full text-sm"
                      onClick={() => openProgress(p.plan_id, p.target_completion_date)}
                    >
                      <Ft>進捗を記録</Ft>
                    </button>
                    {isMounted && (
                      <div
                        className={`progress-slide ${panelOpen ? "is-open" : ""}`}
                        data-progress-panel={p.plan_id}
                      >
                        <div className="progress-slide-inner">
                          <form
                            className="progress-slide-form space-y-3"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              await academicApi.createProgress({
                                plan_id: p.plan_id,
                                achievement_level: progressForm.achievement_level,
                                target_completion_date: progressForm.target_completion_date || undefined,
                              });
                              closeProgress();
                              reload();
                            }}
                          >
                            <Label>達成度</Label>
                            <Select
                              value={progressForm.achievement_level}
                              onChange={(e) => setProgressForm({ ...progressForm, achievement_level: e.target.value })}
                            >
                              {ACHIEVEMENT_LEVELS.map((l) => (
                                <option key={l}>{l}</option>
                              ))}
                            </Select>
                            <Label>目標完了日の変更</Label>
                            <Input
                              type="date"
                              value={progressForm.target_completion_date}
                              onChange={(e) =>
                                setProgressForm({ ...progressForm, target_completion_date: e.target.value })
                              }
                              required
                            />
                            {progressForm.achievement_level === "完了" && (
                              <p className="text-xs font-medium text-black">
                                <Ft>「完了」を保存すると、今日の日付が完了日として自動記録されます。</Ft>
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button type="submit" className="btn-primary flex-1"><Ft>保存</Ft></button>
                              <button type="button" className="btn-secondary flex-1" onClick={closeProgress}>
                                <Ft>キャンセル</Ft>
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </StudentShell>
  );
}
