"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  claimActiveAuthTab,
  clearTabSessionRevoked,
  getActiveAuthTab,
  getOrCreateAuthTabId,
  restoreActiveAuthTab,
} from "@/lib/authTabSession";
import { sanitizePostAuthRedirect } from "@/lib/authRedirect";
import { BrandSplash } from "@/components/splash/BrandSplash";

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  const stripped = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of stripped.split("&")) {
    const [key, ...rest] = part.split("=");
    if (key) params[key] = decodeURIComponent(rest.join("="));
  }
  return params;
}

type CallbackState = "processing" | "error";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useParams();
  const lang = (params.lang as string) || "ko";
  const handled = useRef(false);
  const [state, setState] = useState<CallbackState>("processing");
  const isKo = lang === "ko";
  const { nextPath, failureDestination } = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        nextPath: `/${lang}/browse`,
        failureDestination: null as string | null,
      };
    }

    const searchParams = new URLSearchParams(window.location.search);
    const next = sanitizePostAuthRedirect(
      searchParams.get("next"),
      `/${lang}/browse`
    );

    return {
      nextPath: next,
      failureDestination: next.startsWith(`/${lang}/account`)
        ? `/${lang}/account?linkError=google`
        : null,
    };
  }, [lang]);

  const splashStart = useRef(0);

  useEffect(() => {
    if (handled.current) return;
    splashStart.current = Date.now();

    const supabase = createClient();
    if (!supabase) {
      router.replace(`/${lang}/login?error=auth`);
      return;
    }

    function onSuccess() {
      if (handled.current) return;
      handled.current = true;
      const elapsed = Date.now() - splashStart.current;
      const remaining = Math.max(0, 1300 - elapsed); // min 1s splash + 300ms fade-in
      setTimeout(() => router.replace(nextPath), remaining);
    }

    async function handleAuth() {
      const tabId = getOrCreateAuthTabId();

      // 1. Try hash fragment tokens (implicit flow)
      const hash = window.location.hash;
      if (hash) {
        const hp = parseHashParams(hash);
        if (hp.access_token && hp.refresh_token) {
          const previousActiveTab = getActiveAuthTab();
          clearTabSessionRevoked();
          claimActiveAuthTab(tabId);

          const { error } = await supabase!.auth.setSession({
            access_token: hp.access_token,
            refresh_token: hp.refresh_token,
          });
          if (!error) {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}`
            );
            onSuccess();
            return;
          }

          restoreActiveAuthTab(previousActiveTab);
        }
      }

      // 2. Check if session already exists
      const { data } = await supabase!.auth.getUser();
      if (data.user) {
        clearTabSessionRevoked();
        claimActiveAuthTab(tabId);
        onSuccess();
        return;
      }

      // 3. No tokens found
      if (failureDestination) {
        handled.current = true;
        router.replace(failureDestination);
        return;
      }

      setState("error");
    }

    void handleAuth();
  }, [failureDestination, lang, nextPath, router]);

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-sm text-red-500">
            {isKo
              ? "로그인에 실패했습니다."
              : "Login failed."}
          </p>
          <button
            onClick={() =>
              router.replace(failureDestination ?? `/${lang}/login`)
            }
            className="mt-3 text-sm text-muted underline"
          >
            {isKo ? "다시 시도하기" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return <BrandSplash persistent />;
}
