"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StudentShell from "@/components/StudentShell";
import { EmptyState, Field, Input, PageLoading, Select, SkeletonList, SubmitButton } from "@/components/ui/Input";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { Ft, FormatDateJa } from "@/components/FuriganaText";
import { reservationsApi, type DayAvailability, type ReservationItem } from "@/lib/api";
import { hasFullSlotInRange, isValidTimeRange, slotsInRange, timeToMinutes } from "@/lib/reservationSlots";
import { useAuth } from "@/lib/useAuth";
import { formatTimeJa } from "@/lib/utils";

/** 予約できる時間帯（バックエンドの空き状況表示と同じ 18:00〜22:00、30分刻み） */
const OPEN_TIME = "18:00";
const CLOSE_TIME = "22:00";
const STEP_MINUTES = 30;
/** 何日先まで予約できるか */
const MAX_DAYS_AHEAD = 30;

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const TIME_OPTIONS = (() => {
  const list: string[] = [];
  for (let m = timeToMinutes(OPEN_TIME); m <= timeToMinutes(CLOSE_TIME); m += STEP_MINUTES) {
    list.push(minutesToTime(m));
  }
  return list;
})();

function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function addDaysIso(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** 今日の場合、既に過ぎた開始時刻は選べないようにする */
function nowMinutesJst() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function SlotStrip({
  availability,
  startTime,
  endTime,
}: {
  availability: DayAvailability;
  startTime: string;
  endTime: string;
}) {
  const inRange = new Set(
    slotsInRange(availability.slots, startTime, endTime).map((s) => `${s.start_time}-${s.end_time}`),
  );
  return (
    <div className="slot-strip" role="list" aria-label="30分ごとの空き状況">
      {availability.slots.map((slot) => {
        const key = `${slot.start_time}-${slot.end_time}`;
        const tone = slot.is_full ? "full" : slot.available_seats <= 1 ? "few" : "ok";
        return (
          <div
            key={key}
            role="listitem"
            className={`slot-cell slot-cell--${tone} ${inRange.size > 0 && !inRange.has(key) ? "slot-cell--dim" : ""}`}
            aria-label={`${slot.start_time}から${slot.end_time} ${slot.is_full ? "満席" : `空き${slot.available_seats}席`}`}
          >
            <span>{slot.start_time}</span>
            <span className="text-sm">
              {slot.is_full ? <Ft>満席</Ft> : <>{slot.available_seats}<Ft>席</Ft></>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReservationsPage() {
  const { toast, confirm } = useFeedback();
  const { user, loading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [myReservations, setMyReservations] = useState<ReservationItem[] | null>(null);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("21:00");
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const listRef = useRef<HTMLElement>(null);

  const isReadOnly = user?.is_read_only ?? false;
  const today = todayIso();
  const maxDate = addDaysIso(today, MAX_DAYS_AHEAD);

  const reload = useCallback(async () => {
    setAvailabilityLoading(true);
    try {
      const [avail, mine] = await Promise.all([
        reservationsApi.availability(selectedDate),
        reservationsApi.mine(),
      ]);
      setAvailability(avail);
      setMyReservations(mine);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!user) return;
    reload().catch((e) => {
      setMyReservations((prev) => prev ?? []);
      toast(errorMessage(e, "予約情報の読み込みに失敗しました"), "error");
    });
  }, [user, reload, toast]);

  const timeRangeValid = isValidTimeRange(startTime, endTime);
  const hasFullSlot = availability ? hasFullSlotInRange(availability.slots, startTime, endTime) : false;
  const startIsPast = selectedDate === today && timeToMinutes(startTime) < nowMinutesJst();
  const alreadyReservedThatDay = (myReservations ?? []).some(
    (r) => new Date(r.start_time).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) === selectedDate,
  );

  /** 予約できない理由（ボタンの上に 1 行で表示） */
  const blockReason = useMemo(() => {
    if (!availability) return null;
    if (availability.total_seats === 0) return "座席が登録されていないため予約できません。";
    if (!timeRangeValid) return "退室予定は来室予定より後にしてください。";
    if (startIsPast) return "来室予定の時刻がもう過ぎています。後の時間を選んでください。";
    if (hasFullSlot) return "選んだ時間に満席の枠があります。赤い枠を避けて時間を選んでください。";
    return null;
  }, [availability, timeRangeValid, startIsPast, hasFullSlot]);

  const canReserve = !isReadOnly && !!availability && !blockReason && !submitting;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canReserve) return;
    setSubmitting(true);
    try {
      const created = await reservationsApi.create({
        reservation_date: selectedDate,
        start_time: startTime,
        end_time: endTime,
      });
      toast("予約しました");
      await reload();
      setHighlightId(created.reservation_id);
      requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      window.setTimeout(() => setHighlightId(null), 2500);
    } catch (err) {
      toast(errorMessage(err, "予約に失敗しました"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(r: ReservationItem) {
    const ok = await confirm({
      title: "この予約をキャンセルしますか？",
      message: `${new Date(r.start_time).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" })} ${formatTimeJa(r.start_time)}〜${formatTimeJa(r.end_time)}`,
      confirmLabel: "キャンセルする",
      cancelLabel: "やめる",
      danger: true,
    });
    if (!ok) return;
    setCancellingId(r.reservation_id);
    try {
      await reservationsApi.delete(r.reservation_id);
      toast("予約をキャンセルしました");
      await reload();
    } catch (err) {
      toast(errorMessage(err, "キャンセルに失敗しました"), "error");
    } finally {
      setCancellingId(null);
    }
  }

  if (loading || !user) {
    return <PageLoading />;
  }

  const availabilitySection = (
    <div className="space-y-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-bold text-[var(--navy)]">
        <FormatDateJa iso={selectedDate} /> <Ft>の空き状況</Ft>
        {availability && availability.total_seats > 0 && (
          <span className="ml-1 font-medium text-black">
            （<Ft>全</Ft>{availability.total_seats}<Ft>席</Ft>）
          </span>
        )}
      </h3>
      {availabilityLoading && !availability ? (
        <div className="skeleton h-14 rounded-xl" role="status" aria-label="読み込み中" />
      ) : !availability ? (
        <p className="text-sm font-medium text-black"><Ft>空き状況を読み込めませんでした。</Ft></p>
      ) : availability.total_seats === 0 ? (
        <p className="text-sm font-medium text-black"><Ft>座席が登録されていません。</Ft></p>
      ) : (
        <>
          <SlotStrip availability={availability} startTime={startTime} endTime={endTime} />
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-black">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-green-300 bg-green-50" /><Ft>空きあり</Ft></span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-orange-300 bg-orange-50" /><Ft>残りわずか</Ft></span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-red-600 bg-red-100" /><Ft>満席</Ft></span>
          </p>
        </>
      )}
    </div>
  );

  return (
    <StudentShell title="来塾予約" user={user}>
      <div className="app-shell w-full space-y-4 px-4 py-4 pb-12">
        <section className="card">
          <h2 className="section-title mb-3">
            {isReadOnly ? <Ft>空き状況を見る</Ft> : <Ft>予約を登録</Ft>}
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field
              label="日付"
              required={!isReadOnly}
              hint={`今日から${MAX_DAYS_AHEAD}日先まで選べます`}
            >
              <Input
                type="date"
                value={selectedDate}
                min={today}
                max={maxDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                required
              />
            </Field>

            {!isReadOnly && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="来室予定" required>
                  <Select value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                    {TIME_OPTIONS.slice(0, -1).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="退室予定" required>
                  <Select value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                    {TIME_OPTIONS.slice(1).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}

            {availabilitySection}

            {!isReadOnly && (
              <>
                {blockReason && (
                  <p className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert">
                    <Ft>{blockReason}</Ft>
                  </p>
                )}
                {!blockReason && alreadyReservedThatDay && (
                  <p className="rounded-xl bg-[var(--moon-yellow)]/30 px-3 py-2 text-sm font-bold text-black">
                    <Ft>この日はすでに予約があります。下の「自分の予約」も確認してください。</Ft>
                  </p>
                )}
                <SubmitButton busy={submitting} disabled={!canReserve} busyLabel="予約中...">
                  予約する
                </SubmitButton>
              </>
            )}
          </form>
        </section>

        <section ref={listRef} className="card scroll-mt-24">
          <h2 className="section-title mb-3">
            {isReadOnly ? <Ft>予約一覧</Ft> : <Ft>自分の予約</Ft>}
          </h2>
          {myReservations === null ? (
            <SkeletonList rows={2} />
          ) : myReservations.length === 0 ? (
            <EmptyState message="予約がありません" />
          ) : (
            <ul className="space-y-2">
              {myReservations.map((r) => (
                <li
                  key={r.reservation_id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 bg-[var(--surface)] p-3 transition-shadow ${
                    highlightId === r.reservation_id ? "border-[var(--navy)] study-plan-focus" : "border-[var(--border)]"
                  }`}
                >
                  <div>
                    <p className="font-bold text-black">
                      <FormatDateJa iso={r.start_time} />
                    </p>
                    <p className="text-base font-bold text-[var(--navy)]">
                      {formatTimeJa(r.start_time)}〜{formatTimeJa(r.end_time)}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      disabled={cancellingId === r.reservation_id}
                      className="btn-tap-sm border-2 border-red-600 bg-red-50 text-red-700 disabled:opacity-50"
                      onClick={() => handleCancel(r)}
                    >
                      {cancellingId === r.reservation_id ? <Ft>処理中...</Ft> : <Ft>キャンセル</Ft>}
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
