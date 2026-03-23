import { create } from "zustand";
import type { SortBy } from "@/lib/types";

interface FilterStore {
  selectedFolders: string[];
  selectedTags: string[];
  starFilter: number | null;
  searchQuery: string;
  sortBy: SortBy;
  category: string | null;

  setCategory: (category: string | null) => void;
  toggleFolder: (folderId: string) => void;
  toggleTag: (tag: string) => void;
  setStarFilter: (star: number | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: SortBy) => void;
  clearFilters: () => void;
  removeTag: (tag: string) => void;
  removeFolder: (folderId: string) => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  selectedFolders: [],
  selectedTags: [],
  starFilter: null,
  searchQuery: "",
  sortBy: "newest",
  category: null,

  setCategory: (category) => set({ category }),

  toggleFolder: (folderId) =>
    set((state) => ({
      selectedFolders: state.selectedFolders.includes(folderId)
        ? state.selectedFolders.filter((f) => f !== folderId)
        : [...state.selectedFolders, folderId],
    })),

  toggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((t) => t !== tag)
        : [...state.selectedTags, tag],
    })),

  setStarFilter: (star) => set({ starFilter: star }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (sort) => set({ sortBy: sort }),

  clearFilters: () =>
    set({
      selectedFolders: [],
      selectedTags: [],
      starFilter: null,
      searchQuery: "",
      sortBy: "newest",
      category: null,
    }),

  removeTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.filter((t) => t !== tag),
    })),

  removeFolder: (folderId) =>
    set((state) => ({
      selectedFolders: state.selectedFolders.filter((f) => f !== folderId),
    })),
}));
