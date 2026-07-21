"use client";

import { useCallback, useEffect, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, EmptyState } from "@/components/ui/Input";
import { reservationsApi, type DayAvailability, type ReservationItem } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { formatDateJa, formatTimeJa } from "@/lib/utils";

function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export default function ReservationsPage() {
  const { user, loading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [myReservations, setMyReservations] = useState<ReservationItem[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [submitting, setSubmitting] = useState(false);

  const isReadOnly = user?.is_read_only ?? false;

  const reload = useCallback(async () => {
    const [avail, mine] = await Promise.all([
      reservationsApi.availability(selectedDate),
      reservationsApi.mine(),
    ]);
    setAvailability(avail);
    setMyReservations(mine);
  }, [selectedDate]);

  useEffect(() => {
    if (!user) return;
    reload().catch(console.error);
  }, [user, reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await reservationsApi.create({
        reservation_date: selectedDate,
        start_time: startTime,
        end_time: endTime,
      });
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "予約に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <div className="p-8 font-bold text-black">読み込み中...</div>;
  }

  return (
    <StudentShell title="来塾予約" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <h2 className="section-title mb-3">日付を選ぶ</h2>
          <Input
            type="date"
            value={selectedDate}
            min={todayIso()}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </section>

        {availability && (
          <section className="card">
            <h2 className="section-title mb-3">
              {formatDateJa(selectedDate)} の空き状況（18:00〜22:00・30分単位 / 座席 {availability.total_seats} 席）
            </h2>
            {availability.total_seats === 0 ? (
              <p className="text-sm font-medium text-black">座席が登録されていません。</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availability.slots.map((slot) => (
                  <div
                    key={`${slot.start_time}-${slot.end_time}`}
                    className={`rounded-xl border-2 p-3 ${
                      slot.is_full
                        ? "border-red-300 bg-red-50"
                        : slot.available_seats <= 1
                          ? "border-orange-300 bg-orange-50"
                          : "border-green-300 bg-green-50"
                    }`}
                  >
                    <p className="font-bold text-black">
                      {slot.start_time}〜{slot.end_time}
                    </p>
                    <p className="mt-1 text-sm font-medium text-black">
                      {slot.is_full ? (
                        <span className="text-red-700">満席</span>
                      ) : (
                        <>
                          空き <span className="font-bold text-green-700">{slot.available_seats}</span> / {slot.total_seats} 席
                        </>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3">予約を登録</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>来室予定</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </div>
                <div>
                  <Label>退室予定</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
                {submitting ? "予約中..." : "予約する"}
              </button>
            </form>
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3">{isReadOnly ? "予約一覧" : "自分の予約"}</h2>
          {myReservations.length === 0 ? (
            <EmptyState message="予約がありません" />
          ) : (
            <ul className="space-y-2">
              {myReservations.map((r) => (
                <li
                  key={r.reservation_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div>
                    <p className="font-bold text-black">{formatDateJa(r.start_time)}</p>
                    <p className="text-sm font-medium text-black">
                      {formatTimeJa(r.start_time)}〜{formatTimeJa(r.end_time)}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      className="rounded-full border-2 border-red-600 bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                      onClick={async () => {
                        if (!confirm("この予約をキャンセルしますか？")) return;
                        await reservationsApi.delete(r.reservation_id);
                        reload();
                      }}
                    >
                      キャンセル
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
