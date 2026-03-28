import { create } from "zustand";
import type { ClipRating } from "@/lib/clipRatingClient";

export function getClipRatingCacheKey(userId: string, clipId: string) {
  return `${userId}:${clipId}`;
}

interface ClipRatingStore {
  ratings: Record<string, ClipRating>;
  loading: Record<string, boolean>;
  setRating: (cacheKey: string, rating: ClipRating) => void;
  setLoading: (cacheKey: string, loading: boolean) => void;
  clearRating: (cacheKey: string) => void;
}

export const useClipRatingStore = create<ClipRatingStore>((set) => ({
  ratings: {},
  loading: {},
  setRating: (cacheKey, rating) =>
    set((state) => ({
      ratings: { ...state.ratings, [cacheKey]: rating },
    })),
  setLoading: (cacheKey, loading) =>
    set((state) => ({
      loading: { ...state.loading, [cacheKey]: loading },
    })),
  clearRating: (cacheKey) =>
    set((state) => {
      const { [cacheKey]: _, ...rest } = state.ratings;
      return { ratings: rest };
    }),
}));
