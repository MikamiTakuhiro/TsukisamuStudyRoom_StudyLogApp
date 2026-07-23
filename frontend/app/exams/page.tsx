"use client";

import { useEffect, useMemo, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, EmptyState } from "@/components/ui/Input";
import { Ft, FuriganaSubject, FormatDateJa } from "@/components/FuriganaText";
import { academicApi, type ExamResult } from "@/lib/api";
import { getExamSubjects, storageSubject } from "@/lib/subjects";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";

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
  const examSubjects = useMemo(() => (user ? getExamSubjects(user.grade) : []), [user]);

  async function reload() {
    setExams(await academicApi.exams());
  }

  useEffect(() => {
    if (user) reload().catch(console.error);
  }, [user]);

  if (loading || !user) {
    return (
      <div className="p-8 font-bold text-black">
        <Ft>読み込み中...</Ft>
      </div>
    );
  }

  return (
    <StudentShell title="模試結果" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3"><Ft>模試結果を入力</Ft></h2>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const subject_scores = Object.fromEntries(
                  Object.entries(form.subject_scores).map(([sub, score]) => [
                    storageSubject(sub, user.grade),
                    score,
                  ]),
                );
                await academicApi.createExam({
                  exam_name: form.exam_name,
                  exam_date: form.exam_date,
                  total_score: form.total_score,
                  school_judgment: form.school_judgment,
                  subject_scores,
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
                <h3 className="mb-3 font-bold text-black"><Ft>科目別の点数</Ft></h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {examSubjects.map((sub) => (
                    <div key={sub}>
                      <Label>
                        <FuriganaSubject subject={sub} grade={user.grade} />
                      </Label>
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
                <h3 className="mb-3 font-bold text-black"><Ft>合計・判定</Ft></h3>
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

              <button type="submit" className="btn-primary w-full"><Ft>登録する</Ft></button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3"><Ft>過去の模試結果</Ft></h2>
          {exams.length === 0 && <EmptyState />}
          {exams.map((ex) => (
            <div key={ex.exam_result_id} className="mb-3 rounded-xl bg-[var(--surface)] p-3">
              <p className="font-bold text-black">{displayValue(ex.exam_name)}</p>
              <p className="text-sm text-black">
                <FormatDateJa iso={ex.exam_date} />
              </p>
              <p className="text-sm text-black">
                <Ft>合計</Ft>: {displayValue(ex.total_score)}<Ft>点</Ft> / <Ft>判定</Ft>: {displayValue(ex.school_judgment)}
              </p>
              <p className="text-sm text-black">
                <Ft>科目別</Ft>:{" "}
                {Object.keys(ex.subject_scores || {}).length ? (
                  Object.entries(ex.subject_scores).map(([sub, score], i) => (
                    <span key={sub}>
                      {i > 0 && " / "}
                      <FuriganaSubject subject={sub} grade={user.grade} />
                      {score}
                      <Ft>点</Ft>
                    </span>
                  ))
                ) : (
                  <Ft>情報なし</Ft>
                )}
              </p>
            </div>
          ))}
        </section>
      </div>
    </StudentShell>
  );
}
