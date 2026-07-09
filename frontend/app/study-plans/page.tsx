"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, Select, EmptyState } from "@/components/ui/Input";
import { academicApi, SUBJECTS, ACHIEVEMENT_LEVELS, type StudyPlan } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { displayValue, formatDateJa } from "@/lib/utils";

const SLIDE_MS = 350;

const defaultProgressForm = () => ({
  achievement_level: ACHIEVEMENT_LEVELS[0],
  completion_date: "",
});

export default function StudyPlansPage() {
  const { user, loading } = useAuth();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [form, setForm] = useState({ subject: SUBJECTS[0], unit: "", target_completion_date: "" });
  const [progressPlanId, setProgressPlanId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [progressForm, setProgressForm] = useState(defaultProgressForm);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrolledRef = useRef(false);
  const isReadOnly = user?.is_read_only ?? false;

  async function reload() {
    setPlans(await academicApi.studyPlans());
  }

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const animateOpen = useCallback((planId: number) => {
    clearCloseTimer();
    setProgressForm(defaultProgressForm());
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

  const openProgress = useCallback((planId: number) => {
    if (progressPlanId === planId && panelOpen) {
      closeProgress();
      return;
    }
    if (progressPlanId !== null) {
      clearCloseTimer();
      setPanelOpen(false);
      closeTimerRef.current = setTimeout(() => animateOpen(planId), SLIDE_MS);
      return;
    }
    animateOpen(planId);
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

    const match = plans.find((p) => p.subject === focusSubject && p.unit === focusUnit);
    if (!match) return;

    scrolledRef.current = true;
    requestAnimationFrame(() => {
      const el = document.getElementById(`study-plan-${match.plan_id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("study-plan-focus");
      window.setTimeout(() => el.classList.remove("study-plan-focus"), 2500);
    });
  }, [plans]);

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

  if (loading || !user) return <div className="p-8 font-bold text-black">読み込み中...</div>;

  return (
    <StudentShell title="学習計画" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3">学習計画を追加</h2>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await academicApi.createStudyPlan(form);
                setForm({ subject: SUBJECTS[0], unit: "", target_completion_date: "" });
                reload();
              }}
            >
              <Label>科目</Label>
              <Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Label>単元</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
              <Label>目標完了日</Label>
              <Input type="date" value={form.target_completion_date} onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })} required />
              <button type="submit" className="btn-primary w-full">追加</button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3">計画一覧</h2>
          {plans.length === 0 && <EmptyState />}
          {plans.map((p) => {
            const isMounted = progressPlanId === p.plan_id;
            return (
              <div
                key={p.plan_id}
                id={`study-plan-${p.plan_id}`}
                className="mb-3 scroll-mt-24 rounded-xl bg-[var(--surface)] p-3"
              >
                <p className="font-bold text-black">{displayValue(p.subject)} — {displayValue(p.unit)}</p>
                <p className="text-sm text-black">目標: {formatDateJa(p.target_completion_date)}</p>
                {p.progress.length === 0 ? (
                  <p className="text-sm text-black">進捗: 情報なし</p>
                ) : (
                  p.progress.map((pr) => (
                    <p key={pr.progress_id} className="text-sm text-black">
                      {displayValue(pr.achievement_level)} / {pr.completion_date ? formatDateJa(pr.completion_date) : "情報なし"}
                    </p>
                  ))
                )}
                {!isReadOnly && (
                  <>
                    <button
                      type="button"
                      data-progress-trigger={p.plan_id}
                      className="btn-secondary mt-2 w-full text-sm"
                      onClick={() => openProgress(p.plan_id)}
                    >
                      進捗を記録
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
                                completion_date: progressForm.completion_date || undefined,
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
                            <Label>完了日（任意）</Label>
                            <Input
                              type="date"
                              value={progressForm.completion_date}
                              onChange={(e) => setProgressForm({ ...progressForm, completion_date: e.target.value })}
                            />
                            <div className="flex gap-2">
                              <button type="submit" className="btn-primary flex-1">保存</button>
                              <button type="button" className="btn-secondary flex-1" onClick={closeProgress}>
                                キャンセル
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
