"use client";

import { useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { EmptyState } from "@/components/ui/Input";
import { attendanceApi, type AttendanceSummary } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { formatDateJa, formatTimeJa } from "@/lib/utils";
import { formatMinutes } from "@/lib/adminAnalytics";

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "入室中";
  return formatMinutes(minutes);
}

export default function AttendancePage() {
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    attendanceApi
      .summary()
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"));
  }, [user]);

  if (loading || !user) {
    return <div className="p-8 font-bold text-black">読み込み中...</div>;
  }

  if (error) {
    return (
      <StudentShell title="来塾記録" user={user}>
        <div className="p-8 font-bold text-black">{error}</div>
      </StudentShell>
    );
  }

  if (!summary) {
    return (
      <StudentShell title="来塾記録" user={user}>
        <div className="p-8 font-bold text-black">読み込み中...</div>
      </StudentShell>
    );
  }

  return (
    <StudentShell title="来塾記録" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card text-center">
            <p className="text-xs font-bold text-[var(--navy)]">累計来塾回数</p>
            <p className="mt-1 text-2xl font-bold text-black">{summary.total_visits}回</p>
          </div>
          <div className="card text-center">
            <p className="text-xs font-bold text-[var(--navy)]">累計滞在時間</p>
            <p className="mt-1 text-2xl font-bold text-black">{formatMinutes(summary.total_minutes)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs font-bold text-[var(--navy)]">1回あたり平均</p>
            <p className="mt-1 text-2xl font-bold text-black">{formatMinutes(summary.average_minutes)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs font-bold text-[var(--navy)]">今月の来塾</p>
            <p className="mt-1 text-2xl font-bold text-black">{summary.this_month.visit_count}回</p>
            <p className="mt-0.5 text-xs font-medium text-black">
              {formatMinutes(summary.this_month.total_minutes)}（平均 {formatMinutes(summary.this_month.average_minutes)}）
            </p>
          </div>
        </section>

        {summary.monthly_stats.length > 0 && (
          <section className="card">
            <h2 className="section-title mb-3">月別サマリー</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--navy)]">
                    <th className="py-2 pr-3 font-bold">月</th>
                    <th className="py-2 pr-3 font-bold">来塾回数</th>
                    <th className="py-2 pr-3 font-bold">合計時間</th>
                    <th className="py-2 font-bold">平均時間</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.monthly_stats.map((m) => (
                    <tr key={`${m.year}-${m.month}`} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-black">
                        {m.year}年{m.month}月
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-black">{m.visit_count}回</td>
                      <td className="py-2.5 pr-3 font-medium text-black">{formatMinutes(m.total_minutes)}</td>
                      <td className="py-2.5 font-medium text-black">{formatMinutes(m.average_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3">来塾履歴</h2>
          {summary.recent_visits.length === 0 ? (
            <EmptyState message="来塾記録がまだありません" />
          ) : (
            <ul className="space-y-2">
              {summary.recent_visits.map((v) => (
                <li
                  key={v.attendance_id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-black">{formatDateJa(v.date)}</p>
                      <p className="mt-1 text-sm font-medium text-black">
                        {formatTimeJa(v.check_in_time)} 〜{" "}
                        {v.check_out_time ? formatTimeJa(v.check_out_time) : "入室中"}
                        {v.seat_name && <span className="ml-2 text-[var(--navy)]">({v.seat_name})</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--navy)]">{formatDuration(v.duration_minutes)}</p>
                      {v.is_forgotten_checkout && (
                        <p className="text-xs font-bold text-orange-600">退室忘れ自動処理</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
