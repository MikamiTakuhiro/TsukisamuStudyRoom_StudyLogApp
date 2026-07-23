"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import MenuDrawer from "@/components/MenuDrawer";
import { ReadingProvider } from "@/context/ReadingContext";
import type { User } from "@/lib/api";

export default function StudentShell({
  title,
  user,
  children,
  fillViewport = false,
}: {
  title: string;
  user: User;
  children: React.ReactNode;
  fillViewport?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const header = (
    <AppHeader
      title={title}
      showMenu
      onMenuClick={() => setMenuOpen(true)}
      isReadOnly={user.is_read_only}
      role={user.role}
    />
  );

  const drawer = (
    <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} isReadOnly={user.is_read_only} />
  );

  if (fillViewport) {
    return (
      <ReadingProvider grade={user.grade}>
        <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden">
          {header}
          {drawer}
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
      </ReadingProvider>
    );
  }

  return (
    <ReadingProvider grade={user.grade}>
      {header}
      {drawer}
      {children}
    </ReadingProvider>
  );
}
