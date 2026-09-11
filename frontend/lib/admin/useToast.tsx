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

export type ToastTone = "info" | "success" | "error";

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastValue = {
  toast: Toast | null;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastValue | null>(null);

/** How long a toast stays up. Errors linger, since they are worth reading twice. */
const DURATIONS: Record<ToastTone, number> = {
  info: 2400,
  success: 2400,
  error: 5000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    if (timer.current) clearTimeout(timer.current);

    // NOTE: a new id every time even for the same text, so two identical messages in a row
    // re-run the entry animation instead of looking like one that never left.
    setToast({ id: nextId.current++, message, tone });
    timer.current = setTimeout(() => setToast(null), DURATIONS[tone]);
  }, []);

  const value = useMemo<ToastValue>(
    () => ({ toast, showToast, dismissToast }),
    [toast, showToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside a ToastProvider.");
  return value;
}
