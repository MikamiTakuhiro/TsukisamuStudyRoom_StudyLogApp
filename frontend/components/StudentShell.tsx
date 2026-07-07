"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import MenuDrawer from "@/components/MenuDrawer";
import type { User } from "@/lib/api";

export default function StudentShell({
  title,
  user,
  children,
}: {
  title: string;
  user: User;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <AppHeader
        title={title}
        showMenu
        onMenuClick={() => setMenuOpen(true)}
        isReadOnly={user.is_read_only}
        role={user.role}
      />
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} isReadOnly={user.is_read_only} />
      {children}
    </>
  );
}
