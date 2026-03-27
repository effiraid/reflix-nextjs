import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

export type Tier = "free" | "pro";

const DAILY_VIEW_LIMITS: Record<Tier, number> = {
  free: 20,
  pro: Infinity,
};

interface AuthState {
  user: User | null;
  tier: Tier;
  isLoading: boolean;
  dailyViews: number;

  setUser: (user: User | null) => void;
  setTier: (tier: Tier) => void;
  setLoading: (loading: boolean) => void;
  setDailyViews: (count: number) => void;
  incrementViews: () => boolean;
  resetDailyViews: () => void;
  getDailyViewLimit: () => number;
  getRemainingViews: () => number;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  tier: "free",
  isLoading: true,
  dailyViews: 0,

  setUser: (user) => set({ user }),
  setTier: (tier) => set({ tier }),
  setLoading: (isLoading) => set({ isLoading }),
  setDailyViews: (dailyViews) => set({ dailyViews }),

  incrementViews: () => {
    const { tier, dailyViews } = get();
    const limit = DAILY_VIEW_LIMITS[tier];
    if (dailyViews >= limit) return false;
    set({ dailyViews: dailyViews + 1 });
    return true;
  },

  resetDailyViews: () => set({ dailyViews: 0 }),

  getDailyViewLimit: () => DAILY_VIEW_LIMITS[get().tier],
  getRemainingViews: () => {
    const { tier, dailyViews } = get();
    const limit = DAILY_VIEW_LIMITS[tier];
    return limit === Infinity ? Infinity : Math.max(limit - dailyViews, 0);
  },
}));
