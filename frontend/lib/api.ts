export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type User = {
  student_id: number;
  user_id: string;
  name: string;
  grade: number;
  gender: string;
  role: "student" | "admin" | "parent";
  is_read_only: boolean;
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
    recorded_at: string;
  }[];
};

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
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
    apiFetch<{ mode: string; seat: { seat_name: string }; student_name: string }>(
      "/api/attendance/scan",
      { method: "POST", body: JSON.stringify({ qr_code_data }) },
    ),
  checkIn: (qr_code_data: string) =>
    apiFetch("/api/attendance/check-in", { method: "POST", body: JSON.stringify({ qr_code_data }) }),
  checkOut: () => apiFetch("/api/attendance/check-out", { method: "POST" }),
  timeline: () => apiFetch<TimelineDay[]>("/api/attendance/timeline"),
  createStudyRecord: (subject: string, topic_unit: string) =>
    apiFetch("/api/attendance/study-records", {
      method: "POST",
      body: JSON.stringify({ subject, topic_unit }),
    }),
  live: () => apiFetch<ActiveSeatStatus[]>("/api/attendance/live"),
};

export const adminApi = {
  students: () => apiFetch<User[]>("/api/admin/students"),
  createStudent: (data: { name: string; grade: number; gender: string }) =>
    apiFetch<{ student: User; parent_user_id: string; initial_password: string }>(
      "/api/admin/students",
      { method: "POST", body: JSON.stringify(data) },
    ),
  seats: () => apiFetch<{ seat_id: number; seat_name: string; qr_code_data: string }[]>("/api/admin/seats"),
  createSeat: (seat_name: string) =>
    apiFetch("/api/admin/seats", { method: "POST", body: JSON.stringify({ seat_name }) }),
  notifications: () => apiFetch<NotificationItem[]>("/api/admin/notifications"),
  seedDemo: () => apiFetch<{ user_id: string; initial_password: string; message: string }>(
    "/api/admin/seed/demo",
    { method: "POST" },
  ),
  runForgottenCheckout: () =>
    apiFetch<{ processed: number }>("/api/admin/cron/forgotten-checkout", { method: "POST" }),
  runGapDetection: () =>
    apiFetch<{ notifications_created: number }>("/api/admin/cron/detect-gaps", { method: "POST" }),
};

export const notificationsApi = {
  list: () => apiFetch<NotificationItem[]>("/api/notifications"),
};

export const STUDY_OPTIONS: Record<string, string[]> = {
  数学: ["方程式", "関数", "図形", "確率", "その他"],
  英語: ["文法", "長文", "単語", "リスニング", "その他"],
  国語: ["現代文", "古文", "漢文", "作文", "その他"],
  理科: ["物理", "化学", "生物", "地学", "その他"],
  社会: ["地理", "歴史", "公民", "その他"],
  その他: ["自主学習", "予習", "復習"],
};
