"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CrownIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "@/lib/authRedirect";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";
import { BrandSplash } from "@/components/splash/BrandSplash";

interface AccountClientProps {
  lang: Locale;
  dict: Pick<Dictionary, "auth">;
}

export function AccountClient({ lang, dict }: AccountClientProps) {
  const authDict = dict.auth;
  const { user, accessSource, betaEndsAt, isLoading } = useAuthStore();
  const { openPricingModal } = useUIStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isKo = lang === "ko";
  const isPaidPro = accessSource === "paid";
  const isBetaPro = accessSource === "beta";
  const betaDateLabel = betaEndsAt
    ? new Intl.DateTimeFormat(isKo ? "ko-KR" : "en-US", {
        dateStyle: "medium",
      }).format(new Date(betaEndsAt))
    : null;
  const [identitiesLoading, setIdentitiesLoading] = useState(true);
  const [identitiesError, setIdentitiesError] = useState("");
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/${lang}/login`);
    }
  }, [isLoading, user, lang, router]);

  useEffect(() => {
    if (!user) return;
    let isActive = true;

    async function loadIdentities() {
      const supabase = createClient();

      if (!supabase) {
        if (!isActive) return;
        setIdentitiesError(
          isKo
            ? "로그인 연결 기능이 아직 설정되지 않았습니다."
            : "Sign-in linking is not configured yet."
        );
        setIdentitiesLoading(false);
        return;
      }

      setIdentitiesLoading(true);

      const { data, error } = await supabase.auth.getUserIdentities();

      if (!isActive) return;

      if (error) {
        setIdentitiesError(
          isKo
            ? "로그인 방법을 불러오지 못했습니다."
            : "Could not load sign-in methods."
        );
        setIdentitiesLoading(false);
        return;
      }

      setIsGoogleLinked(
        (data?.identities ?? []).some((identity) => identity.provider === "google")
      );
      setIdentitiesError("");
      setIdentitiesLoading(false);
    }

    void loadIdentities();

    return () => {
      isActive = false;
    };
  }, [isKo, user]);

  async function handleConnectGoogle() {
    const supabase = createClient();
    if (!supabase) {
      setIdentitiesError(
        isKo
          ? "로그인 연결 기능이 아직 설정되지 않았습니다."
          : "Sign-in linking is not configured yet."
      );
      return;
    }

    const redirectTo = buildAuthCallbackUrl(
      lang,
      window.location.origin,
      `/${lang}/account?linked=google`
    );

    if (!redirectTo) {
      setIdentitiesError(
        isKo
          ? "Google 연결 설정이 올바르지 않습니다."
          : "Google linking is misconfigured."
      );
      return;
    }

    setIsLinkingGoogle(true);

    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setIdentitiesError(
        isKo
          ? "Google 연결을 시작하지 못했습니다. 다시 시도해주세요."
          : "Could not start Google linking. Please try again."
      );
      setIsLinkingGoogle(false);
    }
  }

  if (isLoading) {
    return <BrandSplash persistent />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">
          {isKo ? "로그인 페이지로 이동 중..." : "Redirecting to login..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">
          {authDict.account}
        </h1>

        <div className="mt-6 space-y-4">
          {/* Profile info */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">
              {authDict.email}
            </p>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>

          {/* Subscription */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {authDict.subscription}
              </p>
              {isPaidPro ? (
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  PRO
                </span>
              ) : isBetaPro ? (
                <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
                  {authDict.betaBadge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {isPaidPro
                ? authDict.proActive
                : isBetaPro
                  ? authDict.betaActive
                  : authDict.freeTier}
            </p>

            {isBetaPro ? (
              <div className="mt-2 space-y-1 text-xs text-muted">
                {betaDateLabel ? (
                  <p>
                    {authDict.betaEndsOn}: {betaDateLabel}
                  </p>
                ) : null}
                <p>{authDict.betaRevertsToFree}</p>
              </div>
            ) : null}

            {isPaidPro ? (
              <p className="mt-2 text-xs text-muted">
                {authDict.manageViaStripe}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => openPricingModal()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <CrownIcon className="size-3.5" strokeWidth={2} />
                {authDict.upgradeToPro}
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">
              {isKo ? "로그인 방법" : "Sign-in methods"}
            </p>

            {searchParams.get("linked") === "google" ? (
              <p className="mt-2 text-xs text-green-600">
                {isKo
                  ? "Google 연결이 완료되었습니다."
                  : "Google was connected successfully."}
              </p>
            ) : null}

            {searchParams.get("linkError") === "google" ? (
              <p className="mt-2 text-xs text-red-500">
                {isKo
                  ? "Google 연결을 완료하지 못했습니다. 다시 시도해주세요."
                  : "Could not finish Google linking. Please try again."}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="mt-1 text-xs text-muted">
                  {isKo
                    ? "기존 계정에 Google 로그인을 추가합니다."
                    : "Add Google as another sign-in method for this account."}
                </p>
              </div>

              {identitiesLoading ? (
                <span className="text-xs text-muted">
                  {isKo ? "불러오는 중..." : "Loading..."}
                </span>
              ) : isGoogleLinked ? (
                <span className="rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                  {isKo ? "연결됨" : "Connected"}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void handleConnectGoogle();
                  }}
                  disabled={isLinkingGoogle}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {isLinkingGoogle
                    ? isKo
                      ? "연결 중..."
                      : "Connecting..."
                    : isKo
                      ? "Google 연결"
                      : "Connect Google"}
                </button>
              )}
            </div>

            {identitiesError ? (
              <p className="mt-3 text-xs text-red-500">{identitiesError}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
