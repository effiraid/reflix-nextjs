import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

export type Tier = "free" | "pro";

interface AuthState {
  user: User | null;
  tier: Tier;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setTier: (tier: Tier) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  tier: "free",
  isLoading: true,

  setUser: (user) => set({ user }),
  setTier: (tier) => set({ tier }),
  setLoading: (isLoading) => set({ isLoading }),
}));
