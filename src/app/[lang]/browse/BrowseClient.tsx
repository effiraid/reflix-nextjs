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
import { useClipData } from "./ClipDataProvider";
import { filterClips, shuffleClips } from "@/lib/filter";
import { getColumnCountFromThumbnailSize } from "@/lib/thumbnailSize";
import { useShallow } from "zustand/react/shallow";
import type { CategoryTree, Locale } from "@/lib/types";
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
  const clips = useClipData();
  const { selectedClipId, setSelectedClipId } = useClipStore();
  const filters = useFilterStore(
    useShallow((s) => ({
      selectedFolders: s.selectedFolders,
      selectedTags: s.selectedTags,
      starFilter: s.starFilter,
      searchQuery: s.searchQuery,
      sortBy: s.sortBy,
      category: s.category,
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

  // Apply filters (useMemo only — no duplicate in store per eng review #5)
  const filtered = useMemo(
    () => {
      const visibleClips = filterClips(
        clips,
        filters,
        categories,
        tagI18n,
        lang
      );
      return shuffleSeed === 0 ? visibleClips : shuffleClips(visibleClips);
    },
    [clips, filters, categories, tagI18n, shuffleSeed, lang]
  );
  const indexMap = useMemo(
    () => new Map(filtered.map((c, i) => [c.id, i])),
    [filtered]
  );
  const selectedIndex = selectedClipId ? (indexMap.get(selectedClipId) ?? -1) : -1;
  const selectedClip = selectedIndex >= 0 ? filtered[selectedIndex] : null;

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
      <div className="flex-1 flex items-center justify-center p-8 text-muted">
        {dict.browse.noResults}
      </div>
    );
  }

  return (
    <>
      <MasonryGrid clips={filtered} onOpenQuickView={openQuickViewForClip} />
      {quickViewOpen && selectedClip ? (
        <QuickViewModal
          clip={selectedClip}
          lang={lang}
          dict={dict}
          onClose={handleCloseQuickView}
        />
      ) : null}
    </>
  );
}
