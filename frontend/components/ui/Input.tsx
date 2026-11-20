"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Ft } from "@/components/FuriganaText";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`app-input ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`app-select ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`app-textarea ${className}`} {...props} />;
}

/** 必須・任意の表示を全画面で統一するためのバッジ */
function RequirementBadge({ required }: { required: boolean }) {
  return required ? (
    <span className="field-badge field-badge--required"><Ft>必須</Ft></span>
  ) : (
    <span className="field-badge field-badge--optional"><Ft>任意</Ft></span>
  );
}

export function Label({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  /** true=必須 / false=任意 / 未指定=表示しない */
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 flex items-center gap-2 text-sm font-bold text-black">
      <span>{typeof children === "string" ? <Ft>{children}</Ft> : children}</span>
      {required !== undefined && <RequirementBadge required={required} />}
    </label>
  );
}

/**
 * ラベル・入力欄・補足を 1 セットで描画する。
 * 子要素に id を自動で付与し、ラベルのタップで入力欄にフォーカスできるようにする。
 */
export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}) {
  const autoId = useId();
  const id = (isValidElement(children) && children.props.id) || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs font-medium text-[var(--placeholder)]">
          <Ft>{hint}</Ft>
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-bold text-red-700">
          <Ft>{error}</Ft>
        </p>
      )}
    </div>
  );
}

export function EmptyState({ message = "情報なし" }: { message?: string }) {
  return (
    <p className="py-4 text-center font-medium text-black">
      <Ft>{message}</Ft>
    </p>
  );
}

export function Spinner({ size = 28 }: { size?: number }) {
  return <span className="app-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

/** 一覧などの取得中表示（「情報なし」と区別するため） */
export function LoadingState({ message = "読み込み中..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6 text-sm font-bold text-[var(--navy)]" role="status">
      <Spinner size={22} />
      <Ft>{message}</Ft>
    </div>
  );
}

/** 一覧の取得中に表示するスケルトン */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="読み込み中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16 rounded-xl" />
      ))}
    </div>
  );
}

/** 画面全体の初期読み込み表示 */
export function PageLoading() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 py-24" role="status">
      <Spinner size={40} />
      <p className="text-sm font-bold text-[var(--navy)]"><Ft>読み込み中...</Ft></p>
    </div>
  );
}

/** 送信中は自動で無効化・文言切替するボタン */
export function SubmitButton({
  busy,
  disabled,
  busyLabel = "送信中...",
  children,
  className = "btn-primary w-full",
  type = "submit",
  onClick,
}: {
  busy: boolean;
  disabled?: boolean;
  busyLabel?: string;
  children: ReactNode;
  className?: string;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className={`${className} touch-manipulation disabled:opacity-50`}
    >
      {busy ? (
        <>
          <Spinner size={18} />
          <Ft>{busyLabel}</Ft>
        </>
      ) : typeof children === "string" ? (
        <Ft>{children}</Ft>
      ) : (
        children
      )}
    </button>
  );
}
