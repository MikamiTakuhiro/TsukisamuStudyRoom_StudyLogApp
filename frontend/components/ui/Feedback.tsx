"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Ft } from "@/components/FuriganaText";
import { ReadingProvider } from "@/context/ReadingContext";
import { getCachedUser } from "@/lib/auth";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

type FeedbackContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_MS = 3200;

/** API エラーなどを利用者向けメッセージに変換 */
export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [grade, setGrade] = useState(7);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setGrade(getCachedUser()?.grade ?? 7);
    setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, kind === "error" ? TOAST_MS + 1800 : TOAST_MS);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setGrade(getCachedUser()?.grade ?? 7);
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  function closeConfirm(ok: boolean) {
    confirmState?.resolve(ok);
    setConfirmState(null);
  }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ReadingProvider grade={grade}>
        <div className="toast-stack" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={`toast toast--${t.kind}`}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <span className="toast-icon" aria-hidden="true">
                {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
              </span>
              <span className="min-w-0 flex-1"><Ft>{t.message}</Ft></span>
            </div>
          ))}
        </div>

        {confirmState && (
          <div
            className="modal-overlay items-end sm:items-center sm:justify-center"
            style={{ zIndex: 70 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeConfirm(false);
            }}
          >
            <div
              className="modal-panel w-full rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
            >
              <h3 id="confirm-dialog-title" className="text-lg font-bold text-black">
                <Ft>{confirmState.title}</Ft>
              </h3>
              {confirmState.message && (
                <p className="mt-2 text-sm font-medium text-black">
                  <Ft>{confirmState.message}</Ft>
                </p>
              )}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" className="btn-secondary flex-1" onClick={() => closeConfirm(false)} autoFocus>
                  <Ft>{confirmState.cancelLabel ?? "やめる"}</Ft>
                </button>
                <button
                  type="button"
                  className={`flex-1 ${confirmState.danger ? "btn-danger" : "btn-primary"}`}
                  onClick={() => closeConfirm(true)}
                >
                  <Ft>{confirmState.confirmLabel ?? "OK"}</Ft>
                </button>
              </div>
            </div>
          </div>
        )}
      </ReadingProvider>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback は FeedbackProvider の内側で使用してください");
  return ctx;
}
