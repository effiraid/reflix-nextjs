"use client";

import { useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useFilterStore } from "@/stores/filterStore";
import type { ContentMode, SortBy } from "@/lib/types";

/**
 * Unidirectional URL → Zustand sync.
 *
 * URL is the single source of truth:
 * - On mount and browser back/forward: URL → Zustand
 * - On filter change: Zustand updated optimistically, URL synced via history.replaceState
 */
export function useFilterSync() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // URL → Zustand (on mount and on URL change including back/forward)
  useEffect(() => {
    const category = searchParams.get("category");
    const tags = searchParams.getAll("tag");
    const excludeTags = searchParams.getAll("exclude");
    const star = searchParams.get("star");
    const rawSort = searchParams.get("sort");
    const sort: SortBy | null =
      rawSort && ["newest", "rating", "name"].includes(rawSort)
        ? (rawSort as SortBy)
        : null;
    const folders = searchParams.getAll("folder");
    const searchQuery = searchParams.get("q");
    const rawMode = searchParams.get("mode");
    const contentMode: ContentMode | null =
      rawMode && ["direction", "game"].includes(rawMode)
        ? (rawMode as ContentMode)
        : null;

    useFilterStore.setState({
      category: category || null,
      selectedTags: tags,
      excludedTags: excludeTags,
      starFilter: star ? Number(star) : null,
      sortBy: sort || "newest",
      selectedFolders: folders,
      searchQuery: searchQuery || "",
      contentMode,
    });
  }, [searchParams]);

  // Expose a function to update URL (which then syncs back to Zustand)
  return {
    updateURL: (updates: Partial<{
      category: string | null;
      contentMode: ContentMode | null;
      selectedTags: string[];
      excludedTags: string[];
      selectedFolders: string[];
      starFilter: number | null;
      sortBy: SortBy;
      searchQuery: string;
    }>) => {
      // Optimistically update Zustand immediately (no server round-trip)
      useFilterStore.setState(updates);

      const state = useFilterStore.getState();
      const params = new URLSearchParams();

      if (state.category) params.set("category", state.category);
      if (state.contentMode) params.set("mode", state.contentMode);
      state.selectedTags.forEach((t) => params.append("tag", t));
      state.excludedTags.forEach((t) => params.append("exclude", t));
      state.selectedFolders.forEach((f) => params.append("folder", f));
      if (state.starFilter !== null)
        params.set("star", String(state.starFilter));
      if (state.sortBy !== "newest") params.set("sort", state.sortBy);
      if (state.searchQuery) params.set("q", state.searchQuery);

      const qs = params.toString();
      const newPath = qs ? `${pathname}?${qs}` : pathname;
      window.history.replaceState(null, "", newPath);
    },
  };
}
