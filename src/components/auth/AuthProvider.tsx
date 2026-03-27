"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setTier, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    if (!supabase) {
      setUser(null);
      setTier("free");
      setLoading(false);
      return;
    }

    const client = supabase;

    async function loadProfile(userId: string) {
      try {
        const { data: profile } = await client
          .from("profiles")
          .select("tier")
          .eq("id", userId)
          .single();

        if (profile) {
          setTier(profile.tier as "free" | "pro");
        }
      } catch {
        // Profile table may not exist yet — ignore
      }
    }

    // Single listener: handles INITIAL_SESSION, SIGNED_IN, SIGNED_OUT
    // Avoids lock contention from concurrent getSession() + onAuthStateChange
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
        // Load tier & daily usage in background (non-blocking)
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setTier("free");
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

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [setUser, setTier, setLoading]);

  return <>{children}</>;
}
