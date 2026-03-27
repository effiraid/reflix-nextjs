"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setTier, setLoading, setDailyViews } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    if (!supabase) {
      setUser(null);
      setTier("free");
      setDailyViews(0);
      setLoading(false);
      return;
    }

    const client = supabase;

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else {
          setUser(null);
          setTier("free");
        }
      } catch {
        setUser(null);
        setTier("free");
      } finally {
        setLoading(false);
      }
    }

    async function loadProfile(userId: string) {
      const { data: profile } = await client
        .from("profiles")
        .select("tier")
        .eq("id", userId)
        .single();

      if (profile) {
        setTier(profile.tier as "free" | "pro");
      }

      // Load today's usage
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await client
        .from("daily_usage")
        .select("clip_views")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      if (usage) {
        setDailyViews(usage.clip_views);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setTier("free");
        setDailyViews(0);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setTier, setLoading, setDailyViews]);

  return <>{children}</>;
}
