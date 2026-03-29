"use client";

import { useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useFilterStore } from "@/stores/filterStore";
import type { ContentMode, SortBy } from "@/lib/types";

export type FilterURLUpdates = Partial<{
  category: string | null;
  contentMode: ContentMode | null;
  selectedTags: string[];
  excludedTags: string[];
  excludedFolders: string[];
  selectedFolders: string[];
  sortBy: SortBy;
  searchQuery: string;
  boardId: string | null;
}>;

function buildFilterURL(pathname: string): string {
  const state = useFilterStore.getState();
  const params = new URLSearchParams();

  if (state.category) params.set("category", state.category);
  if (state.contentMode) params.set("mode", state.contentMode);
  state.selectedTags.forEach((t) => params.append("tag", t));
  state.excludedTags.forEach((t) => params.append("exclude", t));
  state.excludedFolders.forEach((f) => params.append("excludeFolder", f));
  state.selectedFolders.forEach((f) => params.append("folder", f));
  if (state.sortBy !== "newest") params.set("sort", state.sortBy);
  if (state.searchQuery) params.set("q", state.searchQuery);
  if (state.boardId) params.set("board", state.boardId);

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function updateFilterURL(pathname: string, updates: FilterURLUpdates) {
  // Board transitions use pushState (enables browser back), others use replaceState
  const isBoardTransition = "boardId" in updates;

  useFilterStore.setState(updates);

  const newPath = buildFilterURL(pathname);

  if (isBoardTransition) {
    window.history.pushState(null, "", newPath);
  } else {
    window.history.replaceState(null, "", newPath);
  }
}

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
    const excludeFolders = searchParams.getAll("excludeFolder");
    const rawSort = searchParams.get("sort");
    const sort: SortBy | null =
      rawSort && ["newest", "name"].includes(rawSort)
        ? (rawSort as SortBy)
        : null;
    const folders = searchParams.getAll("folder");
    const searchQuery = searchParams.get("q");
    const rawMode = searchParams.get("mode");
    const contentMode: ContentMode | null =
      rawMode && ["direction", "game"].includes(rawMode)
        ? (rawMode as ContentMode)
        : null;
    const boardId = searchParams.get("board");

    useFilterStore.setState({
      category: category || null,
      selectedTags: tags,
      excludedTags: excludeTags,
      excludedFolders: excludeFolders,
      sortBy: sort || "newest",
      selectedFolders: folders,
      searchQuery: searchQuery || "",
      contentMode,
      boardId: boardId || null,
    });
  }, [searchParams]);

  // Expose a function to update URL (which then syncs back to Zustand)
  return {
    updateURL: (updates: FilterURLUpdates) => updateFilterURL(pathname, updates),
  };
}
