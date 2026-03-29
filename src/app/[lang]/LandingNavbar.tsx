"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";

interface LandingNavbarProps {
  lang: Locale;
  dict: {
    navCta: string;
    [key: string]: string;
  };
  navDict: { browse: string };
  pricingDict: { title: string };
}

export function LandingNavbar({
  lang,
  dict,
  navDict,
  pricingDict,
}: LandingNavbarProps) {
  const otherLang = lang === "ko" ? "en" : "ko";
  const otherLangLabel = lang === "ko" ? "English" : "한국어";
  const [sheetOpen, setSheetOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // ESC to close
  useEffect(() => {
    if (!sheetOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sheetOpen, closeSheet]);

  // Focus trap
  useEffect(() => {
    if (!sheetOpen || !sheetRef.current) return;
    const sheet = sheetRef.current;
    const focusable = sheet.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [sheetOpen]);

  // Return focus to hamburger on close
  useEffect(() => {
    if (!sheetOpen) {
      hamburgerRef.current?.focus();
    }
  }, [sheetOpen]);

  const handleSheetPricingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    closeSheet();
    setTimeout(() => {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    }, 250);
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
        style={{
          height: 56,
          background: "rgba(8,9,10,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Left: Logo + Brand */}
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-md text-[15px] font-bold text-white"
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            }}
          >
            R
          </div>
          <span className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>
            Reflix
          </span>
        </Link>

        {/* Right: Nav links + Auth + CTA */}
        <div className="flex items-center" style={{ gap: 2 }}>
          {/* Desktop nav links */}
          <Link
            href={`/${lang}/browse`}
            className="hidden md:flex items-center px-3 transition-colors hover:text-white rounded-md"
            style={{
              minHeight: 36,
              padding: "8px 14px",
              fontSize: "13.5px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {navDict.browse}
          </Link>
          <a
            href="#pricing"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hidden md:flex items-center transition-colors hover:text-white rounded-md cursor-pointer"
            style={{
              minHeight: 36,
              padding: "8px 14px",
              fontSize: "13.5px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {pricingDict.title}
          </a>

          {/* Divider — desktop only */}
          <div
            className="hidden md:block h-4"
            style={{
              width: 1,
              background: "rgba(255,255,255,0.08)",
              margin: "0 6px",
            }}
          />

          <Link
            href={`/${otherLang}`}
            className="hidden md:flex items-center gap-1.5 transition-colors hover:text-white rounded-md"
            style={{
              minHeight: 36,
              padding: "8px 12px",
              fontSize: "13px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {otherLangLabel}
          </Link>

          {/* Desktop CTA */}
          <Link
            href={`/${lang}/browse`}
            className="hidden md:flex items-center bg-white text-black font-semibold transition-opacity hover:opacity-80"
            style={{
              minHeight: 34,
              padding: "7px 18px",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              borderRadius: 8,
            }}
          >
            {dict.navCta}
          </Link>

          {/* Mobile: CTA + Hamburger */}
          <Link
            href={`/${lang}/browse`}
            className="md:hidden flex items-center bg-white text-black font-semibold transition-opacity hover:opacity-80"
            style={{
              minHeight: 34,
              padding: "7px 14px",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              borderRadius: 8,
            }}
          >
            {dict.navCta}
          </Link>

          <button
            ref={hamburgerRef}
            className="md:hidden flex items-center justify-center rounded-md"
            style={{ width: 36, height: 36 }}
            onClick={() => setSheetOpen(true)}
            aria-label="메뉴 열기"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {sheetOpen ? (
      <>
      {/* Mobile Bottom Sheet */}
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 transition-colors duration-250"
        onClick={closeSheet}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        className="fixed bottom-0 left-0 right-0 z-[101] transition-transform duration-300"
        style={{
          background: "#111214",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: "12px 24px calc(env(safe-area-inset-bottom, 16px) + 16px)",
          transform: "translateY(0)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Drag handle (visual only) */}
        <div
          style={{
            width: 32,
            height: 4,
            background: "rgba(255,255,255,0.15)",
            borderRadius: 2,
            margin: "0 auto 20px",
          }}
        />

        <div className="flex flex-col gap-1">
          <Link
            href={`/${lang}/browse`}
            className="flex items-center rounded-xl transition-colors"
            style={{
              padding: "14px 16px",
              fontSize: 15,
              fontWeight: 400,
              color: "rgba(255,255,255,0.85)",
              minHeight: 48,
            }}
            onClick={closeSheet}
          >
            {navDict.browse}
          </Link>
          <a
            href="#pricing"
            className="flex items-center rounded-xl transition-colors cursor-pointer"
            style={{
              padding: "14px 16px",
              fontSize: 15,
              fontWeight: 400,
              color: "rgba(255,255,255,0.85)",
              minHeight: 48,
            }}
            onClick={handleSheetPricingClick}
          >
            {pricingDict.title}
          </a>

          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "8px 0" }} />

          <Link
            href={`/${otherLang}`}
            className="flex items-center gap-2 rounded-xl transition-colors"
            style={{
              padding: "14px 16px",
              fontSize: 15,
              fontWeight: 400,
              color: "rgba(255,255,255,0.85)",
              minHeight: 48,
            }}
            onClick={closeSheet}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {otherLangLabel}
          </Link>

          <Link
            href={`/${lang}/browse`}
            className="flex items-center justify-center bg-white text-black font-semibold rounded-xl transition-colors"
            style={{
              padding: "14px 18px",
              fontSize: 15,
              fontWeight: 600,
              minHeight: 48,
              marginTop: 4,
            }}
            onClick={closeSheet}
          >
            {dict.navCta}
          </Link>
        </div>
      </div>
      </>
      ) : null}
    </>
  );
}
