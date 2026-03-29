"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  onUndo?: () => void;
}

let toastIdCounter = 0;

let showToastGlobal: ((message: string, onUndo?: () => void) => void) | null = null;

/** Show a toast from anywhere. Must be called after ToastContainer is mounted. */
export function showToast(message: string, onUndo?: () => void) {
  showToastGlobal?.(message, onUndo);
}

const TOAST_DURATION = 2000;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((message: string, onUndo?: () => void) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, onUndo }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, TOAST_DURATION);
    timers.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    showToastGlobal = addToast;
    return () => {
      showToastGlobal = null;
    };
  }, [addToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-lg motion-safe:animate-[slideUp_150ms_ease-out]"
        >
          <span>{toast.message}</span>
          {toast.onUndo ? (
            <button
              type="button"
              onClick={() => {
                toast.onUndo?.();
                dismiss(toast.id);
              }}
              className="shrink-0 text-xs font-medium text-accent hover:underline"
            >
              되돌리기
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="shrink-0 rounded p-0.5 text-muted hover:text-foreground"
            aria-label="닫기"
          >
            <XIcon className="size-3" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
