"use client";

import { useUIStore } from "@/stores/uiStore";

interface LeftPanelProps {
  children: React.ReactNode;
}

export function LeftPanel({ children }: LeftPanelProps) {
  const { leftPanelOpen } = useUIStore();

  if (!leftPanelOpen) return null;

  return (
    <aside className="w-60 shrink-0 border-r border-border overflow-y-auto scrollbar-thin motion-safe:animate-[slideInLeft_150ms_ease-out]">
      {children}
    </aside>
  );
}
