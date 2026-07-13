"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { Input, Label, Select, EmptyState } from "@/components/ui/Input";
import {
  academicApi,
  adminApi,
  attendanceApi,
  SUBJECTS,
  ACHIEVEMENT_LEVELS,
  type StudentFullProfile,
} from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { formatTimeJa, toDatetimeLocalJst, datetimeLocalJstToIso } from "@/lib/utils";

export default function AdminStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const studentId = Number(id);
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<StudentFullProfile | null>(null);
  const [saved, setSaved] = useState("");

  async function reload() {
    setProfile(await adminApi.studentFull(studentId));
  }

  useEffect(() => {
    if (user?.role === "admin") reload().catch(console.error);
  }, [user, studentId]);

  const [studentForm, setStudentForm] = useState({ name: "", grade: 1, gender: "" });
  const [profileForm, setProfileForm] = useState({ phone: "", email: "", birth_date: "", school_name: "" });

  useEffect(() => {
    if (profile) {
      setStudentForm({
        name: profile.student.name,
        grade: profile.student.grade,
        gender: profile.student.gender,
      });
      setProfileForm({
        phone: profile.student.phone ?? "",
        email: profile.student.email ?? "",
        birth_date: profile.student.birth_date ?? "",
        school_name: profile.student.school_name ?? "",
      });
    }
  }, [profile]);

  function profileDisplay(value: string | null | undefined) {
    if (!value) return "未記入";
    return value;
  }

  if (loading || !user) return <div className="p-8 font-bold text-black">読み込み中...</div>;
  if (user.role !== "admin") {
    router.replace("/dashboard");
    return null;
  }
  if (!profile) return <div className="p-8 font-bold text-black">読み込み中...</div>;

  return (
    <div className="min-h-full w-full max-w-full bg-[var(--surface)] pb-12">
      <AppHeader title={`${profile.student.name} の詳細`} role="admin" />
      <div className="app-shell w-full space-y-6 px-4 py-6">
        <Link href="/admin" className="font-bold text-[var(--navy)] underline">
          ← 管理画面に戻る
        </Link>
        {saved && <p className="rounded-xl bg-[var(--moon-yellow)] p-3 font-bold text-black">{saved}</p>}

        <section className="card">
          <h2 className="section-title mb-3">基本情報（編集可）</h2>
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await adminApi.updateStudent(studentId, studentForm);
              setSaved("基本情報を保存しました");
              reload();
            }}
          >
            <Input value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} />
            <Input
              type="number"
              min={1}
              max={12}
              value={studentForm.grade}
              onChange={(e) => setStudentForm({ ...studentForm, grade: Number(e.target.value) })}
            />
            <Input value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })} />
            <button type="submit" className="btn-primary">
              保存
            </button>
          </form>
          <p className="mt-2 text-sm font-medium text-black">ID: {profile.student.user_id}</p>
        </section>

        <section className="card">
          <h2 className="section-title mb-3">連絡先・プロフィール（編集可）</h2>
          <div className="mb-4 space-y-1 text-sm text-black">
            <p>電話番号: {profileDisplay(profile.student.phone)}</p>
            <p>メールアドレス: {profileDisplay(profile.student.email)}</p>
            <p>生年月日: {profileDisplay(profile.student.birth_date)}</p>
            <p>学校名: {profileDisplay(profile.student.school_name)}</p>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await adminApi.updateStudent(studentId, {
                phone: profileForm.phone || null,
                email: profileForm.email || null,
                birth_date: profileForm.birth_date || null,
                school_name: profileForm.school_name || null,
              });
              setSaved("連絡先・プロフィールを保存しました");
              reload();
            }}
          >
            <div>
              <Label>電話番号（任意）</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                inputMode="tel"
                placeholder="未記入"
              />
            </div>
            <div>
              <Label>メールアドレス（任意）</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                placeholder="未記入"
              />
            </div>
            <div>
              <Label>生年月日（任意）</Label>
              <Input
                type="date"
                value={profileForm.birth_date}
                onChange={(e) => setProfileForm({ ...profileForm, birth_date: e.target.value })}
              />
            </div>
            <div>
              <Label>学校名（任意）</Label>
              <Input
                value={profileForm.school_name}
                onChange={(e) => setProfileForm({ ...profileForm, school_name: e.target.value })}
                placeholder="未記入"
              />
            </div>
            <button type="submit" className="btn-primary sm:col-span-2">
              保存
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title mb-3">出席記録</h2>
          {profile.attendances.length === 0 && <EmptyState />}
          {profile.attendances.map((a) => (
            <div key={a.attendance_id} className="mb-3 rounded-xl bg-[var(--surface)] p-3">
              <p className="font-bold text-black">{a.seat_name ?? "情報なし"}</p>
              <p className="text-sm text-black">入室: {formatTimeJa(a.check_in_time)}</p>
              <p className="text-sm text-black">
                退室: {a.check_out_time ? formatTimeJa(a.check_out_time) : "情報なし"}
              </p>
              <form
                className="mt-2 grid gap-2 sm:grid-cols-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  await attendanceApi.updateAttendance(a.attendance_id, {
                    check_in_time: datetimeLocalJstToIso(String(fd.get("check_in") || "")) || undefined,
                    check_out_time: datetimeLocalJstToIso(String(fd.get("check_out") || "")) || undefined,
                  });
                  setSaved("出席を更新しました");
                  reload();
                }}
              >
                <Input type="datetime-local" name="check_in" defaultValue={toDatetimeLocalJst(a.check_in_time)} />
                <Input
                  type="datetime-local"
                  name="check_out"
                  defaultValue={a.check_out_time ? toDatetimeLocalJst(a.check_out_time) : ""}
                />
                <button type="submit" className="btn-secondary text-sm">
                  時間を修正
                </button>
              </form>
            </div>
          ))}
        </section>

        <section className="card">
          <h2 className="section-title mb-3">志望校</h2>
          {profile.aspirations.length === 0 && <EmptyState />}
          {profile.aspirations.map((a) => (
            <form
              key={a.aspiration_id}
              className="mb-2 grid gap-2 sm:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                await academicApi.updateAspiration(a.aspiration_id, {
                  target_school: String(fd.get("school")),
                  priority_rank: Number(fd.get("rank")),
                });
                setSaved("志望校を更新しました");
                reload();
              }}
            >
              <Input name="school" defaultValue={a.target_school} />
              <Input name="rank" type="number" defaultValue={a.priority_rank} />
              <button type="submit" className="btn-secondary text-sm">
                更新
              </button>
              <button
                type="button"
                className="btn-danger text-sm"
                onClick={async () => {
                  await academicApi.deleteAspiration(a.aspiration_id);
                  reload();
                }}
              >
                削除
              </button>
            </form>
          ))}
          <form
            className="mt-4 grid gap-2 sm:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await academicApi.createAspiration(
                { target_school: String(fd.get("school")), priority_rank: Number(fd.get("rank")) },
                studentId,
              );
              reload();
            }}
          >
            <Input name="school" placeholder="志望校名" required />
            <Input name="rank" type="number" defaultValue={1} />
            <button type="submit" className="btn-primary text-sm">
              志望校を追加
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title mb-3">学習計画・進捗</h2>
          {profile.study_plans.length === 0 && <EmptyState />}
          {profile.study_plans.map((p) => (
            <div key={p.plan_id} className="mb-3 rounded-xl bg-[var(--surface)] p-3">
              <form
                className="grid gap-2 sm:grid-cols-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  await academicApi.updateStudyPlan(p.plan_id, {
                    subject: String(fd.get("subject")),
                    unit: String(fd.get("unit")),
                    target_completion_date: String(fd.get("date")),
                  });
                  reload();
                }}
              >
                <Select name="subject" defaultValue={p.subject}>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Input name="unit" defaultValue={p.unit} />
                <Input name="date" type="date" defaultValue={p.target_completion_date} />
                <button type="submit" className="btn-secondary text-sm">
                  計画更新
                </button>
              </form>
              {p.progress.length === 0 ? (
                <p className="mt-2 text-sm text-black">進捗: 情報なし</p>
              ) : (
                p.progress.map((pr) => (
                  <form
                    key={pr.progress_id}
                    className="mt-2 grid gap-2 sm:grid-cols-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      await academicApi.updateProgress(pr.progress_id, {
                        achievement_level: String(fd.get("level")),
                        completion_date: String(fd.get("date")) || null,
                      });
                      reload();
                    }}
                  >
                    <Select name="level" defaultValue={pr.achievement_level ?? ""}>
                      {ACHIEVEMENT_LEVELS.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </Select>
                    <Input name="date" type="date" defaultValue={pr.completion_date ?? ""} />
                    <button type="submit" className="btn-secondary text-sm">
                      進捗更新
                    </button>
                  </form>
                ))
              )}
            </div>
          ))}
          <form
            className="mt-4 grid gap-2 sm:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await academicApi.createStudyPlan(
                {
                  subject: String(fd.get("subject")),
                  unit: String(fd.get("unit")),
                  target_completion_date: String(fd.get("date")),
                },
                studentId,
              );
              reload();
            }}
          >
            <Select name="subject">
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input name="unit" placeholder="単元" required />
            <Input name="date" type="date" required />
            <button type="submit" className="btn-primary text-sm">
              計画追加
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title mb-3">模試結果</h2>
          {profile.exam_results.length === 0 && <EmptyState />}
          {profile.exam_results.map((ex) => (
            <form
              key={ex.exam_result_id}
              className="mb-3 grid gap-2 sm:grid-cols-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                await academicApi.updateExam(ex.exam_result_id, {
                  exam_name: String(fd.get("name")),
                  exam_date: String(fd.get("date")),
                  total_score: Number(fd.get("score")),
                  school_judgment: String(fd.get("judgment")),
                });
                reload();
              }}
            >
              <Input name="name" defaultValue={ex.exam_name} />
              <Input name="date" type="date" defaultValue={ex.exam_date} />
              <Input name="score" type="number" defaultValue={ex.total_score} />
              <Input name="judgment" defaultValue={ex.school_judgment ?? ""} placeholder="判定" />
              <button type="submit" className="btn-secondary text-sm">
                更新
              </button>
            </form>
          ))}
          <form
            className="mt-4 grid gap-2 sm:grid-cols-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await academicApi.createExam(
                {
                  exam_name: String(fd.get("name")),
                  exam_date: String(fd.get("date")),
                  total_score: Number(fd.get("score")),
                  school_judgment: String(fd.get("judgment")),
                  subject_scores: {},
                },
                studentId,
              );
              reload();
            }}
          >
            <Input name="name" placeholder="模試名" required />
            <Input name="date" type="date" required />
            <Input name="score" type="number" defaultValue={0} />
            <Input name="judgment" placeholder="判定" />
            <button type="submit" className="btn-primary text-sm">
              模試追加
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title mb-3">学習記録</h2>
          {profile.study_records.length === 0 && <EmptyState />}
          {profile.study_records.map((r) => (
            <p key={r.record_id} className="mb-1 text-sm text-black">
              {r.subject} - {r.topic_unit} ({formatTimeJa(r.recorded_at)})
            </p>
          ))}
        </section>

        <section className="card">
          <h2 className="section-title mb-3">通知</h2>
          {profile.notifications.length === 0 && <EmptyState />}
          {profile.notifications.map((n) => (
            <p key={n.notification_id} className="mb-2 text-sm text-black">
              {n.content}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}
