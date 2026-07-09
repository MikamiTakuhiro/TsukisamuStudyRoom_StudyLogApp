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
  });
}

export function formatTimeJa(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
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
  });
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
