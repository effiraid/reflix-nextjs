"use client";

import { useUIStore } from "@/stores/uiStore";

interface RightPanelProps {
  children: React.ReactNode;
}

export function RightPanel({ children }: RightPanelProps) {
  const { rightPanelOpen, browseMode } = useUIStore();
  const isVisible = rightPanelOpen && (browseMode === "grid" || browseMode === "history");

  return (
    <aside
      className={`shrink-0 overflow-hidden motion-safe:transition-[width,border-color] motion-safe:duration-200 motion-safe:ease-out ${isVisible ? "border-l border-border" : "border-l border-transparent"}`}
      style={{ width: isVisible ? 320 : 0 }}
    >
      {isVisible ? (
        <div className="w-80 h-full overflow-y-auto scrollbar-none">
          {children}
        </div>
      ) : null}
    </aside>
  );
}
