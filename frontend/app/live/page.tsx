"use client";

import { useCallback, useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Ft } from "@/components/FuriganaText";
import { PageLoading, Spinner } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { attendanceApi, type ActiveSeatStatus } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { formatTimeJa } from "@/lib/utils";

const REFRESH_MS = 30000;

export default function LiveAttendancePage() {
  const { toast } = useFeedback();
  const { user, loading } = useAuth();
  const [live, setLive] = useState<ActiveSeatStatus[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      setLive(await attendanceApi.live());
      setUpdatedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    reload().catch((e) => {
      setLive((prev) => prev ?? []);
      toast(errorMessage(e, "座席状況の読み込みに失敗しました"), "error");
    });
    const timer = setInterval(() => {
      reload().catch(console.error);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [user, reload, toast]);

  if (loading || !user) {
    return <PageLoading />;
  }

  const seats = live ?? [];
  const occupied = seats.filter((s) => s.is_occupied).length;
  const mySeat = seats.find((s) => s.is_mine);

  return (
    <StudentShell title="リアルタイム出席" user={user} activeSeat={mySeat?.seat_name ?? null}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="section-title"><Ft>現在の座席状況</Ft></h2>
              <p className="mt-1 text-black">
                <Ft>空席</Ft> <span className="text-2xl font-bold">{seats.length - occupied}</span>
                <span className="text-sm font-medium"> / {seats.length} <Ft>席</Ft></span>
              </p>
              {updatedAt && (
                <p className="text-xs font-medium text-[var(--placeholder)]">
                  {updatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}{" "}
                  <Ft>時点（30秒ごとに自動更新）</Ft>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => reload().catch((e) => toast(errorMessage(e, "更新に失敗しました"), "error"))}
              disabled={refreshing}
              className="btn-secondary text-sm"
            >
              {refreshing ? <><Spinner size={16} /><Ft>更新中...</Ft></> : <Ft>更新</Ft>}
            </button>
          </div>

          {live === null ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : seats.length === 0 ? (
            <p className="font-medium text-black">
              <Ft>座席が登録されていません。</Ft>
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {seats.map((s) => (
                  <li
                    key={s.seat_id}
                    className={`flex min-h-[4rem] flex-col items-center justify-center rounded-xl border-2 p-2 text-center ${
                      s.is_mine
                        ? "border-[var(--navy)] bg-[var(--moon-yellow)]"
                        : s.is_occupied
                          ? "border-[var(--navy)]/40 bg-[var(--navy)]/10"
                          : "border-green-300 bg-green-50"
                    }`}
                    aria-label={`${s.seat_name} ${s.is_mine ? "あなたの席" : s.is_occupied ? "使用中" : "空席"}`}
                  >
                    <span className="font-bold text-black">{s.seat_name}</span>
                    <span className="text-xs font-bold text-black">
                      {s.is_mine ? (
                        <>
                          <Ft>あなた</Ft>
                          {s.check_in_time && <span className="block font-medium">{formatTimeJa(s.check_in_time)}〜</span>}
                        </>
                      ) : s.is_occupied ? (
                        <Ft>使用中</Ft>
                      ) : (
                        <span className="text-green-700"><Ft>空席</Ft></span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-black">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-green-300 bg-green-50" /><Ft>空席</Ft></span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-[var(--navy)]/40 bg-[var(--navy)]/10" /><Ft>使用中</Ft></span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-[var(--navy)] bg-[var(--moon-yellow)]" /><Ft>あなたの席</Ft></span>
              </p>
            </>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
