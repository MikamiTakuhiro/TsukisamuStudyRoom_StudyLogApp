"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { getDeviceId, saveSession } from "@/lib/auth";
import { Input, Label } from "@/components/ui/Input";

export default function LoginPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [sessionType, setSessionType] = useState<"persistent" | "temporary">("persistent");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login({
        user_id: userId.trim(),
        password,
        device_id: getDeviceId(),
        session_type: sessionType,
      });
      saveSession(res.token, res.user, sessionType);
      const dest = res.user.role === "admin" ? "/admin" : "/dashboard";
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-white">
      <main className="app-shell flex w-full flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="surface-navy mb-8 rounded-3xl bg-[var(--navy)] px-6 py-8 text-center">
          <h1 className="text-2xl font-bold">月寒学習室</h1>
          <p className="surface-navy-muted mt-2 text-sm font-medium">入退塾管理・学習記録</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
          <div>
            <Label>ユーザーID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="例: 126001 または 126001-p"
              autoComplete="username"
              inputMode="text"
              required
            />
          </div>
          <div>
            <Label>パスワード</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              autoComplete="current-password"
              required
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-bold text-black">ログイン種別</legend>
            <label className="selectable-card flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-[var(--border)] p-4">
              <input
                type="radio"
                name="sessionType"
                checked={sessionType === "persistent"}
                onChange={() => setSessionType("persistent")}
              />
              <span>
                <span className="block font-bold text-black">個人スマホ（自動ログイン）</span>
                <span className="text-sm text-black">次回からID入力不要</span>
              </span>
            </label>
            <label className="selectable-card flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-[var(--border)] p-4">
              <input
                type="radio"
                name="sessionType"
                checked={sessionType === "temporary"}
                onChange={() => setSessionType("temporary")}
              />
              <span>
                <span className="block font-bold text-black">塾の共有PC</span>
                <span className="text-sm text-black">ブラウザを閉じるとログアウト</span>
              </span>
            </label>
          </fieldset>

          {error && (
            <p className="rounded-xl border-2 border-red-400 bg-red-50 px-3 py-2 text-sm font-medium text-black">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full touch-manipulation">
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-black">
          保護者の方は生徒IDの末尾に -p を付けてログイン（例: 126001-p）
        </p>
      </main>
    </div>
  );
}
