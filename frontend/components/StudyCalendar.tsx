"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarWeek } from "@/lib/api";
import { Ft } from "@/components/FuriganaText";
import { useReading } from "@/context/ReadingContext";
import { formatDateJa } from "@/lib/utils";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const DAY_READINGS: Record<(typeof DAY_LABELS)[number], string> = {
  日: "にち",
  月: "げつ",
  火: "か",
  水: "すい",
  木: "もく",
  金: "きん",
  土: "ど",
};

function DayLabel({ label }: { label: (typeof DAY_LABELS)[number] }) {
  const { showFurigana } = useReading();
  if (!showFurigana) return <>{label}</>;
  return (
    <ruby className="furigana-ruby">
      {label}
      <rt>{DAY_READINGS[label]}</rt>
    </ruby>
  );
}

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

/** 色の意味を読み上げ・aria-label 用の文言にする */
function colorDescription(color: string) {
  if (color === "yellow") return "塾で学習";
  if (color === "navy") return "家で学習";
  if (color === "stripe") return "塾と家で学習";
  return "学習記録なし";
}

function dayNumberClass(color: string) {
  if (color === "navy") return "text-white/95";
  return "text-black/75";
}

export default function StudyCalendar({
  weeks,
  onDayClick,
  fillHeight = false,
  loading = false,
}: {
  weeks: CalendarWeek[];
  onDayClick: (week: CalendarWeek, dayIndex: number) => void;
  fillHeight?: boolean;
  loading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
  /** 最新週（今日）から離れたら「今日へ」ボタンを出す */
  const [awayFromToday, setAwayFromToday] = useState(false);

  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, []);

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
    setAwayFromToday(container.scrollHeight - container.scrollTop - container.clientHeight > 80);
  }, [weeks]);

  useEffect(() => {
    weekRefs.current = weekRefs.current.slice(0, weeks.length);
  }, [weeks.length]);

  useEffect(() => {
    if (!weeks.length) return;
    const last = getWeekBottomMonth(weeks[weeks.length - 1]);
    setVisibleYear(last.year);
    setVisibleMonth(last.month);
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    requestAnimationFrame(updateVisibleMonth);
  }, [weeks, updateVisibleMonth]);

  return (
    <div
      className={`calendar-shell card relative z-0 flex min-h-0 flex-col ${fillHeight ? "mb-0 h-full flex-1" : "mb-6"}`}
    >
      <h2 className="section-title mb-2 shrink-0 px-1"><Ft>学習履歴カレンダー</Ft></h2>

      <div className={`calendar-chrome z-10 shrink-0 bg-white ${fillHeight ? "" : "sticky top-0"}`}>
        <div className="relative flex min-h-[2.75rem] items-center justify-center border-b border-[var(--border)] px-2 py-1.5">
          <p className="text-center text-lg font-bold tracking-tight text-[var(--navy)]" aria-live="polite">
            {visibleYear}<Ft>年</Ft>{visibleMonth}<Ft>月</Ft>
          </p>
          {awayFromToday && (
            <button
              type="button"
              onClick={scrollToToday}
              className="btn-tap-sm absolute right-1 top-1/2 -translate-y-1/2 border-2 border-[var(--navy)] bg-[var(--moon-yellow)] text-black"
            >
              <Ft>今日へ</Ft> ↓
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-white py-2">
          {DAY_LABELS.map((d) => (
            <span
              key={d}
              className={`text-center text-xs font-bold ${d === "日" ? "text-red-600" : d === "土" ? "text-blue-700" : "text-[var(--navy)]"}`}
            >
              <DayLabel label={d} />
            </span>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`calendar-scroll overscroll-contain px-0.5 pb-1 ${
          fillHeight ? "min-h-0 flex-1 overflow-y-auto" : "max-h-[380px] overflow-y-auto"
        }`}
        onScroll={updateVisibleMonth}
      >
        {loading && weeks.length === 0 && (
          <div className="space-y-1 py-1" role="status" aria-label="読み込み中">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton h-11 rounded-md" />
            ))}
          </div>
        )}
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
                {week.days.map((day, idx) => {
                  const planCount = day.target_plans?.length ?? 0;
                  const label = [
                    formatDateJa(day.date),
                    day.is_today ? "今日" : null,
                    colorDescription(day.color),
                    planCount > 0 ? `完了目標 ${planCount}件` : null,
                  ]
                    .filter(Boolean)
                    .join("、");
                  return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => onDayClick(week, idx)}
                    className={`calendar-day-cell relative w-full rounded-md border ${cellClass(day.color)} ${
                      day.is_today ? "calendar-day-today" : ""
                    } ${fillHeight ? "min-h-[44px]" : "min-h-[56px]"}`}
                    aria-label={label}
                    aria-current={day.is_today ? "date" : undefined}
                  >
                    <span
                      className={`absolute left-1.5 top-1 text-xs font-bold leading-none ${dayNumberClass(day.color)}`}
                    >
                      {parseDate(day.date).day}
                    </span>
                    {planCount > 0 && (
                      <span
                        className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-white bg-red-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="h-1" />
      </div>

      <div className="mt-2 flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border)] px-1 pt-2 text-xs font-bold text-black">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded border border-[var(--navy)] bg-[var(--moon-yellow)]" /> <Ft>塾で学習</Ft>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded bg-[var(--navy)]" /> <Ft>家で学習</Ft>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded border border-[var(--navy)] calendar-stripe" /> <Ft>塾と家</Ft>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> <Ft>完了目標日</Ft>
        </span>
      </div>
    </div>
  );
}
