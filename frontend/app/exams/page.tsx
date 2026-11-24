"use client";

import { useEffect, useMemo, useState } from "react";
import StudentShell from "@/components/StudentShell";
import ExamScoreChart from "@/components/ExamScoreChart";
import { EmptyState, Field, Input, PageLoading, Select, SkeletonList, SubmitButton } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { Ft, FuriganaSubject, FormatDateJa } from "@/components/FuriganaText";
import { academicApi, type ExamResult } from "@/lib/api";
import { getExamSubjects, storageSubject } from "@/lib/subjects";
import { useAuth } from "@/lib/useAuth";
import { displayValue } from "@/lib/utils";

const JUDGMENTS = ["A", "B", "C", "D", "E"] as const;

type ExamForm = {
  exam_name: string;
  exam_date: string;
  /** 空欄（未受験・未入力）を区別するため文字列で保持 */
  subject_scores: Record<string, string>;
  total_score: string;
  /** 合計を手で書き換えたら自動計算を止める */
  totalEdited: boolean;
  school_judgment: string;
};

const emptyForm = (): ExamForm => ({
  exam_name: "",
  exam_date: "",
  subject_scores: {},
  total_score: "",
  totalEdited: false,
  school_judgment: "",
});

function toScore(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function JudgmentBadge({ judgment }: { judgment: string | null }) {
  if (!judgment) return <span className="text-sm text-black"><Ft>判定なし</Ft></span>;
  const key = judgment.trim().toUpperCase();
  const known = (JUDGMENTS as readonly string[]).includes(key);
  return (
    <span className={`badge-judgment ${known ? `badge-judgment--${key}` : ""}`} aria-label={`判定 ${judgment}`}>
      {judgment}
    </span>
  );
}

export default function ExamsPage() {
  const { toast } = useFeedback();
  const { user, loading } = useAuth();
  const [exams, setExams] = useState<ExamResult[] | null>(null);
  const [form, setForm] = useState<ExamForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const isReadOnly = user?.is_read_only ?? false;
  const examSubjects = useMemo(() => (user ? getExamSubjects(user.grade) : []), [user]);

  const autoTotal = useMemo(() => {
    const scores = Object.values(form.subject_scores).map(toScore).filter((n): n is number => n !== null);
    return scores.length ? scores.reduce((a, b) => a + b, 0) : null;
  }, [form.subject_scores]);

  const totalValue = form.totalEdited ? form.total_score : autoTotal === null ? "" : String(autoTotal);
  const sortedExams = useMemo(
    () => [...(exams ?? [])].sort((a, b) => b.exam_date.localeCompare(a.exam_date)),
    [exams],
  );

  async function reload() {
    setExams(await academicApi.exams());
  }

  useEffect(() => {
    if (!user) return;
    reload().catch((e) => {
      setExams([]);
      toast(errorMessage(e, "模試結果の読み込みに失敗しました"), "error");
    });
  }, [user, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !user) return;
    const subject_scores: Record<string, number> = {};
    for (const [sub, raw] of Object.entries(form.subject_scores)) {
      const score = toScore(raw);
      if (score !== null) subject_scores[storageSubject(sub, user.grade)] = score;
    }
    const total = toScore(totalValue);
    setSubmitting(true);
    try {
      await academicApi.createExam({
        exam_name: form.exam_name.trim(),
        exam_date: form.exam_date,
        total_score: total ?? 0,
        school_judgment: form.school_judgment || null,
        subject_scores,
      });
      setForm(emptyForm());
      toast("模試結果を登録しました");
      await reload();
    } catch (err) {
      toast(errorMessage(err, "模試結果の登録に失敗しました"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <PageLoading />;
  }

  return (
    <StudentShell title="模試結果" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <h2 className="section-title mb-3"><Ft>模試結果の推移</Ft></h2>
          {exams === null ? (
            <div className="skeleton h-48 rounded-xl" role="status" aria-label="読み込み中" />
          ) : exams.length === 0 ? (
            <EmptyState message="まだ模試結果がありません" />
          ) : (
            <ExamScoreChart exams={exams} />
          )}
        </section>

        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3"><Ft>模試結果を入力</Ft></h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="模試名" required hint="例: 第1回 北海道学力テスト">
                  <Input
                    value={form.exam_name}
                    onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
                    maxLength={100}
                    enterKeyHint="next"
                    required
                  />
                </Field>
                <Field label="受験日" required>
                  <Input
                    type="date"
                    value={form.exam_date}
                    onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                    required
                  />
                </Field>
              </div>

              <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="font-bold text-black"><Ft>科目別の点数</Ft></h3>
                <p className="mb-3 text-xs font-medium text-[var(--placeholder)]">
                  <Ft>受けていない科目は空欄のままにしてください</Ft>
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {examSubjects.map((sub) => (
                    <Field key={sub} label={<FuriganaSubject subject={sub} grade={user.grade} />}>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        value={form.subject_scores[sub] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            subject_scores: { ...form.subject_scores, [sub]: e.target.value.replace(/[^0-9]/g, "") },
                          })
                        }
                        placeholder="点"
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[var(--navy)] bg-[var(--moon-yellow)]/20 p-4">
                <h3 className="mb-3 font-bold text-black"><Ft>合計・判定</Ft></h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Field
                      label="合計点数"
                      hint={form.totalEdited ? "手入力した値を使います" : "科目別の点数から自動で計算しています"}
                    >
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={totalValue}
                        onChange={(e) =>
                          setForm({ ...form, total_score: e.target.value.replace(/[^0-9]/g, ""), totalEdited: true })
                        }
                        placeholder="点"
                      />
                    </Field>
                    {form.totalEdited && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, total_score: "", totalEdited: false })}
                        className="btn-tap-sm -ml-3 text-[var(--navy)] underline"
                      >
                        <Ft>自動計算に戻す</Ft>
                      </button>
                    )}
                  </div>
                  <Field label="志望校判定">
                    <Select
                      value={form.school_judgment}
                      onChange={(e) => setForm({ ...form, school_judgment: e.target.value })}
                    >
                      <option value="">判定なし</option>
                      {JUDGMENTS.map((j) => (
                        <option key={j} value={j}>{j}判定</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>

              <SubmitButton
                busy={submitting}
                busyLabel="登録中..."
                disabled={!form.exam_name.trim() || !form.exam_date}
              >
                登録する
              </SubmitButton>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3"><Ft>過去の模試結果</Ft></h2>
          {exams === null ? (
            <SkeletonList rows={2} />
          ) : sortedExams.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3">
              {sortedExams.map((ex) => (
                <li key={ex.exam_result_id} className="rounded-xl bg-[var(--surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-black">{displayValue(ex.exam_name)}</p>
                      <p className="text-sm text-black">
                        <FormatDateJa iso={ex.exam_date} />
                      </p>
                    </div>
                    <JudgmentBadge judgment={ex.school_judgment} />
                  </div>
                  <p className="mt-2 text-black">
                    <span className="text-sm font-bold text-[var(--navy)]"><Ft>合計</Ft></span>{" "}
                    <span className="text-2xl font-bold">{displayValue(ex.total_score)}</span>
                    <Ft>点</Ft>
                  </p>
                  {Object.keys(ex.subject_scores || {}).length > 0 ? (
                    <dl className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-5">
                      {Object.entries(ex.subject_scores).map(([sub, score]) => (
                        <div key={sub} className="rounded-lg bg-white px-2 py-1 text-center">
                          <dt className="text-xs font-bold text-[var(--navy)]">
                            <FuriganaSubject subject={sub} grade={user.grade} />
                          </dt>
                          <dd className="text-base font-bold text-black">{score}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-1 text-sm text-black"><Ft>科目別: 情報なし</Ft></p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
