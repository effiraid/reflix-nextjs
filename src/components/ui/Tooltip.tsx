interface TooltipProps {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
}

export function Tooltip({ label, children, side = "bottom" }: TooltipProps) {
  const positionClass =
    side === "top"
      ? "bottom-full mb-1.5"
      : "top-full mt-1.5";

  return (
    <div className="group/tooltip relative inline-flex">
      {children}
      <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${positionClass} opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-100 rounded-md bg-background px-2 py-1 text-xs text-foreground whitespace-nowrap z-50 border border-border shadow-sm`}>
        {label}
      </div>
    </div>
  );
}
