"use client";

import { useMemo } from "react";
import type { Aspiration } from "@/lib/api";
import { SCHOOL_LINE_COLORS, uniqueChartDates, uniqueSchools } from "@/lib/aspirations";

type Props = {
  items: Aspiration[];
};

const WIDTH = 640;
const HEIGHT = 280;
const PAD = { top: 20, right: 20, bottom: 52, left: 56 };

function formatAxisDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

export default function AspirationChart({ items }: Props) {
  const chart = useMemo(() => {
    const dates = uniqueChartDates(items);
    const schools = uniqueSchools(items);
    const maxRank = Math.max(5, ...items.map((i) => i.priority_rank));
    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;

    const xAt = (date: string) => {
      const idx = dates.indexOf(date);
      if (dates.length <= 1) return PAD.left + plotW / 2;
      return PAD.left + (idx / (dates.length - 1)) * plotW;
    };

    const yAt = (rank: number) => PAD.top + ((rank - 1) / Math.max(maxRank - 1, 1)) * plotH;

    const lines = schools.map((school, i) => {
      const points = items
        .filter((item) => item.target_school === school)
        .sort((a, b) => a.date_recorded.localeCompare(b.date_recorded));

      const pathD = points
        .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xAt(p.date_recorded)} ${yAt(p.priority_rank)}`)
        .join(" ");

      return {
        school,
        color: SCHOOL_LINE_COLORS[i % SCHOOL_LINE_COLORS.length],
        pathD,
        points: points.map((p) => ({
          x: xAt(p.date_recorded),
          y: yAt(p.priority_rank),
          rank: p.priority_rank,
          date: p.date_recorded,
        })),
      };
    });

    const yTicks = Array.from({ length: maxRank }, (_, i) => i + 1);

    return { dates, lines, yTicks, yAt, maxRank };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="aspiration-chart overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="min-w-[20rem] w-full"
        role="img"
        aria-label="志望校の志望度推移グラフ"
      >
        {/* 横軸 */}
        <line
          x1={PAD.left}
          y1={HEIGHT - PAD.bottom}
          x2={WIDTH - PAD.right}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--border)"
          strokeWidth={2}
        />
        {/* 縦軸 */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--border)"
          strokeWidth={2}
        />

        {chart.yTicks.map((rank) => (
          <g key={rank}>
            <line
              x1={PAD.left}
              y1={chart.yAt(rank)}
              x2={WIDTH - PAD.right}
              y2={chart.yAt(rank)}
              stroke="var(--surface)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={chart.yAt(rank)}
              textAnchor="end"
              dominantBaseline="middle"
              className="aspiration-chart-axis-label"
            >
              第{rank}
            </text>
          </g>
        ))}

        {chart.dates.map((date) => {
          const x = chart.dates.length <= 1
            ? PAD.left + (WIDTH - PAD.left - PAD.right) / 2
            : PAD.left + (chart.dates.indexOf(date) / Math.max(chart.dates.length - 1, 1)) * (WIDTH - PAD.left - PAD.right);
          return (
            <text
              key={date}
              x={x}
              y={HEIGHT - PAD.bottom + 22}
              textAnchor="middle"
              className="aspiration-chart-axis-label"
            >
              {formatAxisDate(date)}
            </text>
          );
        })}

        {chart.lines.map((line) => (
          <g key={line.school}>
            {line.points.length > 1 && (
              <path
                d={line.pathD}
                fill="none"
                stroke={line.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {line.points.map((pt) => (
              <circle
                key={`${line.school}-${pt.date}`}
                cx={pt.x}
                cy={pt.y}
                r={5}
                fill={line.color}
                stroke="#ffffff"
                strokeWidth={2}
              >
                <title>
                  {line.school}（第{pt.rank}志望・{formatAxisDate(pt.date)}）
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {chart.lines.map((line) => (
          <div key={line.school} className="flex items-center gap-2 text-sm font-medium text-black">
            <span
              className="inline-block h-0.5 w-5 shrink-0 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            <span>{line.school}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
