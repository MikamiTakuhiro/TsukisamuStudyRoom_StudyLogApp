"use client";

import { formatChartDate } from "@/lib/adminAnalytics";

export type BarItem = { label: string; value: number; color?: string };
export type LinePoint = { date: string; value: number };

type BarProps = {
  title: string;
  items: BarItem[];
  valueSuffix?: string;
  emptyMessage?: string;
};

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 24, right: 16, bottom: 64, left: 48 };

export function AnalyticsBarChart({ title, items, valueSuffix = "", emptyMessage = "データがありません" }: BarProps) {
  if (items.length === 0) {
    return (
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">{title}</h3>
        <p className="py-8 text-center text-sm font-medium text-black">{emptyMessage}</p>
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const barW = Math.min(48, plotW / items.length - 8);

  return (
    <div className="analytics-chart-card overflow-x-auto">
      <h3 className="analytics-chart-title">{title}</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[20rem] w-full" role="img" aria-label={title}>
        <line x1={PAD.left} y1={HEIGHT - PAD.bottom} x2={WIDTH - PAD.right} y2={HEIGHT - PAD.bottom} stroke="var(--border)" strokeWidth={2} />
        {items.map((item, i) => {
          const h = (item.value / max) * plotH;
          const x = PAD.left + i * (plotW / items.length) + (plotW / items.length - barW) / 2;
          const y = HEIGHT - PAD.bottom - h;
          const color = item.color ?? "#1a2744";
          return (
            <g key={item.label}>
              <rect x={x} y={y} width={barW} height={h} rx={6} fill={color}>
                <title>{`${item.label}: ${item.value}${valueSuffix}`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={HEIGHT - PAD.bottom + 16}
                textAnchor="middle"
                className="analytics-axis-label"
              >
                {item.label.length > 6 ? `${item.label.slice(0, 5)}…` : item.label}
              </text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="analytics-axis-label">
                {item.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type LineProps = {
  title: string;
  points: LinePoint[];
  yLabel?: string;
  valueSuffix?: string;
  emptyMessage?: string;
};

export function AnalyticsLineChart({
  title,
  points,
  yLabel = "",
  valueSuffix = "",
  emptyMessage = "データがありません",
}: LineProps) {
  if (points.length === 0) {
    return (
      <div className="analytics-chart-card">
        <h3 className="analytics-chart-title">{title}</h3>
        <p className="py-8 text-center text-sm font-medium text-black">{emptyMessage}</p>
      </div>
    );
  }

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const maxY = Math.max(...points.map((p) => p.value), 1);
  const minY = Math.min(...points.map((p) => p.value), 0);

  const xAt = (i: number) =>
    points.length <= 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW;
  const yAt = (v: number) => {
    const range = maxY - minY || 1;
    return PAD.top + plotH - ((v - minY) / range) * plotH;
  };

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.value)}`).join(" ");

  return (
    <div className="analytics-chart-card overflow-x-auto">
      <h3 className="analytics-chart-title">{title}{yLabel ? `（${yLabel}）` : ""}</h3>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[20rem] w-full" role="img" aria-label={title}>
        <line x1={PAD.left} y1={HEIGHT - PAD.bottom} x2={WIDTH - PAD.right} y2={HEIGHT - PAD.bottom} stroke="var(--border)" strokeWidth={2} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={HEIGHT - PAD.bottom} stroke="var(--border)" strokeWidth={2} />
        <path d={pathD} fill="none" stroke="#1a2744" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={xAt(i)} cy={yAt(p.value)} r={5} fill="#1a2744" stroke="#fff" strokeWidth={2}>
              <title>{`${formatChartDate(p.date)}: ${p.value}${valueSuffix}`}</title>
            </circle>
            {(points.length <= 8 || i % Math.ceil(points.length / 8) === 0 || i === points.length - 1) && (
              <text x={xAt(i)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" className="analytics-axis-label">
                {formatChartDate(p.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AnalyticsKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="analytics-kpi">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--navy)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-black">{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-black">{sub}</p>}
    </div>
  );
}

export function AnalyticsInsight({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border-2 border-[var(--moon-yellow)] bg-[var(--moon-yellow)]/20 p-4">
      <p className="text-sm font-bold text-[var(--navy)]">{title}</p>
      <p className="mt-2 text-sm font-medium text-black">{body}</p>
    </div>
  );
}
