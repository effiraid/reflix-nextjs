"use client";

import { useUIStore } from "@/stores/uiStore";

interface RightPanelProps {
  children: React.ReactNode;
}

export function RightPanel({ children }: RightPanelProps) {
  const { rightPanelOpen } = useUIStore();

  if (!rightPanelOpen) return null;

  return (
    <aside className="w-80 shrink-0 border-l border-border overflow-y-auto scrollbar-thin motion-safe:animate-[slideInRight_200ms_ease-out]">
      {children}
    </aside>
  );
}
