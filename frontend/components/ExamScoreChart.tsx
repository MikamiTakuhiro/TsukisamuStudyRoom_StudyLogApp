"use client";

import { useMemo, useState } from "react";
import type { ExamResult } from "@/lib/api";
import { Ft } from "@/components/FuriganaText";

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 28, right: 28, bottom: 44, left: 48 };

function formatAxisDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });
}

/** 模試の合計点の推移（1 系列の折れ線）。点をタップすると値を表示する。 */
export default function ExamScoreChart({ exams }: { exams: ExamResult[] }) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const chart = useMemo(() => {
    const points = [...exams]
      .filter((e) => typeof e.total_score === "number")
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
    if (points.length === 0) return null;

    const maxScore = Math.max(...points.map((p) => p.total_score));
    const niceMax = Math.max(100, Math.ceil(maxScore / 50) * 50);
    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const xAt = (i: number) => (points.length <= 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW);
    const yAt = (v: number) => PAD.top + plotH - (v / niceMax) * plotH;
    const ticks = Array.from({ length: 5 }, (_, i) => Math.round((niceMax / 4) * i));

    return {
      points: points.map((p, i) => ({ exam: p, x: xAt(i), y: yAt(p.total_score) })),
      ticks,
      yAt,
      pathD: points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.total_score)}`).join(" "),
    };
  }, [exams]);

  if (!chart) return null;

  const last = chart.points[chart.points.length - 1];
  const active = chart.points.find((p) => p.exam.exam_result_id === activeId) ?? null;
  const labelPoint = active ?? last;

  return (
    <figure className="w-full">
      <figcaption className="mb-2 text-sm font-bold text-[var(--navy)]">
        <Ft>合計点の推移</Ft>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`合計点の推移: ${chart.points.map((p) => `${formatAxisDate(p.exam.exam_date)} ${p.exam.total_score}点`).join("、")}`}
      >
        {chart.ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={chart.yAt(t)}
              y2={chart.yAt(t)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
            <text x={PAD.left - 8} y={chart.yAt(t) + 4} textAnchor="end" className="aspiration-chart-axis-label">
              {t}
            </text>
          </g>
        ))}

        {chart.points.map((p) => (
          <text
            key={`x-${p.exam.exam_result_id}`}
            x={p.x}
            y={HEIGHT - PAD.bottom + 20}
            textAnchor="middle"
            className="aspiration-chart-axis-label"
          >
            {formatAxisDate(p.exam.exam_date)}
          </text>
        ))}

        {chart.points.length > 1 && (
          <path d={chart.pathD} fill="none" stroke="var(--navy)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {chart.points.map((p) => {
          const isActive = p === labelPoint;
          return (
            <g
              key={p.exam.exam_result_id}
              onClick={() => setActiveId(p.exam.exam_result_id)}
              style={{ cursor: "pointer" }}
            >
              {/* 見た目より大きいタップ領域 */}
              <circle cx={p.x} cy={p.y} r={22} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 6 : 4.5}
                fill={isActive ? "var(--moon-yellow)" : "var(--navy)"}
                stroke={isActive ? "var(--navy)" : "#ffffff"}
                strokeWidth={2}
              />
            </g>
          );
        })}

        <text
          x={Math.min(Math.max(labelPoint.x, PAD.left + 40), WIDTH - PAD.right - 40)}
          y={labelPoint.y - 12}
          textAnchor="middle"
          fontSize={15}
          fontWeight={700}
          fill="#000000"
        >
          {labelPoint.exam.total_score}点
        </text>
      </svg>
      <p className="mt-1 text-center text-xs font-medium text-[var(--placeholder)]">
        {active ? (
          <>{active.exam.exam_name}</>
        ) : (
          <Ft>点をタップすると各回の点数が見られます</Ft>
        )}
      </p>
    </figure>
  );
}
