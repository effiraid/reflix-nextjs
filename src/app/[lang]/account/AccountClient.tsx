"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";
import { BrandSplash } from "@/components/splash/BrandSplash";
import { AccountProfileTab } from "./AccountProfileTab";
import { AccountSubscriptionTab } from "./AccountSubscriptionTab";
import { AccountSecurityTab } from "./AccountSecurityTab";
const TABS = ["profile", "subscription", "security"] as const;
type Tab = (typeof TABS)[number];

interface AccountClientProps {
  lang: Locale;
  dict: Pick<Dictionary, "auth" | "account">;
}

export function AccountClient({ lang, dict }: AccountClientProps) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (() => {
    const raw = searchParams.get("tab");
    return TABS.includes(raw as Tab) ? (raw as Tab) : "profile";
  })();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const setTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/${lang}/login`);
    }
  }, [isLoading, user, lang, router]);

  if (isLoading) {
    return <BrandSplash persistent />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">
          {lang === "ko" ? "로그인 페이지로 이동 중..." : "Redirecting to login..."}
        </p>
      </div>
    );
  }

  const tabLabels: Record<Tab, string> = {
    profile: dict.account.tabProfile,
    subscription: dict.account.tabSubscription,
    security: dict.account.tabSecurity,
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">{dict.auth.account}</h1>

        {/* Tabs */}
        <div
          className="mt-6 flex gap-0 overflow-x-auto border-b border-border scrollbar-hide"
          role="tablist"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setTab(tab)}
              onKeyDown={(e) => {
                const idx = TABS.indexOf(tab);
                if (e.key === "ArrowRight" && idx < TABS.length - 1) {
                  e.preventDefault();
                  setTab(TABS[idx + 1]);
                  (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
                } else if (e.key === "ArrowLeft" && idx > 0) {
                  e.preventDefault();
                  setTab(TABS[idx - 1]);
                  (e.currentTarget.previousElementSibling as HTMLElement)?.focus();
                }
              }}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Tab panels — all mounted, hidden via CSS to preserve state */}
        <div className="mt-6">
          <div className={activeTab !== "profile" ? "hidden" : undefined}>
            <AccountProfileTab lang={lang} dict={dict} user={user} />
          </div>
          <div className={activeTab !== "subscription" ? "hidden" : undefined}>
            <AccountSubscriptionTab lang={lang} dict={dict} />
          </div>
          <div className={activeTab !== "security" ? "hidden" : undefined}>
            <AccountSecurityTab lang={lang} dict={dict} user={user} />
          </div>
        </div>
      </div>
    </div>
  );
}
