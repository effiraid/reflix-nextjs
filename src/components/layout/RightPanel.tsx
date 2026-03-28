"use client";

import { useUIStore } from "@/stores/uiStore";

interface RightPanelProps {
  children: React.ReactNode;
}

export function RightPanel({ children }: RightPanelProps) {
  const { rightPanelOpen } = useUIStore();

  return (
    <aside
      className={`shrink-0 overflow-hidden motion-safe:transition-[width,border-color] motion-safe:duration-150 motion-safe:ease-out ${rightPanelOpen ? "border-l border-border" : "border-l border-transparent"}`}
      style={{ width: rightPanelOpen ? 320 : 0 }}
    >
      {rightPanelOpen ? (
        <div className="w-80 h-full overflow-y-auto scrollbar-none">
          {children}
        </div>
      ) : null}
    </aside>
  );
}
