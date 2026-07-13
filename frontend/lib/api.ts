export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** スマホLANアクセス時はフロントと同じホスト名でAPIへ接続 */
export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  return API_BASE;
}

export type User = {
  student_id: number;
  user_id: string;
  name: string;
  grade: number;
  gender: string;
  role: "student" | "admin" | "parent";
  is_read_only: boolean;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  school_name?: string | null;
};

export type LoginResponse = {
  token: string;
  expires_at: string;
  session_type: string;
  user: User;
};

export type ActiveSeatStatus = {
  seat_id: number;
  seat_name: string;
  student_name: string | null;
  user_id: string | null;
  check_in_time: string | null;
};

export type NotificationItem = {
  notification_id: number;
  notification_type: string;
  content: string;
  is_read: boolean;
  sent_at: string;
  trigger_gap_detected: boolean;
};

export type TimelineDay = {
  date: string;
  attendances: {
    attendance_id: number;
    seat_name: string | null;
    check_in_time: string;
    check_out_time: string | null;
    is_forgotten_checkout: boolean;
  }[];
  study_records: {
    record_id: number;
    subject: string;
    topic_unit: string;
    study_location?: string;
    recorded_at: string;
  }[];
};

export type CalendarTargetPlan = {
  plan_id: number;
  subject: string;
  unit: string;
};

export type CalendarDay = {
  date: string;
  color: string;
  summary_lines: string[];
  target_plans: CalendarTargetPlan[];
  is_today: boolean;
};

export type CalendarWeek = {
  week_start: string;
  days: CalendarDay[];
};

export type Aspiration = {
  aspiration_id: number;
  student_id: number;
  date_recorded: string;
  target_school: string;
  priority_rank: number;
};

export type Progress = {
  progress_id: number;
  plan_id: number;
  completion_date: string | null;
  achievement_level: string | null;
};

export type StudyPlan = {
  plan_id: number;
  student_id: number;
  subject: string;
  unit: string;
  target_completion_date: string;
  progress: Progress[];
};

export type ExamResult = {
  exam_result_id: number;
  student_id: number;
  exam_name: string;
  exam_date: string;
  subject_scores: Record<string, number>;
  total_score: number;
  school_judgment: string | null;
};

export type StudentFullProfile = {
  student: User;
  aspirations: Aspiration[];
  study_plans: StudyPlan[];
  exam_results: ExamResult[];
  attendances: {
    attendance_id: number;
    seat_name: string | null;
    check_in_time: string;
    check_out_time: string | null;
    is_forgotten_checkout: boolean;
  }[];
  study_records: { record_id: number; subject: string; topic_unit: string; recorded_at: string }[];
  notifications: NotificationItem[];
};

export type AccountExport = {
  name: string;
  user_id: string;
  parent_user_id: string | null;
  new_password: string;
};

import { getAuthToken } from "./auth";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  } catch {
    throw new Error("サーバーに接続できません。APIのURLとWi-Fi接続を確認してください。");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : "API error");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const authApi = {
  login: (body: {
    user_id: string;
    password: string;
    device_id: string;
    session_type: "persistent" | "temporary";
  }) => apiFetch<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiFetch<User>("/api/auth/me"),
  logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
};

