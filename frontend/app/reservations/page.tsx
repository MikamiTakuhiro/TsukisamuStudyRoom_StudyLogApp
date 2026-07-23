"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { Input, Label, EmptyState } from "@/components/ui/Input";
import { Ft, FormatDateJa } from "@/components/FuriganaText";
import { reservationsApi, type DayAvailability, type ReservationItem } from "@/lib/api";
import { hasFullSlotInRange, isValidTimeRange, slotsInRange } from "@/lib/reservationSlots";
import { useAuth } from "@/lib/useAuth";
import { formatTimeJa } from "@/lib/utils";

function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function SlotStatusCard({ slot }: { slot: DayAvailability["slots"][number] }) {
  return (
    <div
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
          <span className="text-red-700"><Ft>満席</Ft></span>
        ) : (
          <>
            <Ft>空き</Ft> <span className="font-bold text-green-700">{slot.available_seats}</span> / {slot.total_seats}{" "}
            <Ft>席</Ft>
          </>
        )}
      </p>
    </div>
  );
}

export default function ReservationsPage() {
  const { user, loading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [myReservations, setMyReservations] = useState<ReservationItem[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("21:00");
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

  const selectedSlots = useMemo(() => {
    if (!availability) return [];
    return slotsInRange(availability.slots, startTime, endTime);
  }, [availability, startTime, endTime]);

  const timeRangeValid = isValidTimeRange(startTime, endTime);
  const hasFullSlot = availability ? hasFullSlotInRange(availability.slots, startTime, endTime) : false;
  const canReserve =
    !isReadOnly &&
    availability &&
    availability.total_seats > 0 &&
    timeRangeValid &&
    !hasFullSlot &&
    !submitting;
  const showSelectedAvailability = !!availability && timeRangeValid;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canReserve) return;
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
    return (
      <div className="p-8 font-bold text-black">
        <Ft>読み込み中...</Ft>
      </div>
    );
  }

  return (
    <StudentShell title="来塾予約" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        {!isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3"><Ft>予約を登録</Ft></h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="reservation-date">日付</Label>
                <Input
                  id="reservation-date"
                  type="date"
                  value={selectedDate}
                  min={todayIso()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="reservation-start">来室予定</Label>
                  <Input
                    id="reservation-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="reservation-end">退室予定</Label>
                  <Input
                    id="reservation-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {!timeRangeValid && (
                <p className="text-sm font-bold text-red-700">
                  <Ft>退室予定は来室予定より後にしてください。</Ft>
                </p>
              )}

              <button type="submit" disabled={!canReserve} className="btn-primary w-full disabled:opacity-50">
                {submitting ? (
                  <Ft>予約中...</Ft>
                ) : hasFullSlot ? (
                  <Ft>予約状況を確認してください</Ft>
                ) : !timeRangeValid ? (
                  <Ft>時間を確認してください</Ft>
                ) : (
                  <Ft>予約する</Ft>
                )}
              </button>

              {showSelectedAvailability && (
                <div className="space-y-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-4">
                  <h3 className="text-sm font-bold text-[var(--navy)]">
                    <FormatDateJa iso={selectedDate} /> {startTime}〜{endTime}{" "}
                    <Ft>の空き状況（30分単位 / 座席</Ft> {availability.total_seats} <Ft>席）</Ft>
                  </h3>

                  {availability.total_seats === 0 ? (
                    <p className="text-sm font-medium text-black">
                      <Ft>座席が登録されていません。</Ft>
                    </p>
                  ) : selectedSlots.length === 0 ? (
                    <p className="text-sm font-medium text-black">
                      <Ft>この時間帯の空き状況を表示できません。18:00〜22:00の範囲で選んでください。</Ft>
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {selectedSlots.map((slot) => (
                        <SlotStatusCard key={`${slot.start_time}-${slot.end_time}`} slot={slot} />
                      ))}
                    </div>
                  )}

                  {hasFullSlot && (
                    <p className="text-sm font-bold text-red-700">
                      <Ft>選択した時間帯に満席の30分枠があります。時間を変更するか、空き状況を確認してください。</Ft>
                    </p>
                  )}
                </div>
              )}
            </form>
          </section>
        )}

        {isReadOnly && (
          <section className="card">
            <h2 className="section-title mb-3"><Ft>日付を選ぶ</Ft></h2>
            <Input
              type="date"
              value={selectedDate}
              min={todayIso()}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </section>
        )}

        <section className="card">
          <h2 className="section-title mb-3">
            {isReadOnly ? <Ft>予約一覧</Ft> : <Ft>自分の予約</Ft>}
          </h2>
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
                    <p className="font-bold text-black">
                      <FormatDateJa iso={r.start_time} />
                    </p>
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
                      <Ft>キャンセル</Ft>
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
