"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { Kbd } from "@/components/ui/Kbd";

const SLIDE_DURATION = 100;
const STORAGE_KEY = "reflix-keyboard-help-seen";

interface KeyboardHelpOverlayProps {
  dict: Pick<Dictionary, "browse" | "common">;
}

interface ShortcutRow {
  keys: string[];
  label: string;
}

interface ShortcutSection {
  title: string;
  rows: ShortcutRow[];
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? "⌘" : "Ctrl";

function buildSections(dict: Pick<Dictionary, "browse">): ShortcutSection[] {
  const b = dict.browse;
  return [
    {
      title: b.shortcutsNavigation,
      rows: [
        { keys: ["↑", "↓", "←", "→"], label: b.shortcutGridMove },
      ],
    },
    {
      title: b.shortcutsSelection,
      rows: [
        { keys: ["Enter", "Space"], label: b.shortcutQuickView },
      ],
    },
    {
      title: b.shortcutsView,
      rows: [
        { keys: ["+", "−"], label: b.shortcutThumbnailSize },
        { keys: ["["], label: b.shortcutToggleLeftPanel },
        { keys: ["]"], label: b.shortcutToggleRightPanel },
      ],
    },
    {
      title: b.shortcutsHelp,
      rows: [
        { keys: ["?"], label: b.shortcutToggleHelp },
      ],
    },
  ];
}

export function KeyboardHelpOverlay({ dict }: KeyboardHelpOverlayProps) {
  const open = useUIStore((s) => s.keyboardHelpOpen);
  const toggleKeyboardHelp = useUIStore((s) => s.toggleKeyboardHelp);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasAutoShownRef = useRef(false);

  // First-visit auto-show
  useEffect(() => {
    if (hasAutoShownRef.current) return;
    hasAutoShownRef.current = true;

    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        toggleKeyboardHelp();
      }
    } catch {
      // localStorage unavailable
    }
  }, [toggleKeyboardHelp]);

  // X button: instant close, no animation
  const handleCloseImmediate = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable
    }
    toggleKeyboardHelp();
  }, [toggleKeyboardHelp]);

  // ? key: slide-down close with animation
  const handleCloseAnimated = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable
    }
    setTimeout(() => {
      toggleKeyboardHelp();
      setIsClosing(false);
    }, SLIDE_DURATION);
  }, [isClosing, toggleKeyboardHelp]);

  // Overlay handles its own ? key when open
  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        key: "?",
        action: handleCloseAnimated,
        enabled: open && !isClosing,
      },
    ],
    [open, isClosing, handleCloseAnimated]
  );
  useKeyboardShortcuts(shortcuts);

  // Focus management
  useLayoutEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open && !isClosing) return null;

  const sections = buildSections(dict);

  const slideAnimation = isClosing
    ? "motion-safe:animate-[slideDownOut_80ms_ease-in_forwards]"
    : "motion-safe:animate-[slideUpIn_80ms_cubic-bezier(0.16,1,0.3,1)]";

  const allRows = sections.flatMap((s) => s.rows);

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={dict.browse.shortcutsTitle}
      tabIndex={-1}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm px-10 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] will-change-[transform] ${slideAnimation}`}
    >
      <div className="flex items-center justify-center gap-6">
        {allRows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-sm">
            <span className="flex gap-1">
              {row.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
            <span className="whitespace-nowrap text-foreground/60">{row.label}</span>
          </div>
        ))}

        <button
          type="button"
          onClick={handleCloseImmediate}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
          aria-label={dict.common.close}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>
    </section>
  );
}
