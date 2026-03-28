"use client";

import { useMemo, useRef, useEffect, useLayoutEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ClipCard } from "./ClipCard";
import { useUIStore } from "@/stores/uiStore";
import { getColumnCountFromThumbnailSize, THUMBNAIL_ASPECT_RATIO } from "@/lib/thumbnailSize";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface MasonryGridProps {
  clips: BrowseClipRecord[];
  lang?: Locale;
  tagI18n?: Record<string, string>;
  lockedClipIds?: Set<string>;
  onOpenQuickView?: (clipId: string) => void;
}

export function MasonryGrid({
  clips,
  lang = "ko",
  tagI18n = {},
  lockedClipIds = new Set<string>(),
  onOpenQuickView,
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWidthRef = useRef<number | null>(null);
  const thumbnailSize = useUIStore((s) => s.thumbnailSize);
  const quickViewOpen = useUIStore((s) => s.quickViewOpen);
  const columnCount = getColumnCountFromThumbnailSize(thumbnailSize);
  const previewOnHover = columnCount >= 4; // 4-5열: hover 시 MP4 preview, 1-3열: 즉시 재생
  const showInfo = columnCount <= 3;
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current.closest(
        "[data-masonry-scroll]"
      ) as HTMLElement | null;
      setScrollElement(el);
    }
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(
        entries[0]?.contentRect.width ?? container.getBoundingClientRect().width
      );

      if (nextWidth <= 0) {
        return;
      }

      if (lastWidthRef.current !== null && lastWidthRef.current !== nextWidth) {
        setLayoutVersion((version) => version + 1);
      }

      lastWidthRef.current = nextWidth;
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Distribute clips into columns by shortest-column-first
  const columns = useMemo(() => {
    const cols: BrowseClipRecord[][] = Array.from({ length: columnCount }, () => []);
    const heights = new Array(columnCount).fill(0);

    for (const clip of clips) {
      const shortestCol = heights.indexOf(Math.min(...heights));
      cols[shortestCol].push(clip);
      heights[shortestCol] += 1 / THUMBNAIL_ASPECT_RATIO;
    }
    return cols;
  }, [clips, columnCount]);

  return (
    <div ref={containerRef} className="flex gap-3 p-3">
      {columns.map((colClips, colIndex) => (
        <MasonryColumn
          key={`${columnCount}-${layoutVersion}-${colIndex}`}
          clips={colClips}
          scrollElement={scrollElement}
          enablePreview={!quickViewOpen}
          previewOnHover={previewOnHover}
          showInfo={showInfo}
          lockedClipIds={lockedClipIds}
          lang={lang}
          tagI18n={tagI18n}
          onOpenQuickView={onOpenQuickView}
        />
      ))}
    </div>
  );
}

function MasonryColumn({
  clips,
  scrollElement,
  enablePreview,
  previewOnHover,
  showInfo,
  lockedClipIds,
  lang,
  tagI18n,
  onOpenQuickView,
}: {
  clips: BrowseClipRecord[];
  scrollElement: HTMLElement | null;
  enablePreview: boolean;
  previewOnHover: boolean;
  showInfo: boolean;
  lockedClipIds: Set<string>;
  lang: Locale;
  tagI18n: Record<string, string>;
  onOpenQuickView?: (clipId: string) => void;
}) {
  // TanStack Virtual intentionally returns imperative helpers.
  // In React 19 + Next dev, direct getVirtualItems() reads can be compiler-hoisted
  // and stay stuck at the initial empty range. Always read through a mutable ref.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: clips.length,
    getItemKey: (index) => clips[index]?.id ?? index,
    getScrollElement: () => scrollElement,
    estimateSize: () => Math.round(200 / THUMBNAIL_ASPECT_RATIO) + 12,
    overscan: 5,
    measureElement: (el) => {
      // Measure actual rendered height including padding
      return el.getBoundingClientRect().height;
    },
  });
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;
  const totalSize = virtualizerRef.current.getTotalSize();
  const virtualItems = virtualizerRef.current.getVirtualItems();

  return (
    <div className="flex-1 min-w-0">
      <div
        style={{ height: totalSize, position: "relative" }}
      >
        {virtualItems.map((virtualItem) => {
          const clip = clips[virtualItem.index];
          return (
            <div
              key={clip.id}
              ref={virtualizerRef.current.measureElement}
              data-index={virtualItem.index}
              data-clip-id={clip.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="pb-3"
            >
              <ClipCard
                clip={clip}
                lang={lang}
                tagI18n={tagI18n}
                enablePreview={enablePreview}
                previewOnHover={previewOnHover}
                showInfo={showInfo}
                prioritizeThumbnail={virtualItem.index === 0}
                locked={lockedClipIds.has(clip.id)}
                onOpenQuickView={onOpenQuickView}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
