"use client";

import { useUIStore } from "@/stores/uiStore";

interface LeftPanelProps {
  children: React.ReactNode;
}

export function LeftPanel({ children }: LeftPanelProps) {
  const { leftPanelOpen } = useUIStore();

  return (
    <aside
      className={`shrink-0 overflow-hidden motion-safe:transition-[width,border-color] motion-safe:duration-150 motion-safe:ease-out ${leftPanelOpen ? "border-r border-border" : "border-r border-transparent"}`}
      style={{ width: leftPanelOpen ? 240 : 0 }}
    >
      {leftPanelOpen ? (
        <div className="w-60 h-full overflow-y-auto scrollbar-thin">
          {children}
        </div>
      ) : null}
    </aside>
  );
}
