"use client";

import { LockIcon } from "lucide-react";

interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className = "" }: ProBadgeProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-label="Pro 전용 클립"
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-background/50 transition-opacity group-hover:bg-background/20" />
      {/* Lock icon */}
      <div className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md bg-background/70 backdrop-blur-sm">
        <LockIcon className="size-3.5 text-foreground/70" strokeWidth={2} />
      </div>
    </div>
  );
}
