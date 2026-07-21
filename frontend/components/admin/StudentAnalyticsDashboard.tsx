"use client";

import Link from "next/link";
import AspirationChart from "@/components/AspirationChart";
import {
  AnalyticsBarChart,
  AnalyticsInsight,
  AnalyticsKpi,
  AnalyticsLineChart,
} from "@/components/admin/AnalyticsCharts";
import {
  aspirationInsight,
  dailyStudyMinutes,
  dailyStudyRecordCounts,
  examScoreTrend,
  formatMinutes,
  locationStudyCounts,
  monthlyAverageMinutes,
  monthlyVisitCounts,
  seatStudyMinutes,
  seatUsage,
  studyEfficiencyIndex,
  studyPlanCompletionRate,
  subjectStudyCounts,
  topSeatInsight,
  weeklyAverageMinutes,
} from "@/lib/adminAnalytics";
import type { StudentFullProfile } from "@/lib/api";
import { dedupeLatestPerDate } from "@/lib/aspirations";
import { formatDateJa, formatTimeJa } from "@/lib/utils";

export default function StudentAnalyticsDashboard({ profile }: { profile: StudentFullProfile }) {
  const studyDaily = dailyStudyRecordCounts(profile);
  const minutesDaily = dailyStudyMinutes(profile);
  const exams = examScoreTrend(profile);
  const aspirations = dedupeLatestPerDate(profile.aspirations);
  const completion = studyPlanCompletionRate(profile);
  const efficiency = studyEfficiencyIndex(profile);
  const weekAvg = weeklyAverageMinutes(profile);
  const monthAvg = monthlyAverageMinutes(profile);
  const monthVisits = monthlyVisitCounts(profile);
  const sortedAttendances = [...profile.attendances].sort(
    (a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsKpi label="学習記録数" value={`${profile.study_records.length}件`} sub="累計" />
        <AnalyticsKpi label="来室回数" value={`${profile.attendances.length}回`} sub="累計" />
        <AnalyticsKpi label="週平均滞在" value={formatMinutes(weekAvg)} sub="退室済みのみ" />
        <AnalyticsKpi label="月平均滞在" value={formatMinutes(monthAvg)} sub="退室済みのみ" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsKpi label="計画完了率" value={`${completion}%`} />
        <AnalyticsKpi label="塾学習効率" value={`${efficiency}件/時`} sub="記録数÷滞在時間" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsLineChart
          title="日別学習記録数"
          points={studyDaily.map((d) => ({ date: d.date, value: d.count }))}
          valueSuffix="件"
        />
        <AnalyticsLineChart
          title="日別塾滞在時間"
          points={minutesDaily.map((d) => ({ date: d.date, value: d.count }))}
          yLabel="分"
          valueSuffix="分"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsBarChart
          title="月別来室回数"
          items={monthVisits.map((m) => ({
            label: m.date.slice(0, 7),
            value: m.count,
          }))}
          valueSuffix="回"
        />
        <AnalyticsBarChart title="座席別来室回数" items={seatUsage(profile)} valueSuffix="回" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsBarChart title="座席別滞在時間（分）" items={seatStudyMinutes(profile)} valueSuffix="分" />
        <AnalyticsBarChart title="科目別学習記録" items={subjectStudyCounts(profile)} valueSuffix="件" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsBarChart title="塾 / 自宅の学習比率" items={locationStudyCounts(profile)} valueSuffix="件" />
      </div>

      {exams.length > 0 && (
        <AnalyticsLineChart
          title="模試総合点の推移"
          points={exams.map((e) => ({ date: e.date, value: e.count }))}
          valueSuffix="点"
        />
      )}

      {aspirations.length > 0 && (
        <section className="card">
          <h3 className="analytics-chart-title mb-3">志望校の推移</h3>
          <AspirationChart items={aspirations} />
        </section>
      )}

      <section className="card">
        <h3 className="analytics-chart-title mb-3">来塾履歴（個別）</h3>
        {sortedAttendances.length === 0 ? (
          <p className="text-sm font-medium text-black">来塾記録がありません。</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--navy)]">
                  <th className="py-2 pr-2 font-bold">日付</th>
                  <th className="py-2 pr-2 font-bold">時間</th>
                  <th className="py-2 pr-2 font-bold">座席</th>
                  <th className="py-2 font-bold">滞在</th>
                </tr>
              </thead>
              <tbody>
                {sortedAttendances.map((a) => {
                  const mins =
                    a.check_out_time
                      ? Math.max(
                          0,
                          Math.round(
                            (new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 60000,
                          ),
                        )
                      : null;
                  return (
                    <tr key={a.attendance_id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-2 font-medium text-black">{formatDateJa(a.check_in_time)}</td>
                      <td className="py-2 pr-2 font-medium text-black">
                        {formatTimeJa(a.check_in_time)}〜
                        {a.check_out_time ? formatTimeJa(a.check_out_time) : "入室中"}
                      </td>
                      <td className="py-2 pr-2 font-medium text-black">{a.seat_name ?? "—"}</td>
                      <td className="py-2 font-medium text-black">
                        {mins !== null ? formatMinutes(mins) : "—"}
                        {a.is_forgotten_checkout && (
                          <span className="ml-1 text-xs text-orange-600">自動</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsInsight title="座席と学習効率" body={topSeatInsight(profile)} />
        <AnalyticsInsight title="志望校" body={aspirationInsight(profile)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/students/${profile.student.student_id}`} className="btn-secondary text-sm">
          詳細データを編集
        </Link>
      </div>
    </div>
  );
}
