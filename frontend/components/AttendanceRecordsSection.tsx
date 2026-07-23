"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/Input";
import { Ft, FormatDateJa } from "@/components/FuriganaText";
import { attendanceApi, type AttendanceSummary } from "@/lib/api";
import { formatMinutes } from "@/lib/adminAnalytics";
import { formatTimeJa } from "@/lib/utils";

export default function AttendanceRecordsSection() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    attendanceApi
      .summary()
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"));
  }, []);

  if (error) {
    return <p className="font-bold text-black">{error}</p>;
  }

  if (!summary) {
    return (
      <p className="font-bold text-black">
        <Ft>読み込み中...</Ft>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-xs font-bold text-[var(--navy)]"><Ft>累計来塾回数</Ft></p>
          <p className="mt-1 text-2xl font-bold text-black">
            {summary.total_visits}<Ft>回</Ft>
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-xs font-bold text-[var(--navy)]"><Ft>累計滞在時間</Ft></p>
          <p className="mt-1 text-2xl font-bold text-black">{formatMinutes(summary.total_minutes)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-xs font-bold text-[var(--navy)]"><Ft>1回あたり平均</Ft></p>
          <p className="mt-1 text-2xl font-bold text-black">{formatMinutes(summary.average_minutes)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-xs font-bold text-[var(--navy)]"><Ft>今月の来塾</Ft></p>
          <p className="mt-1 text-2xl font-bold text-black">
            {summary.this_month.visit_count}<Ft>回</Ft>
          </p>
          <p className="mt-0.5 text-xs font-medium text-black">
            {formatMinutes(summary.this_month.total_minutes)}（<Ft>平均</Ft> {formatMinutes(summary.this_month.average_minutes)}）
          </p>
        </div>
      </section>

      {summary.monthly_stats.length > 0 && (
        <section>
          <h3 className="mb-3 text-base font-bold text-[var(--navy)]"><Ft>月別サマリー</Ft></h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--navy)]">
                  <th className="py-2 pr-3 font-bold"><Ft>月</Ft></th>
                  <th className="py-2 pr-3 font-bold"><Ft>来塾回数</Ft></th>
                  <th className="py-2 pr-3 font-bold"><Ft>合計時間</Ft></th>
                  <th className="py-2 font-bold"><Ft>平均時間</Ft></th>
                </tr>
              </thead>
              <tbody>
                {summary.monthly_stats.map((m) => (
                  <tr key={`${m.year}-${m.month}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-black">
                      {m.year}<Ft>年</Ft>{m.month}<Ft>月</Ft>
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-black">
                      {m.visit_count}<Ft>回</Ft>
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-black">{formatMinutes(m.total_minutes)}</td>
                    <td className="py-2.5 font-medium text-black">{formatMinutes(m.average_minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-base font-bold text-[var(--navy)]"><Ft>来塾履歴</Ft></h3>
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
                    <p className="font-bold text-black">
                      <FormatDateJa iso={v.date} />
                    </p>
                    <p className="mt-1 text-sm font-medium text-black">
                      {formatTimeJa(v.check_in_time)} 〜{" "}
                      {v.check_out_time ? formatTimeJa(v.check_out_time) : <Ft>入室中</Ft>}
                      {v.seat_name && <span className="ml-2 text-[var(--navy)]">({v.seat_name})</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[var(--navy)]">
                      {v.duration_minutes === null ? <Ft>入室中</Ft> : formatMinutes(v.duration_minutes)}
                    </p>
                    {v.is_forgotten_checkout && (
                      <p className="text-xs font-bold text-orange-600"><Ft>退室忘れ自動処理</Ft></p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
