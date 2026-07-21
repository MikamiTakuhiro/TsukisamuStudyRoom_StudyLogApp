import type { StudentFullProfile } from "@/lib/api";
import { dedupeLatestPerDate } from "@/lib/aspirations";

export type DailyCount = { date: string; count: number };
export type LabeledValue = { label: string; value: number; color?: string };

const CHART_COLORS = ["#1a2744", "#2a3f6b", "#059669", "#7c3aed", "#ea580c", "#0891b2", "#dc2626", "#be185d"];

export function chartColor(i: number) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

export function dailyStudyRecordCounts(profile: StudentFullProfile): DailyCount[] {
  const map = new Map<string, number>();
  for (const r of profile.study_records) {
    const d = dateKey(r.recorded_at);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function dailyStudyMinutes(profile: StudentFullProfile): DailyCount[] {
  const map = new Map<string, number>();
  for (const a of profile.attendances) {
    if (!a.check_out_time) continue;
    const start = new Date(a.check_in_time).getTime();
    const end = new Date(a.check_out_time).getTime();
    const mins = Math.max(0, Math.round((end - start) / 60000));
    const d = dateKey(a.check_in_time);
    map.set(d, (map.get(d) ?? 0) + mins);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function seatUsage(profile: StudentFullProfile): LabeledValue[] {
  const map = new Map<string, number>();
  for (const a of profile.attendances) {
    const seat = a.seat_name ?? "不明";
    map.set(seat, (map.get(seat) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value], i) => ({ label, value, color: chartColor(i) }));
}

export function seatStudyMinutes(profile: StudentFullProfile): LabeledValue[] {
  const map = new Map<string, number>();
  for (const a of profile.attendances) {
    if (!a.check_out_time) continue;
    const seat = a.seat_name ?? "不明";
    const mins = Math.max(
      0,
      Math.round((new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 60000),
    );
    map.set(seat, (map.get(seat) ?? 0) + mins);
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value], i) => ({ label, value, color: chartColor(i) }));
}

export function subjectStudyCounts(profile: StudentFullProfile): LabeledValue[] {
  const map = new Map<string, number>();
  for (const r of profile.study_records) {
    map.set(r.subject, (map.get(r.subject) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value], i) => ({ label, value, color: chartColor(i) }));
}

export function locationStudyCounts(profile: StudentFullProfile): LabeledValue[] {
  const map = new Map<string, number>();
  for (const r of profile.study_records) {
    const loc = r.study_location === "home" ? "自宅" : "塾";
    map.set(loc, (map.get(loc) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, value], i) => ({ label, value, color: chartColor(i) }));
}

export function examScoreTrend(profile: StudentFullProfile): DailyCount[] {
  return [...profile.exam_results]
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
    .map((e) => ({ date: e.exam_date, count: e.total_score }));
}

export function studyPlanCompletionRate(profile: StudentFullProfile): number {
  if (profile.study_plans.length === 0) return 0;
  const done = profile.study_plans.filter((p) =>
    p.progress.some((pr) => pr.achievement_level === "完了" || pr.completion_date),
  ).length;
  return Math.round((done / profile.study_plans.length) * 100);
}

/** 塾滞在1時間あたりの学習記録数（簡易効率指標） */
export function studyEfficiencyIndex(profile: StudentFullProfile): number {
  const schoolRecords = profile.study_records.filter((r) => r.study_location !== "home").length;
  const totalMins = profile.attendances.reduce((sum, a) => {
    if (!a.check_out_time) return sum;
    return sum + Math.max(0, (new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 60000);
  }, 0);
  if (totalMins < 30) return 0;
  return Math.round((schoolRecords / (totalMins / 60)) * 10) / 10;
}

export function topSeatInsight(profile: StudentFullProfile): string {
  const seats = seatStudyMinutes(profile);
  if (seats.length === 0) return "座席データがまだありません。";
  const top = seats[0];
  const efficiency = studyEfficiencyIndex(profile);
  return `${top.label} での滞在が最も長く（合計 ${top.value} 分）、塾での学習効率指数は ${efficiency} 件/時間です。`;
}

export function aspirationInsight(profile: StudentFullProfile): string {
  const items = dedupeLatestPerDate(profile.aspirations);
  if (items.length === 0) return "志望校の登録がまだありません。";
  const first = items.find((a) => a.priority_rank === 1);
  if (!first) return "第一志望の記録がありません。";
  return `現在の第一志望は「${first.target_school}」（${first.date_recorded} 記録）です。`;
}

export function aggregateDailyStudy(profiles: StudentFullProfile[]): DailyCount[] {
  const map = new Map<string, number>();
  for (const p of profiles) {
    for (const { date, count } of dailyStudyRecordCounts(p)) {
      map.set(date, (map.get(date) ?? 0) + count);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, count]) => ({ date, count }));
}

export function aggregateSeatUsage(profiles: StudentFullProfile[]): LabeledValue[] {
  const map = new Map<string, number>();
  for (const p of profiles) {
    for (const { label, value } of seatUsage(p)) {
      map.set(label, (map.get(label) ?? 0) + value);
    }
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([label, value], i) => ({ label, value, color: chartColor(i) }));
}

export function formatChartDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });
}

export function formatMinutes(m: number) {
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}時間${r}分` : `${h}時間`;
}

export function weeklyAverageMinutes(profile: StudentFullProfile): number {
  const map = new Map<string, number>();
  for (const a of profile.attendances) {
    if (!a.check_out_time) continue;
    const d = new Date(a.check_in_time);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    const key = weekStart.toISOString().slice(0, 10);
    const mins = Math.max(
      0,
      Math.round((new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 60000),
    );
    map.set(key, (map.get(key) ?? 0) + mins);
  }
  if (map.size === 0) return 0;
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return Math.round(total / map.size);
}

export function monthlyAverageMinutes(profile: StudentFullProfile): number {
  const map = new Map<string, number>();
  for (const a of profile.attendances) {
    if (!a.check_out_time) continue;
    const key = a.check_in_time.slice(0, 7);
    const mins = Math.max(
      0,
      Math.round((new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 60000),
    );
    map.set(key, (map.get(key) ?? 0) + mins);
  }
  if (map.size === 0) return 0;
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return Math.round(total / map.size);
}

export function monthlyVisitCounts(profile: StudentFullProfile): DailyCount[] {
  const map = new Map<string, number>();
  for (const a of profile.attendances) {
    const key = a.check_in_time.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: `${date}-01`, count }));
}
