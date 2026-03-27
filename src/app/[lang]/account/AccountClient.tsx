"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CrownIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "@/lib/authRedirect";
import { useAuthStore } from "@/stores/authStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";
import { BrandSplash } from "@/components/splash/BrandSplash";

interface AccountClientProps {
  lang: Locale;
  dict: Dictionary;
}

export function AccountClient({ lang }: AccountClientProps) {
  const { user, tier, isLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isKo = lang === "ko";
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

    const client = createClient();
    if (!client) {
      setIdentitiesError(
        isKo
          ? "로그인 연결 기능이 아직 설정되지 않았습니다."
          : "Sign-in linking is not configured yet."
      );
      setIdentitiesLoading(false);
      return;
    }

    const supabase = client;

    async function loadIdentities() {
      setIdentitiesLoading(true);

      const { data, error } = await supabase.auth.getUserIdentities();

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
          {isKo ? "계정" : "Account"}
        </h1>

        <div className="mt-6 space-y-4">
          {/* Profile info */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">
              {isKo ? "이메일" : "Email"}
            </p>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>

          {/* Subscription */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {isKo ? "구독" : "Subscription"}
              </p>
              {tier === "pro" ? (
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  PRO
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {tier === "pro"
                ? isKo
                  ? "Pro 구독 활성"
                  : "Pro subscription active"
                : isKo
                  ? "무료 티어"
                  : "Free tier"}
            </p>

            {tier === "pro" ? (
              <p className="mt-2 text-xs text-muted">
                {isKo
                  ? "구독 관리는 Stripe Customer Portal에서 할 수 있습니다."
                  : "Manage your subscription via Stripe Customer Portal."}
              </p>
            ) : (
              <Link
                href={`/${lang}/pricing`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <CrownIcon className="size-3.5" strokeWidth={2} />
                {isKo ? "Pro로 업그레이드" : "Upgrade to Pro"}
              </Link>
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
