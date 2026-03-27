"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";

interface PricingCardsProps {
  lang: Locale;
  dict: Dictionary;
}

export function PricingCards({ lang }: PricingCardsProps) {
  const { user, tier } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    searchParams.get("interval") === "yearly" ? "yearly" : "monthly"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isKo = lang === "ko";
  const isYearly = billingInterval === "yearly";

  async function handleSubscribe() {
    if (!user) {
      router.push(`/${lang}/login`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, interval: billingInterval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(
          isKo ? "결제 페이지를 열 수 없습니다" : "Could not open checkout"
        );
        setLoading(false);
      }
    } catch {
      setError(
        isKo ? "결제 페이지를 열 수 없습니다" : "Could not open checkout"
      );
      setLoading(false);
    }
  }

  const freeFeatures = isKo
    ? ["50 무료 클립", "일 20회 조회", "보드 1개"]
    : ["50 free clips", "20 views/day", "1 board"];

  const proFeatures = isKo
    ? ["전체 라이브러리", "무제한 조회", "무제한 보드"]
    : ["Full library", "Unlimited views", "Unlimited boards"];

  const proPrice = isYearly
    ? isKo
      ? "₩99,000"
      : "$99"
    : isKo
      ? "₩9,900"
      : "$9.90";

  const proPeriod = isYearly
    ? isKo
      ? "년"
      : "yr"
    : isKo
      ? "월"
      : "mo";

  return (
    <div className="mt-10 w-full max-w-2xl">
      {/* Billing toggle */}
      <div className="mb-8 flex items-center justify-center gap-2.5">
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={{
              background: !isYearly
                ? "var(--color-foreground)"
                : "transparent",
              color: !isYearly
                ? "var(--color-background)"
                : "var(--color-muted)",
            }}
          >
            {isKo ? "월간" : "Monthly"}
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("yearly")}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={{
              background: isYearly
                ? "var(--color-foreground)"
                : "transparent",
              color: isYearly
                ? "var(--color-background)"
                : "var(--color-muted)",
            }}
          >
            {isKo ? "연간" : "Yearly"}
          </button>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
        >
          -17%
        </span>
      </div>

      <div className="grid w-full gap-6 sm:grid-cols-2">
        {/* Free tier */}
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Free</h2>
          <p className="mt-1 text-2xl font-bold">
            {isKo ? "₩0" : "$0"}
            <span className="text-sm font-normal text-muted">
              /{isKo ? "월" : "mo"}
            </span>
          </p>
          <ul className="mt-6 space-y-3">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <CheckIcon className="size-4 text-muted" strokeWidth={2} />
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => router.push(`/${lang}/browse`)}
            className="mt-6 w-full rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
          >
            {isKo ? "무료 시작" : "Start free"}
          </button>
        </div>

        {/* Pro tier */}
        <div className="relative rounded-lg border-2 border-accent bg-surface p-6">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-white">
            {isKo ? "★ 추천" : "★ Recommended"}
          </span>
          <h2 className="text-lg font-semibold">Pro</h2>
          <p className="mt-1 text-2xl font-bold">
            {proPrice}
            <span className="text-sm font-normal text-muted">
              /{proPeriod}
            </span>
          </p>
          {isYearly && (
            <p className="mt-0.5 text-xs text-muted">
              <span className="line-through opacity-50">
                {isKo ? "₩9,900" : "$9.90"}
              </span>{" "}
              {isKo ? "월 ₩8,250" : "$8.25/mo"}
            </p>
          )}
          <ul className="mt-6 space-y-3">
            {proFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <CheckIcon className="size-4 text-accent" strokeWidth={2} />
                {feature}
              </li>
            ))}
          </ul>
          {error ? (
            <p className="mt-4 text-xs text-red-500">{error}</p>
          ) : null}
          {tier === "pro" ? (
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-md bg-foreground/10 px-4 py-2 text-sm font-medium text-muted"
            >
              {isKo ? "구독 중" : "Current plan"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="mt-6 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? isKo
                  ? "결제 준비 중..."
                  : "Preparing checkout..."
                : isKo
                  ? "구독 시작"
                  : "Subscribe"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
