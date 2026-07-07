"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarWeek } from "@/lib/api";
import { formatDateJa } from "@/lib/utils";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function parseDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** 週の最後の日（土曜）が属する月 — 表示領域の下端基準用 */
function getWeekBottomMonth(week: CalendarWeek) {
  const lastDay = week.days[week.days.length - 1];
  return parseDate(lastDay.date);
}

/** 1日を含む週の上に表示する月ラベル（1日がある週のみ） */
function getMonthLabelsForWeek(week: CalendarWeek) {
  const labels: { year: number; month: number }[] = [];
  const seen = new Set<string>();
  for (const day of week.days) {
    const parsed = parseDate(day.date);
    if (parsed.day !== 1) continue;
    const key = `${parsed.year}-${parsed.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push({ year: parsed.year, month: parsed.month });
  }
  return labels;
}

function cellClass(color: string) {
  if (color === "yellow") return "bg-[var(--moon-yellow)] border-[var(--navy)]/30";
  if (color === "navy") return "bg-[var(--navy)] border-[var(--navy)]";
  if (color === "stripe") return "calendar-stripe border-[var(--navy)]/30";
  return "bg-white border-[var(--border)]";
}

function dayNumberClass(color: string) {
  if (color === "navy") return "text-white/95";
  return "text-black/75";
}

export default function StudyCalendar({
  weeks,
  onDayClick,
}: {
  weeks: CalendarWeek[];
  onDayClick: (week: CalendarWeek, dayIndex: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const weekRefs = useRef<(HTMLDivElement | null)[]>([]);

  const initial = useMemo(() => {
    if (!weeks.length) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    return getWeekBottomMonth(weeks[weeks.length - 1]);
  }, [weeks]);

  const [visibleYear, setVisibleYear] = useState(initial.year);
  const [visibleMonth, setVisibleMonth] = useState(initial.month);

  const updateVisibleMonth = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !weeks.length) return;

    const bottomEdge = container.getBoundingClientRect().bottom - 2;
    let targetIndex = weeks.length - 1;

    for (let i = 0; i < weekRefs.current.length; i++) {
      const el = weekRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= bottomEdge) {
        targetIndex = i;
      }
    }

    const { year, month } = getWeekBottomMonth(weeks[targetIndex]);
    setVisibleYear(year);
    setVisibleMonth(month);
  }, [weeks]);

  useEffect(() => {
    weekRefs.current = weekRefs.current.slice(0, weeks.length);
  }, [weeks.length]);

  useEffect(() => {
    if (!weeks.length) return;
    const last = getWeekBottomMonth(weeks[weeks.length - 1]);
    setVisibleYear(last.year);
    setVisibleMonth(last.month);
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    requestAnimationFrame(updateVisibleMonth);
  }, [weeks, updateVisibleMonth]);

  return (
    <div className="calendar-shell card mb-6">
      <h2 className="section-title mb-2 px-1">学習履歴カレンダー</h2>

      <div className="calendar-chrome sticky top-0 z-10 bg-white">
        <div className="border-b border-[var(--border)] px-2 py-2.5">
          <p className="text-center text-lg font-bold tracking-tight text-[var(--navy)]">
            {visibleYear}年{visibleMonth}月
          </p>
        </div>

        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-white py-2">
          {DAY_LABELS.map((d) => (
            <span key={d} className="text-center text-[11px] font-bold text-[var(--navy)]">
              {d}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="calendar-scroll max-h-[380px] overflow-y-auto overscroll-contain px-0.5 pb-1"
        onScroll={updateVisibleMonth}
      >
        {weeks.map((week, wi) => {
          const monthLabels = getMonthLabelsForWeek(week);
          return (
            <div
              key={week.week_start}
              ref={(el) => {
                weekRefs.current[wi] = el;
              }}
            >
              {monthLabels.map(({ year, month }) => (
                <p
                  key={`${week.week_start}-${year}-${month}`}
                  className="px-1 pb-1 pt-2 text-sm font-bold text-[var(--navy)]"
                >
                  {year}年{month}月
                </p>
              ))}
              <div className="grid grid-cols-7 gap-0.5 py-0.5">
                {week.days.map((day, idx) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => onDayClick(week, idx)}
                    className={`calendar-day-cell relative min-h-[56px] w-full rounded-md border ${cellClass(day.color)} touch-manipulation active:opacity-90`}
                    aria-label={formatDateJa(day.date)}
                  >
                    <span
                      className={`absolute left-1.5 top-1 text-[11px] font-semibold leading-none ${dayNumberClass(day.color)}`}
                    >
                      {parseDate(day.date).day}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] px-1 pt-3 text-xs font-bold text-black">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded border border-[var(--navy)] bg-[var(--moon-yellow)]" /> 塾
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded bg-[var(--navy)]" /> 家
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded border border-[var(--navy)] calendar-stripe" /> 塾+家
        </span>
      </div>
    </div>
  );
}
