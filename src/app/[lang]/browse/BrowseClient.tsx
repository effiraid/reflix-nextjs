"use client";

import { useCallback, useMemo } from "react";
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
import { useShallow } from "zustand/react/shallow";
import type { CategoryTree, Locale } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

const QuickViewModal = dynamic(
  () =>
    import("@/components/clip/QuickViewModal").then((m) => m.QuickViewModal),
  { ssr: false }
);

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
  const { quickViewOpen, setQuickViewOpen, thumbnailSize, setThumbnailSize, shuffleSeed } = useUIStore();

  // Sync URL → Zustand filters
  useFilterSync();

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

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        key: " ",
        action: () => setQuickViewOpen(true),
        enabled: !!selectedClip && !quickViewOpen,
      },
      {
        key: "-",
        action: () => setThumbnailSize(thumbnailSize - 1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
      {
        key: "+",
        action: () => setThumbnailSize(thumbnailSize + 1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
      {
        key: "=",
        action: () => setThumbnailSize(thumbnailSize + 1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
    ],
    [quickViewOpen, selectedClip, setQuickViewOpen, thumbnailSize, setThumbnailSize]
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
