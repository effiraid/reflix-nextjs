import { create } from "zustand";

interface ClipStore {
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
}

export const useClipStore = create<ClipStore>((set) => ({
  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
}));
