import { useEffect } from "react";

export interface Shortcut {
  key: string;
  action: () => void;
  enabled?: boolean;
  allowRepeat?: boolean;
  allowInInput?: boolean;
  requireModifier?: "ctrl" | "shift" | "alt";
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    el?.tagName === "INPUT" ||
    el?.tagName === "TEXTAREA" ||
    el?.tagName === "SELECT" ||
    !!el?.isContentEditable
  );
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        if (event.key !== shortcut.key) continue;
        if (!shortcut.allowRepeat && event.repeat) continue;
        if (!shortcut.allowInInput && isTypingTarget(event.target)) continue;

        if (shortcut.requireModifier) {
          const mod = shortcut.requireModifier;
          if (mod === "ctrl" && !event.ctrlKey && !event.metaKey) continue;
          if (mod === "shift" && !event.shiftKey) continue;
          if (mod === "alt" && !event.altKey) continue;
        }

        event.preventDefault();
        shortcut.action();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
