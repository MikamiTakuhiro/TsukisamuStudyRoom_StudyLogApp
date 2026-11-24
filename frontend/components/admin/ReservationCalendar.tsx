"use client";

import type { ReservationCalendarDay, ReservationCalendarWeek } from "@/lib/reservationCalendar";
import { formatDateJa } from "@/lib/utils";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function parseDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m, day: d };
}

function monthLabelsForWeek(week: ReservationCalendarWeek) {
  return week.days
    .map((d) => parseDate(d.date))
    .filter((p) => p.day === 1)
    .map((p) => ({ year: p.year, month: p.month }));
}

/** 余裕あり=緑 / 残りわずか=赤 / 満席=暗い */
function cellClass(day: ReservationCalendarDay) {
  if (day.isPast) return "bg-[var(--surface)] border-[var(--border)] opacity-50";
  switch (day.level) {
    case "full":
      return "bg-gray-600 border-gray-700";
    case "low":
      return "bg-red-100 border-red-300";
    case "comfortable":
      return "bg-green-100 border-green-300";
    default:
      return "bg-white border-[var(--border)]";
  }
}

function textClass(day: ReservationCalendarDay) {
  return day.level === "full" && !day.isPast ? "text-white" : "text-black";
}

function remainingClass(day: ReservationCalendarDay) {
  if (day.level === "full") return "text-white";
  if (day.level === "low") return "text-red-700";
  if (day.level === "comfortable") return "text-green-700";
  return "text-black/60";
}

export default function ReservationCalendar({
  weeks,
  totalSeats,
  selectedDate,
  onSelect,
}: {
  weeks: ReservationCalendarWeek[];
  totalSeats: number;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const first = weeks[0]?.days.find((d) => d.isToday) ?? weeks[0]?.days[0];
  const head = first ? parseDate(first.date) : null;

  return (
    <div className="calendar-shell card relative z-0 flex min-h-0 flex-col">
      <h2 className="section-title mb-2 shrink-0 px-1">予約カレンダー</h2>

      <div className="shrink-0 bg-white">
        {head && (
          <div className="border-b border-[var(--border)] px-2 py-2.5">
            <p className="text-center text-lg font-bold tracking-tight text-[var(--navy)]">
              {head.year}年{head.month}月〜
            </p>
          </div>
        )}
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-white py-2">
          {DAY_LABELS.map((d) => (
            <span key={d} className="text-center text-[11px] font-bold text-[var(--navy)] lg:text-sm">
              {d}
            </span>
          ))}
        </div>
      </div>

      <div className="calendar-scroll max-h-[34rem] overflow-y-auto overscroll-contain px-0.5 pb-1 lg:max-h-[calc(100dvh-20rem)]">
        {weeks.map((week) => (
          <div key={week.weekStart}>
            {monthLabelsForWeek(week).map(({ year, month }) => (
              <p key={`${week.weekStart}-${year}-${month}`} className="px-1 pb-1 pt-2 text-sm font-bold text-[var(--navy)]">
                {year}年{month}月
              </p>
            ))}
            <div className="grid grid-cols-7 gap-0.5 py-0.5">
              {week.days.map((day) => {
                const selected = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={day.isPast}
                    onClick={() => onSelect(day.date)}
                    className={`calendar-day-cell relative min-h-[64px] w-full rounded-md border lg:min-h-[88px] ${cellClass(day)} ${
                      day.isToday ? "calendar-day-today" : ""
                    } ${selected ? "ring-4 ring-[var(--moon-yellow-dark)]" : ""} disabled:cursor-default`}
                    aria-label={`${formatDateJa(day.date)} 予約${day.reservedCount}人 残り${day.remaining}席`}
                    aria-pressed={selected}
                  >
                    <span className={`absolute left-1.5 top-1 text-[11px] font-semibold leading-none lg:text-sm ${textClass(day)}`}>
                      {parseDate(day.date).day}
                    </span>
                    {!day.isPast && (
                      <span className="absolute inset-x-0 bottom-1 flex flex-col items-center leading-tight">
                        <span className={`text-[10px] font-bold lg:text-xs ${textClass(day)}`}>予約{day.reservedCount}人</span>
                        <span className={`text-[11px] font-bold lg:text-sm ${remainingClass(day)}`}>
                          {day.level === "full" ? "満席" : `残り${day.remaining}`}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 flex-wrap gap-3 border-t border-[var(--border)] px-1 pt-2 text-xs font-bold text-black">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded border border-green-300 bg-green-100" /> 余裕あり
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded border border-red-300 bg-red-100" /> 残りわずか
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded border border-gray-700 bg-gray-600" /> 満席
        </span>
        <span className="font-medium text-black/70">
          全{totalSeats}席・残り＝最も混む時間帯での空席数
        </span>
      </div>
    </div>
  );
}
