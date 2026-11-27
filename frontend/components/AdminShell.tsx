"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import MenuNavIcon, { type MenuNavIconName } from "@/components/MenuNavIcon";
import { authApi } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { normalizePathname } from "@/lib/utils";

const NAV_ITEMS: {
  href: string;
  label: string;
  shortLabel: string;
  icon: MenuNavIconName;
  /** このパス配下でもアクティブ扱いにする */
  match: (path: string) => boolean;
}[] = [
  {
    href: "/admin",
    label: "運営・管理",
    shortLabel: "管理",
    icon: "admin-home",
    match: (p) => p === "/admin" || p.startsWith("/admin/students"),
  },
  {
    href: "/admin/analytics",
    label: "分析ダッシュボード",
    shortLabel: "分析",
    icon: "analytics",
    match: (p) =>
      p.startsWith("/admin/analytics") && !p.startsWith("/admin/analytics/students"),
  },
  {
    href: "/admin/analytics/students",
    label: "生徒別分析",
    shortLabel: "生徒別",
    icon: "students",
    match: (p) => p.startsWith("/admin/analytics/students"),
  },
  {
    href: "/admin/reservations",
    label: "予約管理",
    shortLabel: "予約",
    icon: "reservations",
    match: (p) => p.startsWith("/admin/reservations"),
  },
  {
    href: "/admin/profile",
    label: "プロフィール",
    shortLabel: "設定",
    icon: "profile",
    match: (p) => p.startsWith("/admin/profile"),
  },
];

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = normalizePathname(usePathname());
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
    <div className="min-h-full w-full max-w-full bg-[var(--surface)]">
      {/* PC: 左サイドバー */}
      <aside className="admin-sidebar" aria-label="管理者メニュー">
        <div className="surface-navy admin-sidebar-brand">
          <p className="text-lg font-bold">月寒学習室</p>
          <p className="surface-navy-muted text-sm font-medium">管理者メニュー</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="admin-sidebar-link"
                aria-current={active ? "page" : undefined}
              >
                <MenuNavIcon name={item.icon} size={24} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <button type="button" onClick={logout} className="btn-secondary w-full">
            ログアウト
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="sticky top-0 z-40 border-b-2 border-[var(--navy)] bg-white px-4 py-3">
          <div className="flex w-full items-center justify-between gap-3 px-4 lg:px-2">
            <div>
              <p className="text-xs font-bold text-[var(--navy)] lg:hidden">月寒学習室</p>
              <h1 className="text-lg font-bold text-black lg:text-xl">{title}</h1>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn-secondary px-3 py-2 text-sm lg:hidden"
              aria-label="ログアウト"
            >
              <MenuNavIcon name="logout" size={20} />
              <span>ログアウト</span>
            </button>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>

      {/* スマホ・タブレット: ボトムナビ */}
      <div className="student-bottom-nav-spacer lg:hidden" aria-hidden="true" />
      <nav className="admin-bottom-nav" aria-label="管理者ナビゲーション">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="admin-bottom-nav-link"
              aria-current={active ? "page" : undefined}
            >
              <MenuNavIcon name={item.icon} size={24} />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
