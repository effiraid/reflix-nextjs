"use client";

import { useUIStore } from "@/stores/uiStore";

interface LeftPanelProps {
  children: React.ReactNode;
}

export function LeftPanel({ children }: LeftPanelProps) {
  const { leftPanelOpen } = useUIStore();

  return (
    <aside
      className="shrink-0 border-r border-border overflow-hidden motion-safe:transition-[width] motion-safe:duration-150 motion-safe:ease-out"
      style={{ width: leftPanelOpen ? 240 : 0 }}
    >
      <div className="w-60 h-full overflow-y-auto scrollbar-thin">
        {children}
      </div>
    </aside>
  );
}
