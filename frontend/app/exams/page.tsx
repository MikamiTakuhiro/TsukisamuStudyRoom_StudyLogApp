"use client";

import { useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, EmptyState } from "@/components/ui/Input";
import { academicApi, EXAM_SUBJECTS, type ExamResult } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { displayValue, formatDateJa } from "@/lib/utils";

export default function ExamsPage() {
  const { user, loading } = useAuth();
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [form, setForm] = useState({
    exam_name: "",
    exam_date: "",
    total_score: 0,
    school_judgment: "",
    subject_scores: {} as Record<string, number>,
  });
  const isReadOnly = user?.is_read_only ?? false;

  async function reload() {
    setExams(await academicApi.exams());
  }

  useEffect(() => {
    if (user) reload().catch(console.error);
  }, [user]);

  if (loading || !user) return <div className="p-8 font-bold text-black">読み込み中...</div>;

  return (
    <StudentShell title="模試結果" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3">模試結果を入力</h2>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await academicApi.createExam({
                  exam_name: form.exam_name,
                  exam_date: form.exam_date,
                  total_score: form.total_score,
                  school_judgment: form.school_judgment,
                  subject_scores: form.subject_scores,
                });
                setForm({ exam_name: "", exam_date: "", total_score: 0, school_judgment: "", subject_scores: {} });
                reload();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>模試名</Label>
                  <Input value={form.exam_name} onChange={(e) => setForm({ ...form, exam_name: e.target.value })} required />
                </div>
                <div>
                  <Label>受験日</Label>
                  <Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} required />
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="mb-3 font-bold text-black">科目別の点数</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXAM_SUBJECTS.map((sub) => (
                    <div key={sub}>
                      <Label>{sub}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.subject_scores[sub] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            subject_scores: { ...form.subject_scores, [sub]: Number(e.target.value) || 0 },
                          })
                        }
                        placeholder="点数"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[var(--navy)] bg-[var(--moon-yellow)]/20 p-4">
                <h3 className="mb-3 font-bold text-black">合計・判定</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>合計点数</Label>
                    <Input type="number" min={0} value={form.total_score} onChange={(e) => setForm({ ...form, total_score: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>志望校判定（A/B/C等）</Label>
                    <Input value={form.school_judgment} onChange={(e) => setForm({ ...form, school_judgment: e.target.value })} placeholder="例: A" />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full">登録する</button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3">過去の模試結果</h2>
          {exams.length === 0 && <EmptyState />}
          {exams.map((ex) => (
            <div key={ex.exam_result_id} className="mb-3 rounded-xl bg-[var(--surface)] p-3">
              <p className="font-bold text-black">{displayValue(ex.exam_name)}</p>
              <p className="text-sm text-black">{formatDateJa(ex.exam_date)}</p>
              <p className="text-sm text-black">合計: {displayValue(ex.total_score)}点 / 判定: {displayValue(ex.school_judgment)}</p>
              <p className="text-sm text-black">
                科目別:{" "}
                {Object.keys(ex.subject_scores || {}).length ? JSON.stringify(ex.subject_scores) : "情報なし"}
              </p>
            </div>
          ))}
        </section>
      </div>
    </StudentShell>
  );
}
