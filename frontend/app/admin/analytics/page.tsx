"use client";

import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { AnalyticsBarChart, AnalyticsKpi, AnalyticsLineChart } from "@/components/admin/AnalyticsCharts";
import { aggregateDailyStudy, aggregateSeatUsage, studyEfficiencyIndex } from "@/lib/adminAnalytics";
import { useAdminProfiles } from "@/lib/useAdminProfiles";
import { useRequireAdmin } from "@/lib/useRequireAdmin";
import { gradeLabel } from "@/lib/grades";

export default function AdminAnalyticsPage() {
  const { ready } = useRequireAdmin();
  const { students, profiles, loading, error } = useAdminProfiles();

  if (!ready || loading) {
    return (
      <AdminShell title="分析ダッシュボード">
        <div className="p-8 font-bold text-black">読み込み中...</div>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="分析ダッシュボード">
        <div className="p-8 font-bold text-black">{error}</div>
      </AdminShell>
    );
  }

  const totalRecords = profiles.reduce((s, p) => s + p.study_records.length, 0);
  const totalVisits = profiles.reduce((s, p) => s + p.attendances.length, 0);
  const avgEfficiency =
    profiles.length > 0
      ? Math.round((profiles.reduce((s, p) => s + studyEfficiencyIndex(p), 0) / profiles.length) * 10) / 10
      : 0;

  return (
    <AdminShell title="分析ダッシュボード">
      <div className="app-shell w-full space-y-6 px-4 py-6 pb-12">
        <p className="text-sm font-medium text-black">
          全生徒のデータを統合した概要です。詳細は「生徒別分析」から各生徒の統合グラフを確認できます。
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AnalyticsKpi label="登録生徒数" value={`${students.length}名`} />
          <AnalyticsKpi label="累計学習記録" value={`${totalRecords}件`} />
          <AnalyticsKpi label="累計来室" value={`${totalVisits}回`} />
          <AnalyticsKpi label="平均学習効率" value={`${avgEfficiency}件/時`} sub="塾滞在あたり" />
        </div>

        <AnalyticsLineChart
          title="全体：日別学習記録数（直近30日）"
          points={aggregateDailyStudy(profiles).map((d) => ({ date: d.date, value: d.count }))}
          valueSuffix="件"
        />

        <AnalyticsBarChart title="全体：座席別来室回数" items={aggregateSeatUsage(profiles)} valueSuffix="回" />

        <section className="card">
          <h2 className="section-title mb-3">生徒別分析へ</h2>
          <ul className="divide-y-2 divide-[var(--border)]">
            {students.map((s) => (
              <li key={s.student_id} className="flex items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-bold text-black">{s.name}</p>
                  <p className="text-sm text-black">{gradeLabel(s.grade)}</p>
                </div>
                <Link href={`/admin/analytics/students/${s.student_id}`} className="btn-primary text-sm">
                  グラフを見る
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
