"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_MS = 1000;
const FADE_OUT_MS = 400;
const MAX_TIMEOUT_MS = 5000;

type Phase = "fade-in" | "hold" | "fade-out" | "done";

interface BrandSplashProps {
  onComplete?: () => void;
  /** When true, splash stays visible indefinitely (for Suspense/loading fallbacks). */
  persistent?: boolean;
}

export function BrandSplash({ onComplete, persistent = false }: BrandSplashProps) {
  const [phase, setPhase] = useState<Phase>("fade-in");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startFadeOut = useCallback(() => {
    setPhase((prev) => {
      if (prev === "done" || prev === "fade-out") return prev;
      return "fade-out";
    });
  }, []);

  useEffect(() => {
    // fade-in (300ms) → hold → fade-out
    const holdTimer = setTimeout(() => {
      setPhase("hold");
    }, 300);

    // Persistent mode: stay in "hold" phase indefinitely (no auto-dismiss)
    if (persistent) {
      return () => clearTimeout(holdTimer);
    }

    const fadeOutTimer = setTimeout(() => {
      startFadeOut();
    }, 300 + HOLD_MS);

    const maxTimer = setTimeout(() => {
      startFadeOut();
    }, MAX_TIMEOUT_MS);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(maxTimer);
    };
  }, [startFadeOut, persistent]);

  useEffect(() => {
    if (phase !== "fade-out") return;

    const timer = setTimeout(() => {
      setPhase("done");
      onCompleteRef.current?.();
    }, FADE_OUT_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "done") return null;

  const isFadingOut = phase === "fade-out";
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      style={
        isFadingOut
          ? {
              animation: reducedMotion
                ? "none"
                : `splash-fade-out ${FADE_OUT_MS}ms ease-in forwards`,
            }
          : undefined
      }
    >
      <div
        className="text-3xl font-bold tracking-tight"
        style={
          reducedMotion
            ? undefined
            : {
                animation: "splash-fade-in 300ms ease-out forwards",
              }
        }
      >
        <span className="text-brand">Ref</span>
        <span className="text-foreground">lix</span>
      </div>
      <div
        className="mt-6 h-1 w-1 rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--brand) 40%, transparent)",
          ...(reducedMotion
            ? { opacity: 0.5 }
            : {
                animation:
                  "splash-fade-in 300ms ease-out 200ms forwards, splash-dot-pulse 1.2s ease-in-out 500ms infinite",
                opacity: 0,
              }),
        }}
      />
    </div>
  );
}
