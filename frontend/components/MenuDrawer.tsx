"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearSession } from "@/lib/auth";

const LINKS = [
  { href: "/dashboard", label: "ホーム" },
  { href: "/aspirations", label: "志望校" },
  { href: "/study-plans", label: "学習計画" },
  { href: "/exams", label: "模試結果" },
  { href: "/profile", label: "プロフィール" },
];

export default function MenuDrawer({
  open,
  onClose,
  isReadOnly,
}: {
  open: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
}) {
  const router = useRouter();

  if (!open) return null;

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clearSession();
    onClose();
    router.push("/login");
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" className="flex-1 bg-black/40" onClick={onClose} aria-label="閉じる" />
      <aside className="flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <div className="surface-navy border-b-2 border-[var(--navy-light)] bg-[var(--navy)] px-4 py-5">
          <p className="text-lg font-bold">月寒学習室</p>
          <p className="surface-navy-muted text-sm font-medium">メニュー</p>
          {isReadOnly && (
            <p className="mt-1 text-xs font-bold text-[var(--moon-yellow)]">保護者モード（閲覧専用）</p>
          )}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block rounded-xl px-4 py-3 font-bold text-black hover:bg-[var(--moon-yellow)]/40"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <button type="button" onClick={logout} className="btn-secondary w-full">
            ログアウト
          </button>
        </div>
      </aside>
    </div>
  );
}
