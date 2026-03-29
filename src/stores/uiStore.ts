import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewMode } from "@/lib/types";
import { clampThumbnailSize } from "@/lib/thumbnailSize";
import type { ViewerTier } from "@/lib/accessPolicy";

export interface PricingModalIntent {
  kind: "locked-clip";
  viewerTier: ViewerTier;
  clipId: string;
  nextPath?: string;
}

export interface AuthRequiredModalIntent {
  kind: "auth-required";
  source: "boards" | "history";
  nextPath?: string;
}

export type ModalIntent = PricingModalIntent | AuthRequiredModalIntent;

interface UIStore {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  viewMode: ViewMode;
  quickViewOpen: boolean;
  filterBarOpen: boolean;
  thumbnailSize: number;
  activeFilterTab: string | null;
  shuffleSeed: number;
  pricingModalOpen: boolean;
  pricingModalIntent: ModalIntent | null;
  mobileSearchOpen: boolean;
  keyboardHelpOpen: boolean;
  searchFocused: boolean;
  browseMode: "grid" | "tags" | "boards" | "history";
  selectedTagGroupId: string | null;
  tagSearchQuery: string;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setQuickViewOpen: (open: boolean) => void;
  setFilterBarOpen: (open: boolean) => void;
  toggleFilterBar: () => void;
  setThumbnailSize: (size: number) => void;
  stepThumbnailSize: (delta: number) => void;
  setActiveFilterTab: (tab: string | null) => void;
  reshuffleClips: () => void;
  openPricingModal: (intent?: ModalIntent) => void;
  closePricingModal: () => void;
  setMobileSearchOpen: (open: boolean) => void;
  toggleKeyboardHelp: () => void;
  setSearchFocused: (focused: boolean) => void;
  setBrowseMode: (mode: "grid" | "tags" | "boards" | "history") => void;
  setSelectedTagGroupId: (id: string | null) => void;
  setTagSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      leftPanelOpen: true,
      rightPanelOpen: true,
      viewMode: "feed",
      quickViewOpen: false,
      filterBarOpen: false,
      thumbnailSize: 2,
      activeFilterTab: null,
      shuffleSeed: 0,
      pricingModalOpen: false,
      pricingModalIntent: null,
      mobileSearchOpen: false,
      keyboardHelpOpen: false,
      searchFocused: false,
      browseMode: "grid",
      selectedTagGroupId: null,
      tagSearchQuery: "",

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
      stepThumbnailSize: (delta) =>
        set((state) => ({ thumbnailSize: clampThumbnailSize(state.thumbnailSize + delta) })),
      setActiveFilterTab: (tab) => set({ activeFilterTab: tab }),
      reshuffleClips: () =>
        set((state) => ({ shuffleSeed: state.shuffleSeed + 1 })),
      openPricingModal: (intent) =>
        set({
          pricingModalOpen: true,
          pricingModalIntent: intent ?? null,
        }),
      closePricingModal: () =>
        set({
          pricingModalOpen: false,
          pricingModalIntent: null,
        }),
      setMobileSearchOpen: (open) => set({ mobileSearchOpen: open }),
      toggleKeyboardHelp: () =>
        set((state) => ({ keyboardHelpOpen: !state.keyboardHelpOpen })),
      setSearchFocused: (focused) => set({ searchFocused: focused }),
      setBrowseMode: (mode) => set({ browseMode: mode }),
      setSelectedTagGroupId: (id) => set({ selectedTagGroupId: id }),
      setTagSearchQuery: (query) => set({ tagSearchQuery: query }),
    }),
    {
      name: "reflix-ui",
      skipHydration: true,
      partialize: (state) => ({
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
        thumbnailSize: state.thumbnailSize,
        viewMode: state.viewMode,
      }),
    }
  )
);
