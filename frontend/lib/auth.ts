import type { User } from "./api";

const DEVICE_KEY = "device_id";
const USER_KEY = "auth_user";
const TOKEN_KEY = "auth_token";

let memoryToken: string | null = null;
let memoryUser: User | null = null;
let memoryDeviceId: string | null = null;

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    /* Safari プライベートモード等 */
  }
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = safeGet(localStorage, DEVICE_KEY) || memoryDeviceId;
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    safeSet(localStorage, DEVICE_KEY, id);
    memoryDeviceId = id;
  }
  return id;
}

export function saveSession(
  token: string,
  user: User,
  sessionType: "persistent" | "temporary",
) {
  memoryToken = token;
  memoryUser = user;
  if (sessionType === "persistent") {
    safeSet(localStorage, TOKEN_KEY, token);
    safeSet(localStorage, USER_KEY, JSON.stringify(user));
    safeRemove(sessionStorage, TOKEN_KEY);
    safeRemove(sessionStorage, USER_KEY);
  } else {
    safeSet(sessionStorage, TOKEN_KEY, token);
    safeSet(sessionStorage, USER_KEY, JSON.stringify(user));
    safeRemove(localStorage, TOKEN_KEY);
    safeRemove(localStorage, USER_KEY);
  }
}

export function clearSession() {
  memoryToken = null;
  memoryUser = null;
  safeRemove(localStorage, TOKEN_KEY);
  safeRemove(localStorage, USER_KEY);
  safeRemove(sessionStorage, TOKEN_KEY);
  safeRemove(sessionStorage, USER_KEY);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return memoryToken;
  return (
    memoryToken ||
    safeGet(localStorage, TOKEN_KEY) ||
    safeGet(sessionStorage, TOKEN_KEY)
  );
}

export function getCachedUser(): User | null {
  if (memoryUser) return memoryUser;
  if (typeof window === "undefined") return null;
  const raw = safeGet(localStorage, USER_KEY) || safeGet(sessionStorage, USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function hasToken(): boolean {
  return !!getAuthToken();
}

export function vibrate(pattern: number | number[] = 100) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
