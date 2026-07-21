import type { Aspiration } from "@/lib/api";

/**
 * 同日に複数回登録がある場合、aspiration_id が大きい方（後から登録された方）を採用する。
 * 登録時刻は DB に保存されていないため、ID の昇順を登録順の代用とする。
 */
export function dedupeLatestPerDate(items: Aspiration[]): Aspiration[] {
  const byDate = new Map<string, Map<number, Aspiration>>();
  for (const item of items) {
    let ranks = byDate.get(item.date_recorded);
    if (!ranks) {
      ranks = new Map();
      byDate.set(item.date_recorded, ranks);
    }
    const existing = ranks.get(item.priority_rank);
    if (!existing || item.aspiration_id > existing.aspiration_id) {
      ranks.set(item.priority_rank, item);
    }
  }
  return [...byDate.values()].flatMap((ranks) => [...ranks.values()]);
}

export function sortAspirations(items: Aspiration[]): Aspiration[] {
  return [...items].sort((a, b) => {
    const dateCmp = b.date_recorded.localeCompare(a.date_recorded);
    if (dateCmp !== 0) return dateCmp;
    const rankCmp = a.priority_rank - b.priority_rank;
    if (rankCmp !== 0) return rankCmp;
    return b.aspiration_id - a.aspiration_id;
  });
}

export function groupAspirationsByDate(
  items: Aspiration[],
): { date: string; entries: Aspiration[] }[] {
  const groups: { date: string; entries: Aspiration[] }[] = [];
  for (const item of sortAspirations(items)) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date_recorded) {
      last.entries.push(item);
    } else {
      groups.push({ date: item.date_recorded, entries: [item] });
    }
  }
  return groups;
}

export function uniqueChartDates(items: Aspiration[]): string[] {
  return [...new Set(items.map((i) => i.date_recorded))].sort();
}

export function uniqueSchools(items: Aspiration[]): string[] {
  return [...new Set(items.map((i) => i.target_school))];
}

export const SCHOOL_LINE_COLORS = [
  "#1a2744",
  "#2a3f6b",
  "#dc2626",
  "#059669",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#be185d",
];
