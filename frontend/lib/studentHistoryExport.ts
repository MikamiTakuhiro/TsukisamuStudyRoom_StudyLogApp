import type { StudentFullProfile } from "@/lib/api";

const APP_TIMEZONE = "Asia/Tokyo";

export type StudentHistoryRow =
  | {
      kind: "attendance";
      time: number;
      attendance: StudentFullProfile["attendances"][number];
    }
  | {
      kind: "study";
      time: number;
      record: StudentFullProfile["study_records"][number];
    };

export type StudentHistoryCsvRow = {
  studentName: string;
  userId: string;
  kind: "来塾" | "学習";
  visitNumber: number | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | null;
  seatName: string;
  subject: string;
  topicUnit: string;
  studyLocation: string;
  autoCheckout: string;
};

function formatDateKey(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatTimeKey(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export function attendanceDurationMinutes(
  checkInTime: string,
  checkOutTime: string | null,
): number | null {
  if (!checkOutTime) return null;
  return Math.max(
    0,
    Math.round((new Date(checkOutTime).getTime() - new Date(checkInTime).getTime()) / 60000),
  );
}

export function buildVisitNumberMap(profile: StudentFullProfile): Map<number, number> {
  return new Map(
    [...profile.attendances]
      .sort((a, b) => new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime())
      .map((attendance, index) => [attendance.attendance_id, index + 1]),
  );
}

export function buildStudentHistoryRows(profile: StudentFullProfile): StudentHistoryRow[] {
  const sortedAttendances = [...profile.attendances].sort(
    (a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime(),
  );
  const jukuStudyRecords = profile.study_records.filter((record) => record.study_location !== "home");

  return [
    ...sortedAttendances.map((attendance) => ({
      kind: "attendance" as const,
      time: new Date(attendance.check_in_time).getTime(),
      attendance,
    })),
    ...jukuStudyRecords.map((record) => ({
      kind: "study" as const,
      time: new Date(record.recorded_at).getTime(),
      record,
    })),
  ].sort((a, b) => b.time - a.time);
}

export function buildStudentHistoryCsvRows(profile: StudentFullProfile): StudentHistoryCsvRow[] {
  const visitNumberById = buildVisitNumberMap(profile);

  return buildStudentHistoryRows(profile)
    .slice()
    .sort((a, b) => a.time - b.time)
    .map((row) => {
      if (row.kind === "attendance") {
        const attendance = row.attendance;
        return {
          studentName: profile.student.name,
          userId: profile.student.user_id,
          kind: "来塾",
          visitNumber: visitNumberById.get(attendance.attendance_id) ?? null,
          date: formatDateKey(attendance.check_in_time),
          startTime: formatTimeKey(attendance.check_in_time),
          endTime: attendance.check_out_time ? formatTimeKey(attendance.check_out_time) : "",
          durationMinutes: attendanceDurationMinutes(attendance.check_in_time, attendance.check_out_time),
          seatName: attendance.seat_name ?? "",
          subject: "",
          topicUnit: "",
          studyLocation: "塾",
          autoCheckout: attendance.is_forgotten_checkout ? "はい" : "いいえ",
        };
      }

      const record = row.record;
      return {
        studentName: profile.student.name,
        userId: profile.student.user_id,
        kind: "学習",
        visitNumber: null,
        date: formatDateKey(record.recorded_at),
        startTime: formatTimeKey(record.recorded_at),
        endTime: "",
        durationMinutes: null,
        seatName: "",
        subject: record.subject,
        topicUnit: record.topic_unit,
        studyLocation: record.study_location === "home" ? "自宅" : "塾",
        autoCheckout: "",
      };
    });
}

function escapeCsvField(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const CSV_HEADERS = [
  "生徒名",
  "ユーザーID",
  "種別",
  "来塾回数",
  "日付",
  "開始時刻",
  "終了時刻",
  "滞在時間_分",
  "座席",
  "科目",
  "単元",
  "学習場所",
  "自動退室",
] as const;

export function buildStudentHistoryCsv(profile: StudentFullProfile): string {
  const rows = buildStudentHistoryCsvRows(profile);
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      [
        row.studentName,
        row.userId,
        row.kind,
        row.visitNumber,
        row.date,
        row.startTime,
        row.endTime,
        row.durationMinutes,
        row.seatName,
        row.subject,
        row.topicUnit,
        row.studyLocation,
        row.autoCheckout,
      ]
        .map(escapeCsvField)
        .join(","),
    ),
  ];
  return lines.join("\r\n");
}

export function downloadStudentHistoryCsv(profile: StudentFullProfile): void {
  const safeName = profile.student.name.replace(/[^\w\u3040-\u30ff\u4e00-\u9faf-]/g, "_");
  const filename = `来塾学習履歴_${safeName}_${profile.student.user_id}.csv`;
  const content = buildStudentHistoryCsv(profile);
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
