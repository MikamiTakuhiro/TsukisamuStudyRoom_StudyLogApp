"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearSession } from "@/lib/auth";

export default function AppHeader({
  title,
  showLogout = true,
}: {
  title: string;
  showLogout?: boolean;
}) {
  const router = useRouter();

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clearSession();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div>
        <p className="text-xs text-slate-500">月寒スタディルーム</p>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {showLogout && (
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ログアウト
          </button>
        )}
      </div>
    </header>
  );
}

export function AdminLink({ role }: { role?: string }) {
  if (role !== "admin") return null;
  return (
    <Link
      href="/admin"
      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
    >
      管理画面
    </Link>
  );
}
