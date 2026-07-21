"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import AdminMenuDrawer from "@/components/AdminMenuDrawer";

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-full w-full max-w-full bg-[var(--surface)]">
      <AppHeader
        title={title}
        role="admin"
        showMenu
        onMenuClick={() => setMenuOpen(true)}
      />
      <AdminMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      {children}
    </div>
  );
}
