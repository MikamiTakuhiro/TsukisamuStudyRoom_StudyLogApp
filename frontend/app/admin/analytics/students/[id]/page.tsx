"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import StudentAnalyticsDashboard from "@/components/admin/StudentAnalyticsDashboard";
import StudentAnalyticsTabs from "@/components/admin/StudentAnalyticsTabs";
import { clearAnalyticsScrollPosition, restoreAnalyticsScrollPosition } from "@/lib/analyticsScroll";
import { adminApi, type StudentFullProfile, type User } from "@/lib/api";
import { useRequireAdmin } from "@/lib/useRequireAdmin";
import { gradeLabel } from "@/lib/grades";

export default function AdminStudentAnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const { ready } = useRequireAdmin();
  const [students, setStudents] = useState<User[]>([]);
  const [profile, setProfile] = useState<StudentFullProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!ready) return;
    adminApi
      .students()
      .then(setStudents)
      .catch(console.error);
  }, [ready]);

  useEffect(() => {
    if (!ready || !studentId) return;

    let cancelled = false;
    setProfileLoading(true);

    adminApi
      .studentFull(studentId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(console.error)
      .finally(() => {
        if (cancelled) return;
        setProfileLoading(false);
        setInitialized(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, studentId]);

  useLayoutEffect(() => {
    if (profileLoading || !profile) return;
    if (profile.student.student_id !== studentId) return;
    restoreAnalyticsScrollPosition();
  }, [profileLoading, profile, studentId]);

  useEffect(() => {
    return () => {
      clearAnalyticsScrollPosition();
    };
  }, []);

  if (!ready || (!initialized && profileLoading)) {
    return (
      <AdminShell title="生徒分析">
        <div className="p-8 font-bold text-black">読み込み中...</div>
      </AdminShell>
    );
  }

  if (!profile) {
    return (
      <AdminShell title="生徒分析">
        <div className="p-8 font-bold text-black">生徒が見つかりません。</div>
      </AdminShell>
    );
  }

  const activeStudent = students.find((student) => student.student_id === studentId) ?? profile.student;

  return (
    <AdminShell title={`${activeStudent.name} の分析`}>
      <div className="app-shell w-full px-4 py-6 pb-12">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href="/admin/analytics/students" className="font-bold text-[var(--navy)] underline">
            ← 生徒一覧
          </Link>
          <span className="text-sm text-black">{gradeLabel(activeStudent.grade)}</span>
        </div>

        {students.length > 0 && <StudentAnalyticsTabs students={students} currentId={studentId} />}

        <div className="student-sheet-panel relative">
          {profileLoading && (
            <div
              className="pointer-events-none absolute inset-0 z-10 bg-white/50"
              aria-hidden="true"
            />
          )}
          <StudentAnalyticsDashboard profile={profile} />
        </div>
      </div>
    </AdminShell>
  );
}
