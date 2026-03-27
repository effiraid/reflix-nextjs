"use client";

import { useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { MasonryGrid } from "@/components/clip/MasonryGrid";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { useFilterStore } from "@/stores/filterStore";
import { useClipStore } from "@/stores/clipStore";
import { useUIStore } from "@/stores/uiStore";
import { useBrowseData } from "./ClipDataProvider";
import { filterClips, shuffleClips } from "@/lib/filter";
import { getColumnCountFromThumbnailSize } from "@/lib/thumbnailSize";
import { useShallow } from "zustand/react/shallow";
import type { BrowseClipRecord, CategoryTree, Locale } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

const QuickViewModal = dynamic(
  () =>
    import("@/components/clip/QuickViewModal").then((m) => m.QuickViewModal),
  { ssr: false }
);

function scrollToClip(clipId: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-clip-id="${clipId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

interface BrowseClientProps {
  categories: CategoryTree;
  tagI18n?: Record<string, string>;
  lang: Locale;
  dict: Dictionary;
}

export function BrowseClient({
  categories,
  tagI18n = {},
  lang,
  dict,
}: BrowseClientProps) {
  const {
    initialClips,
    projectionClips,
    projectionStatus,
    initialTotalCount,
  } = useBrowseData();
  const { selectedClipId, setSelectedClipId } = useClipStore();
  const filters = useFilterStore(
    useShallow((s) => ({
      selectedFolders: s.selectedFolders,
      selectedTags: s.selectedTags,
      excludedTags: s.excludedTags,
      starFilter: s.starFilter,
      searchQuery: s.searchQuery,
      sortBy: s.sortBy,
      category: s.category,
      contentMode: s.contentMode,
    }))
  );
  const { quickViewOpen, setQuickViewOpen, stepThumbnailSize, shuffleSeed, thumbnailSize } = useUIStore(
    useShallow((s) => ({
      quickViewOpen: s.quickViewOpen,
      setQuickViewOpen: s.setQuickViewOpen,
      stepThumbnailSize: s.stepThumbnailSize,
      shuffleSeed: s.shuffleSeed,
      thumbnailSize: s.thumbnailSize,
    }))
  );
  const columnCount = getColumnCountFromThumbnailSize(thumbnailSize);

  // Sync URL → Zustand filters
  useFilterSync();

  // Tab → jump to SearchBar; block all other Tab focus cycling
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="navbar-search"] input'
      );
      if (input && document.activeElement !== input) {
        input.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const hasActiveBrowseFilters =
    filters.category !== null ||
    filters.contentMode !== null ||
    filters.selectedFolders.length > 0 ||
    filters.selectedTags.length > 0 ||
    filters.excludedTags.length > 0 ||
    filters.starFilter !== null ||
    filters.searchQuery.length > 0 ||
    filters.sortBy !== "newest";
  const initialDisplayClips = useMemo(() => {
    if (!projectionClips || projectionStatus !== "ready" || columnCount > 3) {
      return initialClips;
    }

    const projectionById = new Map(
      projectionClips.map((clip) => [clip.id, clip] as const)
    );

    return initialClips.map((clip) => projectionById.get(clip.id) ?? clip);
  }, [columnCount, initialClips, projectionClips, projectionStatus]);

  // Apply filters only after projection preload is ready.
  const filtered = useMemo(
    () => {
      if (!projectionClips || projectionStatus !== "ready" || !hasActiveBrowseFilters) {
        return shuffleSeed === 0
          ? initialDisplayClips
          : shuffleClips(initialDisplayClips);
      }

      const visibleClips = filterClips(projectionClips, filters, categories, tagI18n, lang);
      return shuffleSeed === 0 ? visibleClips : shuffleClips(visibleClips);
    },
    [
      initialDisplayClips,
      projectionClips,
      projectionStatus,
      hasActiveBrowseFilters,
      filters,
      categories,
      tagI18n,
      shuffleSeed,
      lang,
    ]
  );
  const indexMap = useMemo(
    () => new Map(filtered.map((c, i) => [c.id, i])),
    [filtered]
  );
  const selectedIndex = selectedClipId ? (indexMap.get(selectedClipId) ?? -1) : -1;
  const selectedClip: BrowseClipRecord | null =
    selectedIndex >= 0 ? filtered[selectedIndex] : null;
  const visibleResultCount =
    projectionClips && projectionStatus === "ready" && hasActiveBrowseFilters
      ? filtered.length
      : initialTotalCount;
  const resultCountLabel =
    lang === "ko" ? `${visibleResultCount}개 클립` : `${visibleResultCount} clips`;
  const emptyStateLabel = filters.searchQuery
    ? lang === "ko"
      ? `'${filters.searchQuery}'에 대한 결과가 없습니다`
      : `No results for "${filters.searchQuery}"`
    : dict.browse.noResults;

  const navigateGrid = useCallback(
    (direction: "up" | "down" | "left" | "right" | "home" | "end" | "top" | "bottom") => {
      if (filtered.length === 0) return;

      if (selectedIndex < 0) {
        setSelectedClipId(filtered[0].id);
        scrollToClip(filtered[0].id);
        return;
      }

      let nextIndex: number;
      switch (direction) {
        case "up":
          nextIndex = selectedIndex - columnCount;
          if (nextIndex < 0) return;
          break;
        case "down":
          nextIndex = selectedIndex + columnCount;
          if (nextIndex >= filtered.length) return;
          break;
        case "left":
          if (selectedIndex % columnCount === 0) return;
          nextIndex = selectedIndex - 1;
          break;
        case "right":
          if ((selectedIndex + 1) % columnCount === 0) return;
          nextIndex = selectedIndex + 1;
          if (nextIndex >= filtered.length) return;
          break;
        case "home":
          nextIndex = Math.floor(selectedIndex / columnCount) * columnCount;
          break;
        case "end":
          nextIndex = Math.min(
            Math.floor(selectedIndex / columnCount) * columnCount + columnCount - 1,
            filtered.length - 1
          );
          break;
        case "top":
          nextIndex = 0;
          break;
        case "bottom":
          nextIndex = filtered.length - 1;
          break;
      }

      if (nextIndex === selectedIndex) return;
      setSelectedClipId(filtered[nextIndex].id);
      scrollToClip(filtered[nextIndex].id);
    },
    [filtered, selectedIndex, columnCount, setSelectedClipId]
  );

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        key: "Escape",
        action: () => setSelectedClipId(null),
        enabled: !quickViewOpen && selectedIndex >= 0,
      },
      {
        key: "Enter",
        action: () => setQuickViewOpen(true),
        enabled: !!selectedClip && !quickViewOpen,
      },
      {
        key: " ",
        action: () => setQuickViewOpen(true),
        enabled: !!selectedClip && !quickViewOpen,
      },
      // Cmd/Ctrl + Arrow: jump to top/bottom
      {
        key: "ArrowUp",
        action: () => navigateGrid("top"),
        enabled: !quickViewOpen,
        requireModifier: "ctrl",
      },
      {
        key: "ArrowDown",
        action: () => navigateGrid("bottom"),
        enabled: !quickViewOpen,
        requireModifier: "ctrl",
      },
      // Plain arrows: grid navigation
      {
        key: "ArrowUp",
        action: () => navigateGrid("up"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      {
        key: "ArrowDown",
        action: () => navigateGrid("down"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      {
        key: "ArrowLeft",
        action: () => navigateGrid("left"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      {
        key: "ArrowRight",
        action: () => navigateGrid("right"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      // Home/End: first/last in row
      {
        key: "Home",
        action: () => navigateGrid("home"),
        enabled: !quickViewOpen,
      },
      {
        key: "End",
        action: () => navigateGrid("end"),
        enabled: !quickViewOpen,
      },
      {
        key: "-",
        action: () => stepThumbnailSize(-1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
      {
        key: "+",
        action: () => stepThumbnailSize(1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
      {
        key: "=",
        action: () => stepThumbnailSize(1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
    ],
    [quickViewOpen, selectedClip, selectedIndex, setSelectedClipId, setQuickViewOpen, stepThumbnailSize, navigateGrid]
  );
  useKeyboardShortcuts(shortcuts);

  const handleCloseQuickView = useCallback(
    () => setQuickViewOpen(false),
    [setQuickViewOpen]
  );

  const openQuickViewForClip = useCallback(
    (clipId: string) => {
      setSelectedClipId(clipId);
      setQuickViewOpen(true);
    },
    [setSelectedClipId, setQuickViewOpen]
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted">
        {emptyStateLabel}
      </div>
    );
  }

  return (
    <>
      {filters.searchQuery ? (
        <div className="border-b border-border px-4 py-2">
          <p className="text-xs text-muted" aria-live="polite">
            {resultCountLabel}
          </p>
        </div>
      ) : null}
      <MasonryGrid
        clips={filtered}
        lang={lang}
        tagI18n={tagI18n}
        onOpenQuickView={openQuickViewForClip}
      />
      {quickViewOpen && selectedClip ? (
        <QuickViewModal
          clip={selectedClip}
          lang={lang}
          tagI18n={tagI18n}
          dict={dict}
          onClose={handleCloseQuickView}
        />
      ) : null}
    </>
  );
}
