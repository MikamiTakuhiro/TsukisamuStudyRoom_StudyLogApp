"use client";

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
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

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-bold text-black">
      {typeof children === "string" ? <Ft>{children}</Ft> : children}
    </label>
  );
}

export function EmptyState({ message = "情報なし" }: { message?: string }) {
  return (
    <p className="py-4 text-center font-medium text-black">
      <Ft>{message}</Ft>
    </p>
  );
}
