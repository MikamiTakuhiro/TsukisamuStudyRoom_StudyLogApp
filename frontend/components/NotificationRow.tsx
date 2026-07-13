"use client";

import { useEffect, useRef } from "react";
import type { NotificationItem } from "@/lib/api";

type Props = {
  notification: NotificationItem;
  menuOpen: boolean;
  isReadOnly: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onDetail: () => void;
  onUpdatePlan?: () => void;
  onDelete: () => void;
};

export default function NotificationRow({
  notification,
  menuOpen,
  isReadOnly,
  onMenuToggle,
  onMenuClose,
  onDetail,
  onUpdatePlan,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as HTMLElement;
      if (menuRef.current?.contains(target)) return;
      onMenuClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpen, onMenuClose]);

  return (
    <div
      className={`relative mb-2 flex items-start gap-2 rounded-xl border-2 p-2.5 last:mb-0 ${
        menuOpen ? "z-10" : ""
      } ${
        notification.trigger_gap_detected
          ? "border-[var(--navy)] bg-[var(--moon-yellow)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <p className="min-w-0 flex-1 text-sm font-medium text-black">{notification.content}</p>
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          aria-label="通知メニュー"
          aria-expanded={menuOpen}
          className="notification-menu-trigger"
          onClick={onMenuToggle}
        >
          ···
        </button>
        {menuOpen && (
          <div className="notification-menu" role="menu">
            <button type="button" role="menuitem" className="notification-menu-item" onClick={onDetail}>
              詳細
            </button>
            {onUpdatePlan && (
              <button type="button" role="menuitem" className="notification-menu-item" onClick={onUpdatePlan}>
                学習計画の更新
              </button>
            )}
            {!isReadOnly && (
              <button
                type="button"
                role="menuitem"
                className="notification-menu-item notification-menu-item-danger"
                onClick={onDelete}
              >
                削除
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function notificationTypeLabel(type: string): string {
  if (type === "plan_gap") return "学習計画リマインド";
  return type;
}

/** plan_gap 通知の本文から科目・単元を抽出 */
export function parsePlanGapNotification(content: string): { subject: string; unit: string } | null {
  const match = content.match(/「(.+?)\s+(.+?)」の目標期限/);
  if (!match) return null;
  return { subject: match[1], unit: match[2] };
}

export function studyPlanFocusUrl(content: string): string {
  const parsed = parsePlanGapNotification(content);
  if (!parsed) return "/study-plans";
  const params = new URLSearchParams({
    subject: parsed.subject,
    unit: parsed.unit,
  });
  return `/study-plans?${params.toString()}`;
}
