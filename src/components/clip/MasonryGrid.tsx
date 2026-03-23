"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ClipCard } from "./ClipCard";
import { useUIStore } from "@/stores/uiStore";
import { getColumnCountFromThumbnailSize } from "@/lib/thumbnailSize";
import type { ClipIndex } from "@/lib/types";

interface MasonryGridProps {
  clips: ClipIndex[];
}

export function MasonryGrid({ clips }: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailSize = useUIStore((s) => s.thumbnailSize);
  const columnCount = getColumnCountFromThumbnailSize(thumbnailSize);
  const usePreview = columnCount <= 3; // 1-3열: MP4 loop, 4-5열: 정적 썸네일
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current.closest(
        "[data-masonry-scroll]"
      ) as HTMLElement | null;
      setScrollElement(el);
    }
  }, []);

  // Distribute clips into columns by shortest-column-first
  const columns = useMemo(() => {
    const cols: ClipIndex[][] = Array.from({ length: columnCount }, () => []);
    const heights = new Array(columnCount).fill(0);

    for (const clip of clips) {
      const shortestCol = heights.indexOf(Math.min(...heights));
      cols[shortestCol].push(clip);
      heights[shortestCol] += clip.height / clip.width;
    }
    return cols;
  }, [clips, columnCount]);

  return (
    <div ref={containerRef} className="flex gap-3 p-3">
      {columns.map((colClips, colIndex) => (
        <MasonryColumn
          key={`${columnCount}-${colIndex}`}
          clips={colClips}
          scrollElement={scrollElement}
          usePreview={usePreview}
        />
      ))}
    </div>
  );
}

function MasonryColumn({
  clips,
  scrollElement,
  usePreview,
}: {
  clips: ClipIndex[];
  scrollElement: HTMLElement | null;
  usePreview: boolean;
}) {
  // TanStack Virtual intentionally returns imperative helpers.
  // React Compiler skips memoization here, which is acceptable for this grid.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: clips.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const clip = clips[index];
      // Rough estimate — measureElement will correct it after render
      return Math.round(200 * (clip.height / clip.width)) + 12;
    },
    overscan: 5,
    measureElement: (el) => {
      // Measure actual rendered height including padding
      return el.getBoundingClientRect().height;
    },
  });

  return (
    <div className="flex-1 min-w-0">
      <div
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const clip = clips[virtualItem.index];
          return (
            <div
              key={clip.id}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="pb-3"
            >
              <ClipCard clip={clip} enablePreview={usePreview} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
