"use client";

import { useCallback, useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Ft } from "@/components/FuriganaText";
import { attendanceApi, type ActiveSeatStatus } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { formatTimeJa } from "@/lib/utils";

export default function LiveAttendancePage() {
  const { user, loading } = useAuth();
  const [live, setLive] = useState<ActiveSeatStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      setLive(await attendanceApi.live());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    reload().catch(console.error);
    const timer = setInterval(() => {
      reload().catch(console.error);
    }, 30000);
    return () => clearInterval(timer);
  }, [user, reload]);

  if (loading || !user) {
    return (
      <div className="p-8 font-bold text-black">
        <Ft>読み込み中...</Ft>
      </div>
    );
  }

  const occupied = live.filter((s) => s.student_name).length;

  return (
    <StudentShell title="リアルタイム出席" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="section-title"><Ft>現在の座席状況</Ft></h2>
              <p className="mt-1 text-sm font-medium text-black">
                <Ft>使用中</Ft> {occupied} / {live.length} <Ft>席</Ft>
              </p>
            </div>
            <button type="button" onClick={reload} disabled={refreshing} className="btn-secondary text-sm">
              {refreshing ? <Ft>更新中...</Ft> : <Ft>更新</Ft>}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {live.map((s) => (
              <div
                key={s.seat_id}
                className={`rounded-xl border-2 p-3 ${
                  s.student_name ? "border-[var(--navy)] bg-[var(--moon-yellow)]/40" : "border-[var(--border)] bg-white"
                }`}
              >
                <p className="font-bold text-black">{s.seat_name}</p>
                <p className="text-sm font-medium text-black">
                  {s.student_name ? (
                    <>
                      {s.student_name}
                      {s.check_in_time && (
                        <span className="ml-1 text-[var(--navy)]">（{formatTimeJa(s.check_in_time)}〜）</span>
                      )}
                    </>
                  ) : (
                    <Ft>空席</Ft>
                  )}
                </p>
              </div>
            ))}
          </div>
          {live.length === 0 && (
            <p className="font-medium text-black">
              <Ft>座席が登録されていません。</Ft>
            </p>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
