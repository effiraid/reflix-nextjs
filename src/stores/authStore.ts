import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { AccessSource, EffectiveAccess, Tier } from "@/lib/access";

export type { Tier } from "@/lib/access";

interface AuthState {
  user: User | null;
  tier: Tier;
  planTier: Tier;
  accessSource: AccessSource;
  betaEndsAt: string | null;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setAccess: (access: EffectiveAccess) => void;
  resetAccess: () => void;
  setLoading: (loading: boolean) => void;
}

const FREE_ACCESS: EffectiveAccess = {
  planTier: "free",
  effectiveTier: "free",
  accessSource: "free",
  betaEndsAt: null,
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  tier: "free",
  planTier: "free",
  accessSource: "free",
  betaEndsAt: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setAccess: (access) =>
    set({
      tier: access.effectiveTier,
      planTier: access.planTier,
      accessSource: access.accessSource,
      betaEndsAt: access.betaEndsAt,
    }),
  resetAccess: () => set(FREE_ACCESS),
  setLoading: (isLoading) => set({ isLoading }),
}));
