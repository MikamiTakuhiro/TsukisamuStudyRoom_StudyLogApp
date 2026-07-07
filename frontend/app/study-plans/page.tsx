"use client";

import { useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, Select, EmptyState } from "@/components/ui/Input";
import { academicApi, SUBJECTS, ACHIEVEMENT_LEVELS, type StudyPlan } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { displayValue, formatDateJa } from "@/lib/utils";

export default function StudyPlansPage() {
  const { user, loading } = useAuth();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [form, setForm] = useState({ subject: SUBJECTS[0], unit: "", target_completion_date: "" });
  const [progressPlanId, setProgressPlanId] = useState<number | null>(null);
  const [progressForm, setProgressForm] = useState({ achievement_level: ACHIEVEMENT_LEVELS[0], completion_date: "" });
  const isReadOnly = user?.is_read_only ?? false;

  async function reload() {
    setPlans(await academicApi.studyPlans());
  }

  useEffect(() => {
    if (user) reload().catch(console.error);
  }, [user]);

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
          {plans.map((p) => (
            <div key={p.plan_id} className="mb-3 rounded-xl bg-[var(--surface)] p-3">
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
                <button type="button" className="btn-secondary mt-2 w-full text-sm" onClick={() => setProgressPlanId(p.plan_id)}>
                  進捗を記録
                </button>
              )}
            </div>
          ))}
        </section>

        {progressPlanId && !isReadOnly && (
          <section className="card border-2 border-[var(--moon-yellow)]">
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await academicApi.createProgress({
                  plan_id: progressPlanId,
                  achievement_level: progressForm.achievement_level,
                  completion_date: progressForm.completion_date || undefined,
                });
                setProgressPlanId(null);
                reload();
              }}
            >
              <Label>達成度</Label>
              <Select value={progressForm.achievement_level} onChange={(e) => setProgressForm({ ...progressForm, achievement_level: e.target.value })}>
                {ACHIEVEMENT_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
              <Label>完了日（任意）</Label>
              <Input type="date" value={progressForm.completion_date} onChange={(e) => setProgressForm({ ...progressForm, completion_date: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">保存</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setProgressPlanId(null)}>キャンセル</button>
              </div>
            </form>
          </section>
        )}
      </div>
    </StudentShell>
  );
}