export const attendanceApi = {
  active: () => apiFetch<{ attendance_id: number; seat_name: string | null } | null>("/api/attendance/active"),
  scan: (qr_code_data: string) =>
    apiFetch<{ mode: string; seat: { seat_name: string; qr_code_data: string }; student_name: string }>(
      "/api/attendance/scan",
      { method: "POST", body: JSON.stringify({ qr_code_data }) },
    ),
  checkIn: (qr_code_data: string) =>
    apiFetch("/api/attendance/check-in", { method: "POST", body: JSON.stringify({ qr_code_data }) }),
  checkOut: () => apiFetch("/api/attendance/check-out", { method: "POST" }),
  timeline: () => apiFetch<TimelineDay[]>("/api/attendance/timeline"),
  calendar: (weeks = 26) => apiFetch<CalendarWeek[]>(`/api/attendance/calendar?weeks=${weeks}`),
  createStudyRecord: (subject: string, topic_unit: string) =>
    apiFetch("/api/attendance/study-records", {
      method: "POST",
      body: JSON.stringify({ subject, topic_unit }),
    }),
  live: () => apiFetch<ActiveSeatStatus[]>("/api/attendance/live"),
  updateAttendance: (id: number, data: Record<string, unknown>) =>
    apiFetch(`/api/attendance/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export const academicApi = {
  aspirations: (studentId?: number) =>
    apiFetch<Aspiration[]>(`/api/academic/aspirations${studentId ? `?student_id=${studentId}` : ""}`),
  createAspiration: (data: { target_school: string; priority_rank: number }, studentId?: number) =>
    apiFetch<Aspiration>(
      `/api/academic/aspirations${studentId ? `?student_id=${studentId}` : ""}`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  createAspirationsBulk: (schools: string[]) =>
    apiFetch<Aspiration[]>("/api/academic/aspirations/bulk", {
      method: "POST",
      body: JSON.stringify({ schools }),
    }),
  updateAspiration: (id: number, data: Partial<Aspiration>) =>
    apiFetch<Aspiration>(`/api/academic/aspirations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAspiration: (id: number) =>
    apiFetch(`/api/academic/aspirations/${id}`, { method: "DELETE" }),

  studyPlans: (studentId?: number) =>
    apiFetch<StudyPlan[]>(`/api/academic/study-plans${studentId ? `?student_id=${studentId}` : ""}`),
  createStudyPlan: (data: { subject: string; unit: string; target_completion_date: string }, studentId?: number) =>
    apiFetch<StudyPlan>(
      `/api/academic/study-plans${studentId ? `?student_id=${studentId}` : ""}`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  updateStudyPlan: (id: number, data: Partial<StudyPlan>) =>
    apiFetch<StudyPlan>(`/api/academic/study-plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStudyPlan: (id: number) =>
    apiFetch(`/api/academic/study-plans/${id}`, { method: "DELETE" }),

  createProgress: (data: {
    plan_id: number;
    completion_date?: string;
    achievement_level?: string;
    target_completion_date?: string;
  }) =>
    apiFetch<Progress>("/api/academic/progress", { method: "POST", body: JSON.stringify(data) }),
  updateProgress: (id: number, data: Partial<Progress>) =>
    apiFetch<Progress>(`/api/academic/progress/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  exams: (studentId?: number) =>
    apiFetch<ExamResult[]>(`/api/academic/exams${studentId ? `?student_id=${studentId}` : ""}`),
  createExam: (data: Partial<ExamResult>, studentId?: number) =>
    apiFetch<ExamResult>(
      `/api/academic/exams${studentId ? `?student_id=${studentId}` : ""}`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  updateExam: (id: number, data: Partial<ExamResult>) =>
    apiFetch<ExamResult>(`/api/academic/exams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteExam: (id: number) =>
    apiFetch(`/api/academic/exams/${id}`, { method: "DELETE" }),
};

export const adminApi = {
  students: () => apiFetch<User[]>("/api/admin/students"),
  studentFull: (id: number) => apiFetch<StudentFullProfile>(`/api/admin/students/${id}/full`),
  updateStudent: (
    id: number,
    data: {
      name?: string;
      grade?: number;
      gender?: string;
      phone?: string | null;
      email?: string | null;
      birth_date?: string | null;
      school_name?: string | null;
    },
  ) => apiFetch<User>(`/api/admin/students/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  exportAccount: (id: number) =>
    apiFetch<AccountExport>(`/api/admin/students/${id}/account-export`, { method: "POST" }),
  createStudent: (data: { last_name: string; first_name: string; grade: number; gender: string }) =>
    apiFetch<{ student: User; parent_user_id: string; initial_password: string }>(
      "/api/admin/students",
      { method: "POST", body: JSON.stringify(data) },
    ),
  updateSeat: (id: number, data: { seat_name?: string; qr_code_data?: string }) =>
    apiFetch(`/api/admin/seats/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSeat: (id: number) => apiFetch(`/api/admin/seats/${id}`, { method: "DELETE" }),
  seats: () => apiFetch<{ seat_id: number; seat_name: string; qr_code_data: string }[]>("/api/admin/seats"),
  createSeat: (seat_name: string) =>
    apiFetch("/api/admin/seats", { method: "POST", body: JSON.stringify({ seat_name }) }),
  notifications: () => apiFetch<NotificationItem[]>("/api/admin/notifications"),
  seedDemo: () =>
    apiFetch<{ user_id: string; initial_password: string; message: string }>("/api/admin/seed/demo", {
      method: "POST",
    }),
  runForgottenCheckout: () =>
    apiFetch<{ processed: number }>("/api/admin/cron/forgotten-checkout", { method: "POST" }),
  runGapDetection: () =>
    apiFetch<{ notifications_created: number }>("/api/admin/cron/detect-gaps", { method: "POST" }),
};

export const profileApi = {
  me: () => apiFetch<User>("/api/profile/me"),
  view: () => apiFetch<User>("/api/profile/view"),
  update: (data: { phone?: string; email?: string; birth_date?: string; school_name?: string }) =>
    apiFetch<User>("/api/profile/me", { method: "PATCH", body: JSON.stringify(data) }),
  full: (studentId: number) => apiFetch<StudentFullProfile>(`/api/admin/students/${studentId}/full`),
};

export const notificationsApi = {
  list: () => apiFetch<NotificationItem[]>("/api/notifications"),
  get: (id: number) => apiFetch<NotificationItem>(`/api/notifications/${id}`),
  update: (id: number, data: { content?: string }) =>
    apiFetch<NotificationItem>(`/api/notifications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<{ ok: boolean }>(`/api/notifications/${id}`, { method: "DELETE" }),
};

export const STUDY_OPTIONS: Record<string, string[]> = {
  数学: ["方程式", "関数", "図形", "確率", "その他"],
  英語: ["文法", "長文", "単語", "リスニング", "その他"],
  国語: ["現代文", "古文", "漢文", "作文", "その他"],
  理科: ["物理", "化学", "生物", "地学", "その他"],
  社会: ["地理", "歴史", "公民", "その他"],
  その他: ["自主学習", "予習", "復習"],
};

export const SUBJECTS = ["数学", "英語", "国語", "理科", "社会", "その他"];
export const EXAM_SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
export const ACHIEVEMENT_LEVELS = ["未着手", "少し", "半分", "ほぼ完了", "完了"];
