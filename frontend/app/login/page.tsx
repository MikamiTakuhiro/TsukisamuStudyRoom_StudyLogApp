"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { getDeviceId, saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [sessionType, setSessionType] = useState<"persistent" | "temporary">("persistent");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      if (res.user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-sky-50 to-white">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">月寒スタディルーム</h1>
          <p className="mt-2 text-sm text-slate-600">入退塾管理・学習記録</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ユーザーID</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="例: 126001 または 126001-p"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              required
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">ログイン種別</legend>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="sessionType"
                checked={sessionType === "persistent"}
                onChange={() => setSessionType("persistent")}
              />
              <span>
                <span className="block text-sm font-medium">個人スマホ（自動ログイン）</span>
                <span className="text-xs text-slate-500">次回からID入力不要</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="sessionType"
                checked={sessionType === "temporary"}
                onChange={() => setSessionType("temporary")}
              />
              <span>
                <span className="block text-sm font-medium">塾の共有PC</span>
                <span className="text-xs text-slate-500">ブラウザを閉じるとログアウト</span>
              </span>
            </label>
          </fieldset>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-600 py-3 text-base font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          保護者の方は生徒IDの末尾に -p を付けてログイン（例: 126001-p）
        </p>
      </main>
    </div>
  );
}
