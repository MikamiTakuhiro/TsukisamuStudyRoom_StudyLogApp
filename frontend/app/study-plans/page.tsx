"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { EmptyState, Field, Input, PageLoading, Select, SkeletonList, SubmitButton } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { academicApi, ACHIEVEMENT_LEVELS, type StudyPlan } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";
import { Ft, FuriganaSubject, FormatDateJa } from "@/components/FuriganaText";
import { getSubjects, storageSubject } from "@/lib/subjects";

const SLIDE_MS = 350;
/** この日数以内に期限が来る計画を「もうすぐ」として強調 */
const SOON_DAYS = 3;

function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function daysUntil(isoDate: string): number {
  const [ty, tm, td] = todayIso().split("-").map(Number);
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

function isPlanCompleted(plan: StudyPlan): boolean {
  return plan.progress.some((pr) => pr.completion_date != null);
}

function latestCompletionDate(plan: StudyPlan): string | null {
  const dates = plan.progress
    .map((pr) => pr.completion_date)
    .filter((d): d is string => d != null);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

function latestLevel(plan: StudyPlan): string | null {
  for (let i = plan.progress.length - 1; i >= 0; i--) {
    const level = plan.progress[i].achievement_level;
    if (level) return level;
  }
  return null;
}

function sortPlans(plans: StudyPlan[]) {
  const incomplete = plans.filter((p) => !isPlanCompleted(p));
  const completed = plans.filter((p) => isPlanCompleted(p));

  incomplete.sort((a, b) => a.target_completion_date.localeCompare(b.target_completion_date));
  completed.sort((a, b) => {
    const dateA = latestCompletionDate(a) ?? a.target_completion_date;
    const dateB = latestCompletionDate(b) ?? b.target_completion_date;
    return dateB.localeCompare(dateA);
  });

  return { incomplete, completed };
}

const defaultProgressForm = (targetDate = "") => ({
  achievement_level: ACHIEVEMENT_LEVELS[0],
  target_completion_date: targetDate,
});

function DeadlineBadge({ targetDate }: { targetDate: string }) {
  const days = daysUntil(targetDate);
  if (days < 0) {
    return <span className="badge-deadline badge-deadline--overdue"><Ft>期限超過</Ft> {-days}<Ft>日</Ft></span>;
  }
  if (days === 0) {
    return <span className="badge-deadline badge-deadline--overdue"><Ft>今日まで</Ft></span>;
  }
  if (days <= SOON_DAYS) {
    return <span className="badge-deadline badge-deadline--soon"><Ft>あと</Ft>{days}<Ft>日</Ft></span>;
  }
  return null;
}

function LevelBar({ level }: { level: string | null }) {
  const idx = level ? ACHIEVEMENT_LEVELS.indexOf(level) : 0;
  const ratio = Math.max(0, idx) / (ACHIEVEMENT_LEVELS.length - 1);
  return (
    <div className="mt-2 flex items-center gap-2">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ACHIEVEMENT_LEVELS.length - 1}
        aria-valuenow={Math.max(0, idx)}
        aria-valuetext={level ?? "未着手"}
      >
        <div className="h-full rounded-full bg-[var(--navy)] transition-[width]" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-sm font-bold text-black"><Ft>{level ?? "未着手"}</Ft></span>
    </div>
  );
}

export default function StudyPlansPage() {
  const { toast } = useFeedback();
  const { user, loading } = useAuth();
  const [plans, setPlans] = useState<StudyPlan[] | null>(null);
  const [form, setForm] = useState({ subject: "", unit: "", target_completion_date: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [progressPlanId, setProgressPlanId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [progressForm, setProgressForm] = useState(defaultProgressForm());
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrolledRef = useRef(false);
  const openedProgressRef = useRef(false);
  const isReadOnly = user?.is_read_only ?? false;
  const subjects = useMemo(() => (user ? getSubjects(user.grade) : []), [user]);
  const sorted = useMemo(() => sortPlans(plans ?? []), [plans]);
  /** 初回描画で科目が空にならないよう、未選択時は先頭の科目を使う */
  const formSubject = form.subject || subjects[0] || "";

  const reload = useCallback(async () => {
    setPlans(await academicApi.studyPlans());
  }, []);

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
    if (!user) return;
    reload().catch((e) => {
      setPlans([]);
      toast(errorMessage(e, "学習計画の読み込みに失敗しました"), "error");
    });
  }, [user, reload, toast]);

  useEffect(() => {
    if (!plans || plans.length === 0 || scrolledRef.current) return;

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
    if (isPlanCompleted(match)) setShowCompleted(true);
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
      // 確認ダイアログやトーストの操作では閉じない
      if (target.closest(".modal-overlay, .toast-stack")) return;
      closeProgress();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [progressPlanId, closeProgress]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (adding || !user) return;
    const unit = form.unit.trim();
    if (!unit || !form.target_completion_date) return;
    setAdding(true);
    try {
      await academicApi.createStudyPlan({
        subject: storageSubject(formSubject, user.grade),
        unit,
        target_completion_date: form.target_completion_date,
      });
      setForm({ subject: formSubject, unit: "", target_completion_date: "" });
      setAddOpen(false);
      toast("学習計画を追加しました");
      await reload();
    } catch (err) {
      toast(errorMessage(err, "学習計画の追加に失敗しました"), "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveProgress(plan: StudyPlan) {
    if (savingProgress) return;
    setSavingProgress(true);
    try {
      await academicApi.createProgress({
        plan_id: plan.plan_id,
        achievement_level: progressForm.achievement_level,
        target_completion_date: progressForm.target_completion_date || undefined,
      });
      closeProgress();
      toast(progressForm.achievement_level === "完了" ? "完了おめでとう！よくがんばりました" : "進捗を記録しました");
      await reload();
    } catch (err) {
      toast(errorMessage(err, "進捗の保存に失敗しました"), "error");
    } finally {
      setSavingProgress(false);
    }
  }

  if (loading || !user) {
    return <PageLoading />;
  }

  function renderPlan(p: StudyPlan) {
    const completed = isPlanCompleted(p);
    const completionDate = latestCompletionDate(p);
    const level = latestLevel(p);
    const isMounted = progressPlanId === p.plan_id;
    const history = p.progress.filter((pr) => pr.achievement_level);
    return (
      <li
        key={p.plan_id}
        id={`study-plan-${p.plan_id}`}
        className={`scroll-mt-24 rounded-xl border-2 p-3 ${
          !completed && daysUntil(p.target_completion_date) < 0
            ? "border-red-300 bg-red-50/50"
            : "border-transparent bg-[var(--surface)]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-bold text-black">
            <span className="mr-1 inline-block rounded-md bg-[var(--navy)] px-1.5 py-0.5 text-xs text-white">
              <FuriganaSubject subject={p.subject} grade={user!.grade} />
            </span>
            {displayValue(p.unit)}
          </p>
          {completed ? (
            <span className="badge-complete shrink-0"><Ft>完了</Ft></span>
          ) : (
            <DeadlineBadge targetDate={p.target_completion_date} />
          )}
        </div>

        {completed && completionDate ? (
          <p className="mt-1 text-sm text-black">
            <Ft>完了日</Ft>: <FormatDateJa iso={completionDate} />
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-black">
              <Ft>目標</Ft>: <FormatDateJa iso={p.target_completion_date} />
            </p>
            <LevelBar level={level} />
          </>
        )}

        {history.length > 1 && (
          <details className="mt-2 text-sm">
            <summary className="flex min-h-[2.25rem] cursor-pointer items-center font-bold text-[var(--navy)]">
              <Ft>これまでの進捗</Ft>（{history.length}<Ft>件</Ft>）
            </summary>
            <ul className="mt-1 space-y-1 border-l-2 border-[var(--border)] pl-3">
              {history.map((pr) => (
                <li key={pr.progress_id} className="text-black">
                  <Ft>{displayValue(pr.achievement_level)}</Ft>
                  {pr.completion_date ? (
                    <>
                      {" / "}
                      <Ft>完了日</Ft>: <FormatDateJa iso={pr.completion_date} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        )}

        {!isReadOnly && !completed && (
          <>
            <button
              type="button"
              data-progress-trigger={p.plan_id}
              className="btn-secondary mt-2 w-full text-sm"
              aria-expanded={isMounted && panelOpen}
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
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveProgress(p);
                    }}
                  >
                    <fieldset>
                      <legend className="mb-1 text-sm font-bold text-black"><Ft>達成度</Ft></legend>
                      <div className="grid grid-cols-5 gap-1">
                        {ACHIEVEMENT_LEVELS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            aria-pressed={progressForm.achievement_level === l}
                            onClick={() => setProgressForm({ ...progressForm, achievement_level: l })}
                            className={`min-h-[2.75rem] rounded-lg border-2 px-0.5 text-xs font-bold touch-manipulation ${
                              progressForm.achievement_level === l
                                ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                                : "border-[var(--border)] bg-white text-black"
                            }`}
                          >
                            <Ft>{l}</Ft>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <Field label="目標完了日の変更" required={false} hint="変更しない場合はそのままで大丈夫です">
                      <Input
                        type="date"
                        value={progressForm.target_completion_date}
                        onChange={(e) =>
                          setProgressForm({ ...progressForm, target_completion_date: e.target.value })
                        }
                      />
                    </Field>
                    {progressForm.achievement_level === "完了" && (
                      <p className="text-xs font-medium text-black">
                        <Ft>「完了」を保存すると、今日の日付が完了日として自動記録されます。</Ft>
                      </p>
                    )}
                    <div className="flex gap-2">
                      <SubmitButton busy={savingProgress} busyLabel="保存中..." className="btn-primary flex-1">
                        保存
                      </SubmitButton>
                      <button type="button" className="btn-secondary flex-1" onClick={closeProgress} disabled={savingProgress}>
                        <Ft>キャンセル</Ft>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </li>
    );
  }

  return (
    <StudentShell title="学習計画" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            {!addOpen ? (
              <button type="button" onClick={() => setAddOpen(true)} className="btn-primary w-full">
                ＋ <Ft>学習計画を追加</Ft>
              </button>
            ) : (
              <>
                <h2 className="section-title mb-3"><Ft>学習計画を追加</Ft></h2>
                <form className="space-y-3" onSubmit={handleAdd}>
                  <Field label="科目" required>
                    <Select value={formSubject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                      {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="単元" required hint="例: 二次関数、不定詞、江戸時代">
                    <Input
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      maxLength={100}
                      enterKeyHint="next"
                      required
                    />
                  </Field>
                  <Field label="目標完了日" required>
                    <Input
                      type="date"
                      value={form.target_completion_date}
                      min={todayIso()}
                      onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })}
                      required
                    />
                  </Field>
                  <div className="flex gap-2">
                    <SubmitButton
                      busy={adding}
                      busyLabel="追加中..."
                      disabled={!form.unit.trim() || !form.target_completion_date}
                      className="btn-primary flex-1"
                    >
                      追加する
                    </SubmitButton>
                    <button type="button" className="btn-secondary flex-1" onClick={() => setAddOpen(false)} disabled={adding}>
                      <Ft>閉じる</Ft>
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3">
            <Ft>進行中の計画</Ft>
            {plans && <span className="ml-1 text-black">（{sorted.incomplete.length}）</span>}
          </h2>
          {plans === null ? (
            <SkeletonList rows={3} />
          ) : sorted.incomplete.length === 0 ? (
            <EmptyState message={isReadOnly ? "進行中の計画はありません" : "進行中の計画はありません。上のボタンから追加しましょう"} />
          ) : (
            <ul className="space-y-3">{sorted.incomplete.map(renderPlan)}</ul>
          )}
        </section>

        {plans && sorted.completed.length > 0 && (
          <section className="card">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              aria-expanded={showCompleted}
              className="flex min-h-[2.75rem] w-full items-center justify-between text-left touch-manipulation"
            >
              <span className="section-title">
                <Ft>完了した計画</Ft>
                <span className="ml-1 text-black">（{sorted.completed.length}）</span>
              </span>
              <span className="text-sm font-bold text-[var(--navy)]">
                {showCompleted ? <Ft>閉じる ▲</Ft> : <Ft>見る ▼</Ft>}
              </span>
            </button>
            {showCompleted && <ul className="mt-3 space-y-3">{sorted.completed.map(renderPlan)}</ul>}
          </section>
        )}
      </div>
    </StudentShell>
  );
}
