"use client";

import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { AnalyticsBarChart, AnalyticsLineChart } from "@/components/admin/AnalyticsCharts";
import { dailyStudyMinutes, seatUsage } from "@/lib/adminAnalytics";
import { useAdminProfiles } from "@/lib/useAdminProfiles";
import { useRequireAdmin } from "@/lib/useRequireAdmin";

export default function AdminAttendanceAnalyticsPage() {
  const { ready } = useRequireAdmin();
  const { students, profiles, loading, error } = useAdminProfiles();

  if (!ready || loading) {
    return (
      <AdminShell title="出席・座席分析">
        <div className="p-8 font-bold text-black">読み込み中...</div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="出席・座席分析">
        <div className="p-8 font-bold text-black">{error}</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="出席・座席分析">
      <div className="app-shell w-full space-y-6 px-4 py-6 pb-12">
        {profiles.map((p) => (
          <section key={p.student.student_id} className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-black">{p.student.name}</h2>
              <Link href={`/admin/analytics/students/${p.student.student_id}`} className="btn-secondary text-sm">
                統合分析
              </Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <AnalyticsLineChart
                title="日別滞在時間（分）"
                points={dailyStudyMinutes(p).map((d) => ({ date: d.date, value: d.count }))}
                valueSuffix="分"
              />
              <AnalyticsBarChart title="座席別来室回数" items={seatUsage(p)} valueSuffix="回" />
            </div>
          </section>
        ))}
        {students.length === 0 && <p className="font-medium text-black">生徒が登録されていません。</p>}
      </div>
    </AdminShell>
  );
}
