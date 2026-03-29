"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import enDict from "@/app/[lang]/dictionaries/en.json";
import { LoginCard } from "@/components/auth/LoginCard";
import { sanitizePostAuthRedirect } from "@/lib/authRedirect";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import type { Locale } from "@/lib/types";

interface PricingModalProps {
  lang: Locale;
}

function CheckIcon() {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground/20 text-foreground"
      style={{ width: 15, height: 15 }}
    >
      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

const ANIMATION_DURATION = 100;

export function PricingModal({ lang }: PricingModalProps) {
  const { pricingModalOpen, pricingModalIntent, closePricingModal } = useUIStore();
  const { user, accessSource } = useAuthStore();
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const isKo = lang === "ko";
  const isYearly = billingInterval === "yearly";
  const isPaidPro = accessSource === "paid";
  const isGuestLockedIntent =
    pricingModalIntent?.kind === "locked-clip" &&
    pricingModalIntent.viewerTier === "guest";
  const isAuthRequiredIntent = pricingModalIntent?.kind === "auth-required";
  const isLoginFlow = !user && (isGuestLockedIntent || isAuthRequiredIntent);
  const modalDict = (lang === "ko" ? koDict : enDict) as typeof koDict;
  const loginNextPath =
    pricingModalIntent?.nextPath
      ? sanitizePostAuthRedirect(pricingModalIntent.nextPath, `/${lang}/browse`)
      : `/${lang}/browse`;

  useEffect(() => {
    if (pricingModalOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [pricingModalOpen]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      closePricingModal();
      setIsClosing(false);
    }, ANIMATION_DURATION);
  }, [isClosing, closePricingModal]);

  useEffect(() => {
    if (!pricingModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pricingModalOpen, handleClose]);

  useEffect(() => {
    if (!pricingModalOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [pricingModalOpen]);

  useEffect(() => {
    if (pricingModalOpen && user && (isGuestLockedIntent || isAuthRequiredIntent)) {
      handleClose();
    }
  }, [handleClose, isAuthRequiredIntent, isGuestLockedIntent, pricingModalOpen, user]);

  const handleSubscribe = useCallback(async () => {
    if (!user) {
      handleClose();
      router.push(`/${lang}/login`);
      return;
    }
    if (isPaidPro || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, interval: billingInterval }),
      });
      if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [user, isPaidPro, loading, lang, billingInterval, handleClose, router]);

  const handleFreeStart = useCallback(() => {
    handleClose();
    if (!user) {
      const nextPath =
        pricingModalIntent?.kind === "locked-clip" && pricingModalIntent.nextPath
          ? sanitizePostAuthRedirect(pricingModalIntent.nextPath, `/${lang}/browse`)
          : `/${lang}/browse`;
      router.push(`/${lang}/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [handleClose, lang, pricingModalIntent, router, user]);

  if (!pricingModalOpen && !isClosing) return null;

  const backdropAnimation = isClosing
    ? "motion-safe:animate-[modalBackdropOut_100ms_ease-in_forwards]"
    : "motion-safe:animate-[modalBackdropIn_100ms_ease-out]";

  const contentAnimation = isClosing
    ? "motion-safe:animate-[modalContentOut_80ms_ease-in_forwards]"
    : "motion-safe:animate-[modalContentIn_80ms_cubic-bezier(0.16,1,0.3,1)]";

  const freeFeatures = isKo
    ? ["원본 영상 재생", "탐색 결과 5개까지", "보드 1개", "태그 검색"]
    : ["Full video playback", "Up to 5 visible results", "1 board", "Tag search"];
  const proFeatures = isKo
    ? ["전체 탐색 결과 보기", "다중 필터 조합", "무제한 보드", "AI 검색"]
    : ["All browse results", "Multi-filter combinations", "Unlimited boards", "AI search"];

  const proPrice = isYearly
    ? (isKo ? "₩99,000" : "$99")
    : (isKo ? "₩9,900" : "$9.90");
  const proPeriod = isYearly
    ? (isKo ? "/년" : "/yr")
    : (isKo ? "/월" : "/mo");
  const yearlySavingsNote = (
    <>
      <span className="text-muted/60 line-through">{isKo ? "₩9,900" : "$9.90"}</span>{" "}
      <span className="text-muted">{isKo ? "₩8,250/월" : "$8.25/mo"}</span>
    </>
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 dark:bg-black/70 will-change-[opacity] ${backdropAnimation}`}
      onClick={handleClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isLoginFlow ? (isKo ? "로그인" : "Sign in") : isKo ? "요금제" : "Pricing"}
        tabIndex={-1}
        className={`relative max-h-[calc(100vh-2rem)] w-full ${isLoginFlow ? "max-w-md" : "max-w-2xl"} overflow-y-auto rounded-2xl bg-background outline-none will-change-[transform,opacity] ${contentAnimation}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full bg-foreground/[0.06] text-sm text-muted transition-colors hover:text-foreground"
          aria-label="Close"
        >
          ✕
        </button>

        {isLoginFlow ? (
          <div className="px-6 pb-6 pt-8">
            <LoginCard
              lang={lang}
              dict={modalDict}
              nextPath={loginNextPath}
            />
          </div>
        ) : (
        <div className="px-6 pb-6 pt-8 md:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground" style={{ letterSpacing: "-0.5px" }}>
              {isKo ? "요금제" : "Pricing"}
            </h2>
            <p className="mt-1.5 text-[13px] text-muted">
              {isKo
                ? "게임 애니메이션 레퍼런스를 자유롭게 탐색"
                : "Explore game animation references freely"}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <div className="inline-flex rounded-full border border-foreground/[0.08] bg-foreground/[0.04] p-1">
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                  !isYearly ? "bg-foreground text-background" : "text-muted"
                }`}
              >
                {isKo ? "월간" : "Monthly"}
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("yearly")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  isYearly ? "bg-foreground text-background" : "text-muted"
                }`}
              >
                <span>{isKo ? "연간" : "Yearly"}</span>
                <span
                  aria-hidden="true"
                  className={`whitespace-nowrap rounded-full px-1.5 py-1 text-[10px] font-semibold leading-none ${
                    isYearly
                      ? "bg-green-500/15 text-green-300 dark:text-green-700"
                      : "bg-green-500/12 text-green-600 dark:text-green-400"
                  }`}
                >
                  -17%
                </span>
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row">
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-lg font-semibold text-foreground">Free</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">{isKo ? "₩0" : "$0"}</span>
              </div>
              <p className="mt-1.5 text-[13px] text-muted">
                {isKo ? "무료로 시작하세요" : "Start for free"}
              </p>
              <div className="my-5 h-px bg-border" />
              <ul className="flex flex-1 flex-col gap-2.5">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-muted">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleFreeStart}
                className="mt-6 block rounded-full border border-border py-2 text-center text-[13px] font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                {!user
                  ? isKo
                    ? "무료 시작"
                    : "Start free"
                  : isKo
                    ? "현재 플랜"
                    : "Current plan"}
              </button>
            </div>

            <div className="hidden w-px bg-border md:block" style={{ marginTop: 24, marginBottom: 24 }} />
            <div className="h-px bg-border md:hidden" style={{ marginLeft: 24, marginRight: 24 }} />

            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">Pro</h3>
                <span className="rounded-full border border-brand/30 bg-brand/25 px-2 py-0.5 text-[11px] font-medium text-foreground">
                  {isKo ? "★ 추천" : "★ Best"}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">{proPrice}</span>
                <span className="text-[13px] text-muted">{proPeriod}</span>
              </div>
              {isYearly && (
                <p
                  data-testid="pricing-modal-pro-billing-note"
                  className="mt-1 text-[12px]"
                >
                  {yearlySavingsNote}
                </p>
              )}
              <p className="mt-1.5 text-[13px] text-muted">
                {isKo
                  ? "모든 클립에 무제한 접근"
                  : "Unlimited access to all clips"}
              </p>
              {!isYearly && (
                <div
                  aria-hidden="true"
                  data-testid="pricing-modal-pro-billing-spacer"
                  className="mt-1"
                  style={{ height: 18 }}
                />
              )}
              <div className="my-5 h-px bg-border" />
              <ul className="flex flex-1 flex-col gap-2.5">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-muted">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isPaidPro || loading}
                className="mt-6 block rounded-full bg-foreground py-2 text-center text-[13px] font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading
                  ? (isKo ? "결제 준비 중..." : "Preparing...")
                  : isPaidPro
                    ? (isKo ? "구독 중" : "Current plan")
                    : (isKo ? "구독 시작" : "Subscribe")}
              </button>
            </div>
          </div>
        </div>
        )}
      </section>
    </div>
  );
}
