"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import StudentAnalyticsDashboard from "@/components/admin/StudentAnalyticsDashboard";
import { adminApi, type StudentFullProfile } from "@/lib/api";
import { useRequireAdmin } from "@/lib/useRequireAdmin";
import { gradeLabel } from "@/lib/grades";

export default function AdminStudentAnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const { ready } = useRequireAdmin();
  const [profile, setProfile] = useState<StudentFullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !studentId) return;
    adminApi
      .studentFull(studentId)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ready, studentId]);

  if (!ready || loading) {
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

  return (
    <AdminShell title={`${profile.student.name} の分析`}>
      <div className="app-shell w-full space-y-4 px-4 py-6 pb-12">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/analytics/students" className="font-bold text-[var(--navy)] underline">
            ← 生徒一覧
          </Link>
          <span className="text-sm text-black">{gradeLabel(profile.student.grade)}</span>
        </div>
        <StudentAnalyticsDashboard profile={profile} />
      </div>
    </AdminShell>
  );
}
