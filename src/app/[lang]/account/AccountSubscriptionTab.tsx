"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CrownIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";

interface Props {
  lang: Locale;
  dict: Pick<Dictionary, "auth" | "account">;
}

export function AccountSubscriptionTab({ lang, dict }: Props) {
  const t = dict.account;
  const authDict = dict.auth;
  const { accessSource, betaEndsAt } = useAuthStore();
  const { openPricingModal } = useUIStore();
  const searchParams = useSearchParams();
  const isKo = lang === "ko";
  const isPaidPro = accessSource === "paid";
  const isBetaPro = accessSource === "beta";
  const [portalLoading, setPortalLoading] = useState(false);

  const betaDateLabel = betaEndsAt
    ? new Intl.DateTimeFormat(isKo ? "ko-KR" : "en-US", {
        dateStyle: "medium",
      }).format(new Date(betaEndsAt))
    : null;

  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(
    searchParams.get("checkout") === "success"
  );

  useEffect(() => {
    if (showCheckoutSuccess) {
      // Clean up URL param after showing the message
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState(null, "", url.toString());
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setShowCheckoutSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showCheckoutSuccess]);

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: "monthly", lang }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // ignore
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {showCheckoutSuccess && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <p className="text-xs text-green-500">{t.checkoutSuccess}</p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{t.currentPlan}</p>
          {isPaidPro ? (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              PRO
            </span>
          ) : isBetaPro ? (
            <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
              {authDict.betaBadge}
            </span>
          ) : (
            <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
              FREE
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-muted">
          {isPaidPro
            ? authDict.proActive
            : isBetaPro
              ? authDict.betaActive
              : authDict.freeTier}
        </p>

        {isBetaPro && (
          <div className="mt-2 space-y-1 text-xs text-muted">
            {betaDateLabel && (
              <p>
                {authDict.betaEndsOn}: {betaDateLabel}
              </p>
            )}
            <p>{authDict.betaRevertsToFree}</p>
          </div>
        )}

        {isPaidPro ? (
          <button
            type="button"
            onClick={() => void handleManageSubscription()}
            disabled={portalLoading}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            {portalLoading
              ? (isKo ? "로딩 중..." : "Loading...")
              : t.manageSubscription}
          </button>
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
    </div>
  );
}
