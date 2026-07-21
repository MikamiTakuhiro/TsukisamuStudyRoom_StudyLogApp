"use client";

import Link from "next/link";

export default function AppHeader({
  title,
  showMenu = false,
  onMenuClick,
  isReadOnly = false,
  role,
}: {
  title: string;
  showMenu?: boolean;
  onMenuClick?: () => void;
  isReadOnly?: boolean;
  role?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--navy)] bg-white px-4 py-3">
      <div className="app-shell flex w-full items-center justify-between px-4">
        <div>
          <p className="text-xs font-bold text-[var(--navy)]">月寒学習室</p>
          <h1 className="text-lg font-bold text-black">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {role === "admin" && !showMenu && (
            <>
              <Link href="/admin/profile" className="btn-secondary px-3 py-2 text-sm">
                プロフィール
              </Link>
              <Link href="/admin" className="btn-secondary px-3 py-2 text-sm">
                管理
              </Link>
            </>
          )}
          {showMenu && (
            <button
              type="button"
              onClick={onMenuClick}
              className="btn-icon flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--navy)] bg-[var(--moon-yellow)] text-xl font-bold text-black"
              aria-label="メニュー"
            >
              ☰
            </button>
          )}
        </div>
      </div>
      {isReadOnly && (
        <p className="app-shell mt-1 w-full px-4 text-center text-xs font-bold text-[var(--navy)]">
          保護者モード（閲覧専用）
        </p>
      )}
    </header>
  );
}
