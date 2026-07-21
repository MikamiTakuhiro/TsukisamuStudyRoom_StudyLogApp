"use client";

import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { AnalyticsLineChart } from "@/components/admin/AnalyticsCharts";
import { examScoreTrend } from "@/lib/adminAnalytics";
import { useAdminProfiles } from "@/lib/useAdminProfiles";
import { useRequireAdmin } from "@/lib/useRequireAdmin";

export default function AdminExamsAnalyticsPage() {
  const { ready } = useRequireAdmin();
  const { students, profiles, loading, error } = useAdminProfiles();

  if (!ready || loading) {
    return (
      <AdminShell title="模試結果分析">
        <div className="p-8 font-bold text-black">読み込み中...</div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="模試結果分析">
        <div className="p-8 font-bold text-black">{error}</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="模試結果分析">
      <div className="app-shell w-full space-y-6 px-4 py-6 pb-12">
        {profiles.map((p) => (
          <section key={p.student.student_id} className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-black">{p.student.name}</h2>
              <Link href={`/admin/analytics/students/${p.student.student_id}`} className="btn-secondary text-sm">
                統合分析
              </Link>
            </div>
            <AnalyticsLineChart
              title="模試総合点の推移"
              points={examScoreTrend(p).map((e) => ({ date: e.date, value: e.count }))}
              valueSuffix="点"
              emptyMessage="模試データがありません"
            />
            {p.exam_results.length > 0 && (
              <ul className="space-y-2 text-sm text-black">
                {[...p.exam_results]
                  .sort((a, b) => b.exam_date.localeCompare(a.exam_date))
                  .map((e) => (
                    <li key={e.exam_result_id} className="rounded-xl bg-[var(--surface)] p-3">
                      {e.exam_name} — {e.total_score}点（{e.exam_date}）
                      {e.school_judgment ? ` / 判定: ${e.school_judgment}` : ""}
                    </li>
                  ))}
              </ul>
            )}
          </section>
        ))}
        {students.length === 0 && <p className="font-medium text-black">生徒が登録されていません。</p>}
      </div>
    </AdminShell>
  );
}
