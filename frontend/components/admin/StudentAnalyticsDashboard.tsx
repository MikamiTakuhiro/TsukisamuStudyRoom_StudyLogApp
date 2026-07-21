"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AspirationChart from "@/components/AspirationChart";
import StudyCalendar from "@/components/StudyCalendar";
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
import type { CalendarTargetPlan, StudentFullProfile } from "@/lib/api";
import { dedupeLatestPerDate } from "@/lib/aspirations";
import { buildCalendarWeeksFromProfile } from "@/lib/studentCalendar";
import { buildStudentHistoryRows, buildVisitNumberMap, downloadStudentHistoryCsv, attendanceDurationMinutes } from "@/lib/studentHistoryExport";
import { formatDateJa, formatTimeJa } from "@/lib/utils";

export default function StudentAnalyticsDashboard({ profile }: { profile: StudentFullProfile }) {
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    lines: string[];
    targetPlans: CalendarTargetPlan[];
  } | null>(null);
  const calendarWeeks = useMemo(() => buildCalendarWeeksFromProfile(profile), [profile]);
  const studyDaily = dailyStudyRecordCounts(profile);
  const minutesDaily = dailyStudyMinutes(profile);
  const exams = examScoreTrend(profile);
  const aspirations = dedupeLatestPerDate(profile.aspirations);
  const completion = studyPlanCompletionRate(profile);
  const efficiency = studyEfficiencyIndex(profile);
  const weekAvg = weeklyAverageMinutes(profile);
  const monthAvg = monthlyAverageMinutes(profile);
  const monthVisits = monthlyVisitCounts(profile);
  const visitNumberById = buildVisitNumberMap(profile);
  const historyRows = buildStudentHistoryRows(profile);

  return (
    <div className="space-y-4">
      <div id="analytics-kpi" data-analytics-anchor className="space-y-3">
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
      </div>

      <div id="analytics-calendar" data-analytics-anchor>
        <StudyCalendar
          weeks={calendarWeeks}
          onDayClick={(week, dayIndex) => {
            const day = week.days[dayIndex];
            setSelectedDay({
              date: day.date,
              lines: day.summary_lines,
              targetPlans: day.target_plans ?? [],
            });
          }}
        />
      </div>

      <div id="analytics-charts" data-analytics-anchor className="space-y-4">
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
      </div>

      <section id="analytics-history" data-analytics-anchor className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="analytics-chart-title">来塾・学習履歴</h3>
          {historyRows.length > 0 && (
            <button
              type="button"
              onClick={() => downloadStudentHistoryCsv(profile)}
              className="btn-secondary text-sm"
            >
              CSVダウンロード
            </button>
          )}
        </div>
        {historyRows.length === 0 ? (
          <p className="text-sm font-medium text-black">来塾・塾内学習の記録がありません。</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--navy)]">
                  <th className="w-10 py-2 pr-2 text-center font-bold">回</th>
                  <th className="py-2 pr-2 font-bold">日付</th>
                  <th className="py-2 pr-2 font-bold">時間</th>
                  <th className="py-2 pr-2 font-bold">種別</th>
                  <th className="py-2 pr-2 font-bold">内容</th>
                  <th className="py-2 font-bold">詳細</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => {
                  if (row.kind === "attendance") {
                    const a = row.attendance;
                    const mins = attendanceDurationMinutes(a.check_in_time, a.check_out_time);
                    return (
                      <tr key={`att-${a.attendance_id}`} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2 pr-2 text-center font-bold text-[var(--navy)]">
                          {visitNumberById.get(a.attendance_id)}
                        </td>
                        <td className="py-2 pr-2 font-medium text-black">{formatDateJa(a.check_in_time)}</td>
                        <td className="py-2 pr-2 font-medium text-black">
                          {formatTimeJa(a.check_in_time)}〜
                          {a.check_out_time ? formatTimeJa(a.check_out_time) : "入室中"}
                        </td>
                        <td className="py-2 pr-2 font-medium text-black">来塾</td>
                        <td className="py-2 pr-2 font-medium text-black">{a.seat_name ?? "—"}</td>
                        <td className="py-2 font-medium text-black">
                          {mins !== null ? formatMinutes(mins) : "—"}
                          {a.is_forgotten_checkout && (
                            <span className="ml-1 text-xs text-orange-600">自動</span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  const r = row.record;
                  return (
                    <tr key={`study-${r.record_id}`} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-2 text-center font-medium text-black">—</td>
                      <td className="py-2 pr-2 font-medium text-black">{formatDateJa(r.recorded_at)}</td>
                      <td className="py-2 pr-2 font-medium text-black">{formatTimeJa(r.recorded_at)}</td>
                      <td className="py-2 pr-2 font-medium text-black">学習</td>
                      <td className="py-2 pr-2 font-medium text-black">{r.subject}</td>
                      <td className="py-2 font-medium text-black">{r.topic_unit}</td>
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

      {selectedDay && (
        <div className="modal-overlay items-end sm:items-center sm:justify-center">
          <div className="modal-panel w-full rounded-t-3xl bg-white p-6 sm:rounded-3xl">
            <h3 className="text-lg font-bold text-black">{formatDateJa(selectedDay.date)}</h3>
            {selectedDay.lines.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-bold text-[var(--navy)]">来塾・学習記録</p>
                <ul className="mt-2 space-y-2">
                  {selectedDay.lines.map((line, index) => (
                    <li
                      key={index}
                      className="rounded-xl bg-[var(--surface)] p-3 text-sm font-medium text-black"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedDay.targetPlans.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-bold text-[var(--navy)]">完了目標</p>
                <ul className="mt-2 space-y-2">
                  {selectedDay.targetPlans.map((plan) => (
                    <li
                      key={plan.plan_id}
                      className="rounded-xl border-2 border-red-400/60 bg-red-50 p-3 text-sm font-medium text-black"
                    >
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
                      {plan.subject} — {plan.unit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedDay.lines.length === 0 && selectedDay.targetPlans.length === 0 && (
              <p className="mt-3 text-black">この日の記録はありません。</p>
            )}
            <button type="button" onClick={() => setSelectedDay(null)} className="btn-secondary mt-4 w-full">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
