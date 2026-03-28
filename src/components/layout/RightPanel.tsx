"use client";

import { useUIStore } from "@/stores/uiStore";

interface RightPanelProps {
  children: React.ReactNode;
}

export function RightPanel({ children }: RightPanelProps) {
  const { rightPanelOpen } = useUIStore();

  return (
    <aside
      className="shrink-0 border-l border-border overflow-hidden motion-safe:transition-[width] motion-safe:duration-150 motion-safe:ease-out"
      style={{ width: rightPanelOpen ? 320 : 0 }}
    >
      <div className="w-80 h-full overflow-y-auto scrollbar-thin">
        {children}
      </div>
    </aside>
  );
}
