"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadEffectiveAccess } from "@/lib/supabase/access";
import {
  buildSessionReplacedLoginPath,
  claimActiveAuthTab,
  clearActiveAuthTab,
  clearTabSessionRevoked,
  getActiveAuthTab,
  getOrCreateAuthTabId,
  isTabSessionRevoked,
  markTabSessionRevoked,
} from "@/lib/authTabSession";
import { useAuthStore } from "@/stores/authStore";

function AuthProviderEffects() {
  const { setUser, setAccess, resetAccess, setLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
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
      stopHeartbeat();
      markTabSessionRevoked();
      setUser(null);
      resetAccess();
      setLoading(false);
      redirectSupersededTab();
    }

    function acceptCurrentTabSession(user: Parameters<typeof setUser>[0] & { id: string }) {
      clearTabSessionRevoked();
      claimActiveAuthTab(tabId);
      startHeartbeat();

      setUser(user);
      setLoading(false);
      void loadAccess(user.id);
    }

    // Single listener: handles INITIAL_SESSION, SIGNED_IN, SIGNED_OUT
    // Avoids lock contention from concurrent getSession() + onAuthStateChange
    // Clear stale refresh token cookies to prevent console AuthApiError
    client.auth.getSession().then(({ error }) => {
      if (error?.message?.includes("Refresh Token")) {
        client.auth.signOut({ scope: "local" });
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
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
