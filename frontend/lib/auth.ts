import type { User } from "./api";

const DEVICE_KEY = "device_id";
const USER_KEY = "auth_user";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function saveSession(
  token: string,
  user: User,
  sessionType: "persistent" | "temporary",
) {
  if (sessionType === "persistent") {
    localStorage.setItem("auth_token", token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.removeItem("auth_token");
  } else {
    sessionStorage.setItem("auth_token", token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.removeItem("auth_token");
    localStorage.removeItem(USER_KEY);
  }
}

export function clearSession() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem(USER_KEY);
}

export function getCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function hasToken(): boolean {
  if (typeof window === "undefined") return false;
  return !!(localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token"));
}

export function vibrate(pattern: number | number[] = 100) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
