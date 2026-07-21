"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { Input } from "@/components/ui/Input";
import { useAdminProfiles } from "@/lib/useAdminProfiles";
import { useRequireAdmin } from "@/lib/useRequireAdmin";
import { gradeLabel } from "@/lib/grades";
import { studyEfficiencyIndex, studyPlanCompletionRate } from "@/lib/adminAnalytics";
import { filterStudentsBySearch } from "@/lib/studentSearch";

export default function AdminStudentsAnalyticsPage() {
  const { ready } = useRequireAdmin();
  const { students, profiles, loading, error } = useAdminProfiles();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = useMemo(
    () => filterStudentsBySearch(students, searchQuery),
    [students, searchQuery],
  );

  if (!ready || loading) {
    return (
      <AdminShell title="生徒別分析">
        <div className="p-8 font-bold text-black">読み込み中...</div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="生徒別分析">
        <div className="p-8 font-bold text-black">{error}</div>
      </AdminShell>
    );
  }

  const profileMap = new Map(profiles.map((p) => [p.student.student_id, p]));

  return (
    <AdminShell title="生徒別分析">
      <div className="app-shell w-full space-y-4 px-4 py-6 pb-12">
        <div className="card space-y-3">
          <label htmlFor="student-search" className="block text-sm font-bold text-black">
            生徒を検索
          </label>
          <Input
            id="student-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="名前・IDで検索（ひらがな入力中も絞り込み）"
            autoComplete="off"
          />
          {searchQuery && (
            <p className="text-xs font-medium text-[var(--navy)]">
              {filteredStudents.length}名が該当（全{students.length}名）
            </p>
          )}
        </div>

        <p className="text-sm font-medium text-black">
          生徒を選ぶと、学習量・志望校・座席・模試を統合したグラフが表示されます。
        </p>

        {filteredStudents.map((s) => {
          const p = profileMap.get(s.student_id);
          return (
            <div key={s.student_id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-black">{s.name}</p>
                <p className="text-sm text-black">
                  ID: {s.user_id} / {gradeLabel(s.grade)} / 記録 {p?.study_records.length ?? 0}件 / 来室{" "}
                  {p?.attendances.length ?? 0}回
                </p>
                {p && (
                  <p className="mt-1 text-xs font-medium text-[var(--navy)]">
                    計画完了 {studyPlanCompletionRate(p)}% · 効率 {studyEfficiencyIndex(p)}件/時
                  </p>
                )}
              </div>
              <Link href={`/admin/analytics/students/${s.student_id}`} className="btn-primary text-sm">
                統合グラフを見る
              </Link>
            </div>
          );
        })}

        {students.length === 0 && <p className="font-medium text-black">生徒が登録されていません。</p>}
        {students.length > 0 && filteredStudents.length === 0 && (
          <p className="font-medium text-black">該当する生徒が見つかりません。</p>
        )}
      </div>
    </AdminShell>
  );
}
