import { create } from "zustand";
import type { ViewMode } from "@/lib/types";
import { clampThumbnailSize } from "@/lib/thumbnailSize";

interface UIStore {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  viewMode: ViewMode;
  quickViewOpen: boolean;
  filterBarOpen: boolean;
  thumbnailSize: number;
  activeFilterTab: string | null;
  shuffleSeed: number;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setQuickViewOpen: (open: boolean) => void;
  setFilterBarOpen: (open: boolean) => void;
  toggleFilterBar: () => void;
  setThumbnailSize: (size: number) => void;
  setActiveFilterTab: (tab: string | null) => void;
  reshuffleClips: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  viewMode: "masonry",
  quickViewOpen: false,
  filterBarOpen: false,
  thumbnailSize: 2,
  activeFilterTab: null,
  shuffleSeed: 0,

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setQuickViewOpen: (open) => set({ quickViewOpen: open }),
  setFilterBarOpen: (open) => set({ filterBarOpen: open }),
  toggleFilterBar: () =>
    set((state) => ({ filterBarOpen: !state.filterBarOpen })),
  setThumbnailSize: (size) =>
    set({ thumbnailSize: clampThumbnailSize(size) }),
  setActiveFilterTab: (tab) => set({ activeFilterTab: tab }),
  reshuffleClips: () =>
    set((state) => ({ shuffleSeed: state.shuffleSeed + 1 })),
}));
