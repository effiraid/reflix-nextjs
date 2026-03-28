"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import type { Locale } from "@/lib/types";

interface PricingModalProps {
  lang: Locale;
}

function CheckIcon() {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: 15, height: 15, background: "#333" }}
    >
      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function PricingModal({ lang }: PricingModalProps) {
  const { pricingModalOpen, closePricingModal } = useUIStore();
  const { user, tier } = useAuthStore();
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const isKo = lang === "ko";
  const isYearly = billingInterval === "yearly";
  const isPro = tier === "pro";

  useEffect(() => {
    if (pricingModalOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [pricingModalOpen]);

  useEffect(() => {
    if (!pricingModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePricingModal();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pricingModalOpen, closePricingModal]);

  useEffect(() => {
    if (!pricingModalOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [pricingModalOpen]);

  const handleSubscribe = useCallback(async () => {
    if (!user) {
      closePricingModal();
      router.push(`/${lang}/login`);
      return;
    }
    if (isPro || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, interval: billingInterval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }, [user, isPro, loading, lang, billingInterval, closePricingModal, router]);

  if (!pricingModalOpen) return null;

  const freeFeatures = isKo
    ? ["50개 무료 클립", "20회/일 조회", "보드 1개"]
    : ["50 free clips", "20 views/day", "1 board"];
  const proFeatures = isKo
    ? ["전체 라이브러리", "무제한 조회", "무제한 보드"]
    : ["Full library", "Unlimited views", "Unlimited boards"];

  const proPrice = isYearly
    ? (isKo ? "₩99,000" : "$99")
    : (isKo ? "₩9,900" : "$9.90");
  const proPeriod = isYearly
    ? (isKo ? "/년" : "/yr")
    : (isKo ? "/월" : "/mo");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={closePricingModal}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isKo ? "요금제" : "Pricing"}
        tabIndex={-1}
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl outline-none"
        style={{ background: "#0a0a0a" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closePricingModal}
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-sm text-[#888] transition-colors hover:text-white"
          style={{ background: "rgba(255,255,255,0.06)" }}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="px-6 pb-6 pt-8 md:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.5px" }}>
              {isKo ? "요금제" : "Pricing"}
            </h2>
            <p className="mt-1.5 text-[13px] text-[#777]">
              {isKo ? "게임 애니메이션 레퍼런스를 자유롭게 탐색" : "Explore game animation references freely"}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <div
              className="inline-flex rounded-full p-1"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-all"
                style={{ background: !isYearly ? "white" : "transparent", color: !isYearly ? "black" : "#666" }}
              >
                {isKo ? "월간" : "Monthly"}
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("yearly")}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all"
                style={{ background: isYearly ? "white" : "transparent", color: isYearly ? "black" : "#666" }}
              >
                <span>{isKo ? "연간" : "Yearly"}</span>
                <span
                  aria-hidden="true"
                  className="whitespace-nowrap rounded-full px-1.5 py-1 text-[10px] font-semibold leading-none"
                  style={{
                    background: isYearly ? "rgba(22,101,52,0.12)" : "rgba(34,197,94,0.12)",
                    color: isYearly ? "#166534" : "#22c55e",
                  }}
                >
                  -17%
                </span>
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row">
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-lg font-semibold text-white">Free</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">{isKo ? "₩0" : "$0"}</span>
              </div>
              <p className="mt-1.5 text-[13px] text-[#777]">{isKo ? "무료로 시작하세요" : "Start for free"}</p>
              <div className="my-5" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
              <ul className="flex flex-1 flex-col gap-2.5">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-[#999]">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={closePricingModal}
                className="mt-6 block rounded-full py-2 text-center text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {isKo ? "무료 시작" : "Start free"}
              </button>
            </div>

            <div className="hidden md:block" style={{ width: 1, background: "rgba(255,255,255,0.06)", marginTop: 24, marginBottom: 24 }} />
            <div className="md:hidden" style={{ height: 1, background: "rgba(255,255,255,0.06)", marginLeft: 24, marginRight: 24 }} />

            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Pro</h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.3)" }}
                >
                  {isKo ? "★ 추천" : "★ Best"}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">{proPrice}</span>
                <span className="text-[13px] text-[#777]">{proPeriod}</span>
              </div>
              {isYearly && (
                <p className="mt-1 text-[12px] text-[#999]">
                  <span style={{ textDecoration: "line-through", color: "#555" }}>{isKo ? "₩9,900" : "$9.90"}</span>{" "}
                  {isKo ? "₩8,250/월" : "$8.25/mo"}
                </p>
              )}
              <p className="mt-1.5 text-[13px] text-[#777]">{isKo ? "모든 클립에 무제한 접근" : "Unlimited access to all clips"}</p>
              <div className="my-5" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
              <ul className="flex flex-1 flex-col gap-2.5">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-[#999]">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isPro || loading}
                className="mt-6 block rounded-full bg-white py-2 text-center text-[13px] font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading
                  ? (isKo ? "결제 준비 중..." : "Preparing...")
                  : isPro
                    ? (isKo ? "구독 중" : "Current plan")
                    : (isKo ? "구독 시작" : "Subscribe")}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
