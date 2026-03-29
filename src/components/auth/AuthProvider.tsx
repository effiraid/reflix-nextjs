"use client";

import { Suspense, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadEffectiveAccess } from "@/lib/supabase/access";
import {
  buildSessionReplacedLoginPath,
  claimActiveAuthTab,
  clearActiveAuthTab,
  clearPendingAuthFlow,
  clearTabSessionRevoked,
  getActiveAuthTab,
  getOrCreateAuthTabId,
  isTabSessionRevoked,
  markTabSessionRevoked,
} from "@/lib/authTabSession";
import { clearBlobVideoCache } from "@/lib/blobVideo";
import { useAuthStore } from "@/stores/authStore";

const E2E_AUTH_KEY = "reflix-e2e-auth";

type E2EAuthOverride = {
  tier: "free" | "pro";
  userId: string;
  email?: string;
};

function readE2EAuthOverride(): E2EAuthOverride | null {
  const isE2EEnabled = process.env.NEXT_PUBLIC_E2E_AUTH === "1";

  if (!isE2EEnabled) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(E2E_AUTH_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<E2EAuthOverride>;
    if (
      (parsed.tier !== "free" && parsed.tier !== "pro") ||
      typeof parsed.userId !== "string" ||
      parsed.userId.trim().length === 0
    ) {
      return null;
    }

    return {
      tier: parsed.tier,
      userId: parsed.userId,
      email:
        typeof parsed.email === "string" && parsed.email.trim().length > 0
          ? parsed.email
          : undefined,
    };
  } catch {
    return null;
  }
}

function buildE2EUser(override: E2EAuthOverride): User {
  return {
    id: override.userId,
    email: override.email ?? `${override.userId}@e2e.local`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date(0).toISOString(),
  } as User;
}

function AuthProviderEffects() {
  const { setUser, setAccess, resetAccess, setLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const e2eAuthOverride = readE2EAuthOverride();
    if (e2eAuthOverride) {
      clearPendingAuthFlow();
      clearTabSessionRevoked();
      setUser(buildE2EUser(e2eAuthOverride));
      setAccess({
        planTier: e2eAuthOverride.tier,
        effectiveTier: e2eAuthOverride.tier,
        accessSource: e2eAuthOverride.tier === "pro" ? "paid" : "free",
        betaEndsAt: null,
      });
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const tabId = getOrCreateAuthTabId();

    if (!supabase) {
      setUser(null);
      resetAccess();
      setLoading(false);
      return;
    }

    const client = supabase;
    let heartbeatInterval: number | null = null;

    function stopHeartbeat() {
      if (heartbeatInterval !== null) {
        window.clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }

    function startHeartbeat() {
      stopHeartbeat();
      heartbeatInterval = window.setInterval(() => {
        const active = getActiveAuthTab();
        if (active?.tabId === tabId) {
          claimActiveAuthTab(tabId);
        }
      }, 5000);
    }

    async function loadAccess(userId: string) {
      try {
        const access = await loadEffectiveAccess(
          client as Parameters<typeof loadEffectiveAccess>[0],
          userId,
        );
        setAccess(access);
      } catch {
        resetAccess();
      }
    }

    function redirectSupersededTab() {
      const nextPath = buildSessionReplacedLoginPath(
        pathname ?? window.location.pathname
      );

      window.setTimeout(() => {
        router.replace(nextPath);
      }, 0);
    }

    function supersedeCurrentTab() {
      clearBlobVideoCache();
      stopHeartbeat();
      markTabSessionRevoked();
      setUser(null);
      resetAccess();
      setLoading(false);
      redirectSupersededTab();
    }

    function acceptCurrentTabSession(user: Parameters<typeof setUser>[0] & { id: string }) {
      clearTabSessionRevoked();
      clearPendingAuthFlow();
      claimActiveAuthTab(tabId);
      startHeartbeat();

      setUser(user);
      setLoading(false);
      void loadAccess(user.id);
    }

    // Single listener: handles INITIAL_SESSION, SIGNED_IN, SIGNED_OUT
    // Stale refresh-token cookies are cleared server-side in proxy.ts,
    // so no client-side getSession() cleanup is needed here.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      const currentUserId = useAuthStore.getState().user?.id ?? null;
      const nextUserId = session?.user?.id ?? null;
      if (currentUserId !== nextUserId) {
        clearBlobVideoCache();
      }

      if (session?.user) {
        const activeTab = getActiveAuthTab();

        if (activeTab && activeTab.tabId !== tabId) {
          supersedeCurrentTab();
          return;
        }

        if (!activeTab && isTabSessionRevoked()) {
          supersedeCurrentTab();
          return;
        }

        acceptCurrentTabSession(session.user);
      } else {
        stopHeartbeat();
        clearActiveAuthTab(tabId);
        setUser(null);
        resetAccess();
        setLoading(false);
      }
    });

    // Safety: if onAuthStateChange never fires (e.g. network issue),
    // resolve loading after 2s so the UI isn't stuck on skeleton
    const safetyTimeout = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        setLoading(false);
      }
    }, 2000);

    function handleBeforeUnload() {
      clearActiveAuthTab(tabId);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      stopHeartbeat();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [pathname, resetAccess, router, setAccess, setLoading, setUser]);

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <AuthProviderEffects />
      </Suspense>
    </>
  );
}
