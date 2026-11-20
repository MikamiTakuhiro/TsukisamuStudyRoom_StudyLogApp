"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import MenuNavIcon, { type MenuNavIconName } from "@/components/MenuNavIcon";
import MenuDrawer from "@/components/MenuDrawer";
import { Ft } from "@/components/FuriganaText";
import { ReadingProvider } from "@/context/ReadingContext";
import type { User } from "@/lib/api";

const BOTTOM_NAV_ITEMS: {
  href: string;
  label: string;
  icon: MenuNavIconName;
}[] = [
  { href: "/reservations", label: "来塾予約", icon: "reservations" },
  { href: "/dashboard", label: "ホーム", icon: "home" },
  { href: "/profile", label: "プロフィール", icon: "profile" },
];

export default function StudentShell({
  title,
  user,
  children,
  fillViewport = false,
  activeSeat,
  hideBottomNav = false,
}: {
  title: string;
  user: User;
  children: React.ReactNode;
  fillViewport?: boolean;
  activeSeat?: string | null;
  /** 確認画面など、誤タップで離脱させたくない場面ではボトムナビを隠す */
  hideBottomNav?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const header = (
    <AppHeader
      title={title}
      showMenu
      onMenuClick={() => setMenuOpen(true)}
      isReadOnly={user.is_read_only}
      role={user.role}
      activeSeat={activeSeat}
    />
  );

  const drawer = (
    <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} isReadOnly={user.is_read_only} />
  );

  const bottomNav = hideBottomNav ? null : (
    <>
      <div className="student-bottom-nav-spacer" aria-hidden="true" />
      <nav className="student-bottom-nav" aria-label="メインナビゲーション">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`student-bottom-nav-link${item.href === "/dashboard" ? " student-bottom-nav-link--home" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <MenuNavIcon name={item.icon} />
              <span><Ft>{item.label}</Ft></span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  if (fillViewport) {
    return (
      <ReadingProvider grade={user.grade}>
        <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden">
          {header}
          {drawer}
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
          {bottomNav}
        </div>
      </ReadingProvider>
    );
  }

  return (
    <ReadingProvider grade={user.grade}>
      {header}
      {drawer}
      {children}
      {bottomNav}
    </ReadingProvider>
  );
}
