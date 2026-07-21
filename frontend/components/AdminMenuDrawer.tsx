"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearSession } from "@/lib/auth";

const LINKS = [
  { href: "/admin/analytics", label: "分析ダッシュボード" },
  { href: "/admin/analytics/students", label: "生徒別分析" },
  { href: "/admin/analytics/attendance", label: "出席・座席分析" },
  { href: "/admin/analytics/study", label: "学習記録分析" },
  { href: "/admin/analytics/exams", label: "模試結果分析" },
  { href: "/admin", label: "運用・管理" },
  { href: "/admin/reservations", label: "予約管理" },
  { href: "/admin/profile", label: "プロフィール" },
];

export default function AdminMenuDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
    <div className="menu-drawer-overlay">
      <button type="button" className="menu-drawer-backdrop" onClick={onClose} aria-label="閉じる" />
      <aside className="menu-drawer-panel flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <div className="surface-navy border-b-2 border-[var(--navy-light)] bg-[var(--navy)] px-4 py-5">
          <p className="text-lg font-bold">月寒学習室</p>
          <p className="surface-navy-muted text-sm font-medium">管理者メニュー</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={onClose} className="menu-nav-link">
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
