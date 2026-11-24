import type { ReservationItem } from "@/lib/api";

const APP_TIMEZONE = "Asia/Tokyo";

export function dateKeyInAppTz(iso: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function todayKey(): string {
  return dateKeyInAppTz(new Date());
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type ReservationDayLevel = "none" | "comfortable" | "low" | "full";

export type ReservationCalendarDay = {
  date: string;
  isToday: boolean;
  isPast: boolean;
  /** その日の予約人数 */
  reservedCount: number;
  /** 最も混み合う時間帯での空席数 */
  remaining: number;
  level: ReservationDayLevel;
};

export type ReservationCalendarWeek = {
  weekStart: string;
  days: ReservationCalendarDay[];
};

/** 同時に予約が重なる最大数 */
export function peakConcurrent(
  intervals: { start: number; end: number }[],
  windowStart?: number,
  windowEnd?: number,
): number {
  const events: [number, number][] = [];
  for (const it of intervals) {
    const s = windowStart === undefined ? it.start : Math.max(it.start, windowStart);
    const e = windowEnd === undefined ? it.end : Math.min(it.end, windowEnd);
    if (s >= e) continue;
    events.push([s, 1], [e, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  for (const [, delta] of events) {
    cur += delta;
    peak = Math.max(peak, cur);
  }
  return peak;
}

function toIntervals(list: ReservationItem[]) {
  return list.map((r) => ({
    start: new Date(r.start_time).getTime(),
    end: new Date(r.end_time).getTime(),
  }));
}

export function groupReservationsByDate(reservations: ReservationItem[]): Map<string, ReservationItem[]> {
  const map = new Map<string, ReservationItem[]>();
  for (const r of reservations) {
    const key = dateKeyInAppTz(r.start_time);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }
  return map;
}

export function dayLevel(remaining: number, totalSeats: number, reservedCount: number): ReservationDayLevel {
  if (totalSeats > 0 && remaining <= 0) return "full";
  if (totalSeats > 0 && remaining <= Math.max(1, Math.ceil(totalSeats * 0.25))) return "low";
  return reservedCount === 0 ? "none" : "comfortable";
}

/** 今週から先 minWeeks 週（予約がそれより先にあればそこまで）のカレンダー */
export function buildReservationWeeks(
  reservations: ReservationItem[],
  totalSeats: number,
  minWeeks = 8,
): ReservationCalendarWeek[] {
  const today = todayKey();
  const byDate = groupReservationsByDate(reservations);

  const lastKey = [...byDate.keys()].sort().pop() ?? today;
  const first = parseKey(today);
  first.setDate(first.getDate() - first.getDay());
  const last = parseKey(lastKey > today ? lastKey : today);
  last.setDate(last.getDate() - last.getDay());
  const spanWeeks = Math.round((last.getTime() - first.getTime()) / (7 * 86400000)) + 1;
  const weekCount = Math.max(minWeeks, spanWeeks);

  const weeks: ReservationCalendarWeek[] = [];
  for (let w = 0; w < weekCount; w++) {
    const days: ReservationCalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(first);
      date.setDate(first.getDate() + w * 7 + d);
      const key = toKey(date);
      const list = byDate.get(key) ?? [];
      const peak = peakConcurrent(toIntervals(list));
      const remaining = Math.max(0, totalSeats - peak);
      days.push({
        date: key,
        isToday: key === today,
        isPast: key < today,
        reservedCount: list.length,
        remaining,
        level: dayLevel(remaining, totalSeats, list.length),
      });
    }
    weeks.push({ weekStart: toKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7)), days });
  }
  return weeks;
}

export type DaySlot = { label: string; reserved: number; remaining: number; isFull: boolean };

/** 18:00〜22:00 を30分刻みで集計（来室者向けの空き状況と同じ区切り） */
export function buildDaySlots(dateKey: string, list: ReservationItem[], totalSeats: number): DaySlot[] {
  const intervals = toIntervals(list);
  const base = parseKey(dateKey);
  const slots: DaySlot[] = [];
  for (let minutes = 18 * 60; minutes < 22 * 60; minutes += 30) {
    const s = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, minutes).getTime();
    const e = s + 30 * 60000;
    const reserved = peakConcurrent(intervals, s, e);
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    slots.push({
      label: `${fmt(minutes)}〜${fmt(minutes + 30)}`,
      reserved,
      remaining: Math.max(0, totalSeats - reserved),
      isFull: totalSeats > 0 && reserved >= totalSeats,
    });
  }
  return slots;
}
