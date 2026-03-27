"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrownIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";

interface AccountClientProps {
  lang: Locale;
  dict: Dictionary;
}

export function AccountClient({ lang }: AccountClientProps) {
  const { user, tier, isLoading } = useAuthStore();
  const router = useRouter();
  const isKo = lang === "ko";

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/${lang}/login`);
    }
  }, [isLoading, user, lang, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">
          {isKo ? "로딩 중..." : "Loading..."}
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
        </div>
      </div>
    </div>
  );
}
