"use client";

import { useState, useEffect, useCallback } from "react";

// Column count based on container width (not window width).
// The container is the center grid area after left/right panels are subtracted.
const COLUMN_BREAKPOINTS = {
  // container width thresholds
  wide: 900,   // ≥900px → 4 columns
  medium: 500, // ≥500px → 3 columns
  narrow: 300, // ≥300px → 2 columns
  // <300px → 1 column
} as const;

function getColumnCount(containerWidth: number): number {
  if (containerWidth >= COLUMN_BREAKPOINTS.wide) return 4;
  if (containerWidth >= COLUMN_BREAKPOINTS.medium) return 3;
  if (containerWidth >= COLUMN_BREAKPOINTS.narrow) return 2;
  return 1;
}

/**
 * Responsive column count using ResizeObserver on the container element.
 * Measures actual container width (not window) so it works correctly
 * when side panels eat into the available space.
 */
export function useColumnCount(containerRef: React.RefObject<HTMLElement | null>): number {
  const [columnCount, setColumnCount] = useState<number>(4);

  const updateColumnCount = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      setColumnCount(getColumnCount(el.clientWidth));
    }
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measurement
    updateColumnCount();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateColumnCount();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, updateColumnCount]);

  return columnCount;
}
