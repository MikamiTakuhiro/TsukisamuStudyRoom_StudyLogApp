import type { CalendarTargetPlan, CalendarWeek, StudentFullProfile } from "@/lib/api";
import { formatTimeJa } from "@/lib/utils";

const APP_TIMEZONE = "Asia/Tokyo";

function dateKeyInAppTz(iso: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

function todayInAppTz(): string {
  return dateKeyInAppTz(new Date());
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function weekStartSunday(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - date.getDay());
  return formatDateKey(date);
}

export function buildCalendarWeeksFromProfile(profile: StudentFullProfile, weeks = 26): CalendarWeek[] {
  const dayAtt = new Map<string, StudentFullProfile["attendances"]>();
  const dayStudy = new Map<string, StudentFullProfile["study_records"]>();

  for (const attendance of profile.attendances) {
    const date = dateKeyInAppTz(attendance.check_in_time);
    const list = dayAtt.get(date) ?? [];
    list.push(attendance);
    dayAtt.set(date, list);
  }

  for (const record of profile.study_records) {
    const date = dateKeyInAppTz(record.recorded_at);
    const list = dayStudy.get(date) ?? [];
    list.push(record);
    dayStudy.set(date, list);
  }

  const targetByDate = new Map<string, CalendarTargetPlan[]>();
  for (const plan of profile.study_plans) {
    const completed = plan.progress.some((entry) => entry.completion_date != null);
    if (completed) continue;
    const date = plan.target_completion_date.slice(0, 10);
    const list = targetByDate.get(date) ?? [];
    list.push({ plan_id: plan.plan_id, subject: plan.subject, unit: plan.unit });
    targetByDate.set(date, list);
  }

  const today = todayInAppTz();
  const currentWeekStart = weekStartSunday(today);
  const calendarWeeks: CalendarWeek[] = [];

  for (let weekOffset = 0; weekOffset < weeks; weekOffset += 1) {
    const weekStart = addDays(currentWeekStart, -7 * weekOffset);
    const days = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = addDays(weekStart, dayOffset);
      const attendances = dayAtt.get(date) ?? [];
      const studyRecords = dayStudy.get(date) ?? [];
      const hasAttendance = attendances.length > 0;
      const hasHome = studyRecords.some((record) => record.study_location === "home");

      let color = "white";
      if (hasAttendance && hasHome) color = "stripe";
      else if (hasAttendance) color = "yellow";
      else if (hasHome) color = "navy";

      const summaryLines: string[] = [];
      for (const attendance of attendances) {
        const checkIn = formatTimeJa(attendance.check_in_time);
        const checkOut = attendance.check_out_time ? formatTimeJa(attendance.check_out_time) : "未退室";
        const schoolRecords = studyRecords.filter((record) => record.study_location !== "home");
        let detail = `塾 ${checkIn}-${checkOut} (${attendance.seat_name ?? "?"})`;
        if (schoolRecords.length > 0) {
          const subjects = schoolRecords.map((record) => `${record.subject} ${record.topic_unit}`).join("、");
          detail += ` (${subjects})`;
        }
        summaryLines.push(detail);
      }

      for (const record of studyRecords) {
        if (record.study_location === "home") {
          const time = formatTimeJa(record.recorded_at);
          summaryLines.push(`家 ${time} (${record.subject} ${record.topic_unit})`);
        }
      }

      days.push({
        date,
        color,
        summary_lines: summaryLines,
        target_plans: targetByDate.get(date) ?? [],
        is_today: date === today,
      });
    }

    calendarWeeks.push({ week_start: weekStart, days });
  }

  return calendarWeeks.reverse();
}
