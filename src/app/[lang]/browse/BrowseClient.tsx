"use client";

import { useEffect, useMemo } from "react";
import { MasonryGrid } from "@/components/clip/MasonryGrid";
import { QuickViewModal } from "@/components/clip/QuickViewModal";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useFilterStore } from "@/stores/filterStore";
import { useClipStore } from "@/stores/clipStore";
import { useUIStore } from "@/stores/uiStore";
import { filterClips, shuffleClips } from "@/lib/filter";
import type { CategoryTree, ClipIndex, Locale } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

interface BrowseClientProps {
  initialClips: ClipIndex[];
  categories: CategoryTree;
  tagI18n?: Record<string, string>;
  lang: Locale;
  dict: Dictionary;
}

export function BrowseClient({
  initialClips,
  categories,
  tagI18n = {},
  lang,
  dict,
}: BrowseClientProps) {
  const { selectedClipId, setSelectedClipId, setAllClips, setIsLoading } =
    useClipStore();
  const filters = useFilterStore();
  const { quickViewOpen, setQuickViewOpen, shuffleSeed } = useUIStore();

  // Sync URL → Zustand filters
  useFilterSync();

  // Load initial data into store
  useEffect(() => {
    setAllClips(initialClips);
    setIsLoading(false);
  }, [initialClips, setAllClips, setIsLoading]);

  // Apply filters (useMemo only — no duplicate in store per eng review #5)
  const filtered = useMemo(
    () => {
      const visibleClips = filterClips(
        initialClips,
        filters,
        categories,
        tagI18n
      );
      return shuffleSeed === 0 ? visibleClips : shuffleClips(visibleClips);
    },
    [initialClips, filters, categories, tagI18n, shuffleSeed]
  );
  const selectedIndex = filtered.findIndex((clip) => clip.id === selectedClipId);
  const selectedClip = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      if (
        (event.key === " " || event.code === "Space") &&
        !event.repeat &&
        selectedClip &&
        !quickViewOpen
      ) {
        event.preventDefault();
        setQuickViewOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickViewOpen, selectedClip, setQuickViewOpen]);

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted">
        {dict.browse.noResults}
      </div>
    );
  }

  function moveSelection(offset: -1 | 1) {
    if (selectedIndex < 0) {
      return;
    }

    const nextIndex = Math.min(
      filtered.length - 1,
      Math.max(0, selectedIndex + offset)
    );
    setSelectedClipId(filtered[nextIndex]?.id ?? selectedClipId);
  }

  function openQuickViewForClip(clipId: string) {
    setSelectedClipId(clipId);
    setQuickViewOpen(true);
  }

  return (
    <>
      <MasonryGrid clips={filtered} onOpenQuickView={openQuickViewForClip} />
      {quickViewOpen && selectedClip ? (
        <QuickViewModal
          clip={selectedClip}
          lang={lang}
          dict={dict}
          onClose={() => setQuickViewOpen(false)}
          onNext={() => moveSelection(1)}
          onPrevious={() => moveSelection(-1)}
        />
      ) : null}
    </>
  );
}
