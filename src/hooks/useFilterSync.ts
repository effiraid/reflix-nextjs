"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useFilterStore } from "@/stores/filterStore";
import type { SortBy } from "@/lib/types";

/**
 * Unidirectional URL → Zustand sync.
 *
 * URL is the single source of truth:
 * - On mount and browser back/forward: URL → Zustand
 * - On filter change: update URL via router.replace, which triggers the URL → Zustand sync
 */
export function useFilterSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // URL → Zustand (on mount and on URL change including back/forward)
  useEffect(() => {
    const category = searchParams.get("category");
    const tags = searchParams.getAll("tag");
    const star = searchParams.get("star");
    const sort = searchParams.get("sort") as SortBy | null;
    const folders = searchParams.getAll("folder");
    const searchQuery = searchParams.get("q");

    useFilterStore.setState({
      category: category || null,
      selectedTags: tags,
      starFilter: star ? Number(star) : null,
      sortBy: sort || "newest",
      selectedFolders: folders,
      searchQuery: searchQuery || "",
    });
  }, [searchParams]);

  // Expose a function to update URL (which then syncs back to Zustand)
  return {
    updateURL: (updates: Partial<{
      category: string | null;
      selectedTags: string[];
      selectedFolders: string[];
      starFilter: number | null;
      sortBy: SortBy;
      searchQuery: string;
    }>) => {
      const state = { ...useFilterStore.getState(), ...updates };
      const params = new URLSearchParams();

      if (state.category) params.set("category", state.category);
      state.selectedTags.forEach((t) => params.append("tag", t));
      state.selectedFolders.forEach((f) => params.append("folder", f));
      if (state.starFilter !== null)
        params.set("star", String(state.starFilter));
      if (state.sortBy !== "newest") params.set("sort", state.sortBy);
      if (state.searchQuery) params.set("q", state.searchQuery);

      const qs = params.toString();
      const newPath = qs ? `${pathname}?${qs}` : pathname;
      router.replace(newPath, { scroll: false });
    },
  };
}
