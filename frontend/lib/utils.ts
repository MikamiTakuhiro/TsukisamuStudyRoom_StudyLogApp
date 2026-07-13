const APP_TIMEZONE = "Asia/Tokyo";

export function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "情報なし";
  return String(value);
}

export function formatDateJa(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: APP_TIMEZONE,
  });
}

export function formatTimeJa(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

export function formatDateTimeJa(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

/** datetime-local 入力用の日本時間文字列 (YYYY-MM-DDTHH:mm) */
export function toDatetimeLocalJst(iso: string): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return formatted.replace(" ", "T");
}

/** datetime-local の値を日本時間として ISO 文字列に変換 */
export function datetimeLocalJstToIso(value: string): string {
  if (!value) return "";
  return `${value}:00+09:00`;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildAccountInfoText(data: {
  name: string;
  user_id: string;
  parent_user_id?: string;
  password: string;
}) {
  const lines = [
    "━━━━━━━━━━━━━━━━━━━━━━━━",
    "  月寒スタディルーム アカウント情報",
    "━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `氏名　　　：${data.name}`,
    `生徒ID　　：${data.user_id}`,
    ...(data.parent_user_id ? [`保護者ID　：${data.parent_user_id}`] : []),
    `パスワード：${data.password}`,
    "",
    "※ この用紙は大切に保管してください。",
    "━━━━━━━━━━━━━━━━━━━━━━━━",
  ];
  return lines.join("\n");
}
