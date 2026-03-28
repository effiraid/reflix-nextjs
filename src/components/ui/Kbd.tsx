export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs font-mono">
      {children}
    </kbd>
  );
}
