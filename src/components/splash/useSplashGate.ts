import { useCallback, useState } from "react";

const STORAGE_KEY = "reflix-visited";

function hasVisited(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private browsing or storage unavailable — treat as first visit
    return false;
  }
}

function markVisited(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Silently ignore storage errors
  }
}

export function useSplashGate(mode: "intro" | "auth"): {
  shouldShow: boolean;
  markComplete: () => void;
} {
  const [shouldShow] = useState(() => {
    if (mode === "auth") return true;
    return !hasVisited();
  });

  const markComplete = useCallback(() => {
    if (mode === "intro") {
      markVisited();
    }
  }, [mode]);

  return { shouldShow, markComplete };
}
