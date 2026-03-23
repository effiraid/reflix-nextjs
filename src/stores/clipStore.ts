import { create } from "zustand";
import type { ClipIndex } from "@/lib/types";

interface ClipStore {
  selectedClipId: string | null;
  allClips: ClipIndex[];
  isLoading: boolean;

  setSelectedClipId: (id: string | null) => void;
  setAllClips: (clips: ClipIndex[]) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useClipStore = create<ClipStore>((set) => ({
  selectedClipId: null,
  allClips: [],
  isLoading: true,

  setSelectedClipId: (id) => set({ selectedClipId: id }),
  setAllClips: (clips) => set({ allClips: clips }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
