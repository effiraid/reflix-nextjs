import { create } from "zustand";
import type { ContentMode, SortBy } from "@/lib/types";

interface FilterStore {
  selectedFolders: string[];
  excludedFolders: string[];
  selectedTags: string[];
  excludedTags: string[];
  starFilter: number | null;
  searchQuery: string;
  sortBy: SortBy;
  category: string | null;
  contentMode: ContentMode | null;

  setCategory: (category: string | null) => void;
  setContentMode: (mode: ContentMode | null) => void;
  setStarFilter: (star: number | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: SortBy) => void;
  clearFilters: () => void;
  removeTag: (tag: string) => void;
  removeExcludeTag: (tag: string) => void;
  removeFolder: (folderId: string) => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  selectedFolders: [],
  excludedFolders: [],
  selectedTags: [],
  excludedTags: [],
  starFilter: null,
  searchQuery: "",
  sortBy: "newest",
  category: null,
  contentMode: null,

  setCategory: (category) => set({ category }),
  setContentMode: (mode) => set({ contentMode: mode }),

  setStarFilter: (star) => set({ starFilter: star }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (sort) => set({ sortBy: sort }),

  clearFilters: () =>
    set({
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      starFilter: null,
      searchQuery: "",
      sortBy: "newest",
      category: null,
      contentMode: null,
    }),

  removeTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.filter((t) => t !== tag),
    })),

  removeExcludeTag: (tag) =>
    set((state) => ({
      excludedTags: state.excludedTags.filter((t) => t !== tag),
    })),

  removeFolder: (folderId) =>
    set((state) => ({
      selectedFolders: state.selectedFolders.filter((f) => f !== folderId),
    })),
}));
