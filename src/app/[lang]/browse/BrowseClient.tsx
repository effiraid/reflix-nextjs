"use client";

import { useEffect, useMemo } from "react";
import { MasonryGrid } from "@/components/clip/MasonryGrid";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useFilterStore } from "@/stores/filterStore";
import { useClipStore } from "@/stores/clipStore";
import { useUIStore } from "@/stores/uiStore";
import { filterClips, shuffleClips } from "@/lib/filter";
import type { CategoryTree, ClipIndex } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

interface BrowseClientProps {
  initialClips: ClipIndex[];
  categories: CategoryTree;
  tagI18n?: Record<string, string>;
  dict: Dictionary;
}

export function BrowseClient({
  initialClips,
  categories,
  tagI18n = {},
  dict,
}: BrowseClientProps) {
  const { setAllClips, setIsLoading } = useClipStore();
  const filters = useFilterStore();
  const shuffleSeed = useUIStore((state) => state.shuffleSeed);

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

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted">
        {dict.browse.noResults}
      </div>
    );
  }

  return <MasonryGrid clips={filtered} />;
}
