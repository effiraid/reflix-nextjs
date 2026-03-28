"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { getMediaUrl } from "@/lib/mediaUrl";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface LandingHeroProps {
  lang: Locale;
  clips: BrowseClipRecord[];
  dict: {
    heroTitle: string;
    heroTitleMobile?: string;
    heroTitleMobileCompact?: string;
    heroSub: string;
    heroSubMobile?: string;
    heroCta: string;
    heroCtaSub: string;
    heroPills: string;
    [key: string]: string | undefined;
  };
}

const getServerMobileSnapshot = () => false;

function subscribeToBreakpoint(query: string, onStoreChange: () => void) {
  const mql = window.matchMedia(query);
  const handler = () => onStoreChange();
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}

function getBreakpointSnapshot(query: string) {
  return window.matchMedia(query).matches;
}

// Stable references to prevent useSyncExternalStore re-subscription every render
const subscribeMobile = (cb: () => void) => subscribeToBreakpoint("(max-width: 768px)", cb);
const getMobileSnapshot = () => getBreakpointSnapshot("(max-width: 768px)");
const subscribeCompact = (cb: () => void) => subscribeToBreakpoint("(max-width: 360px)", cb);
const getCompactSnapshot = () => getBreakpointSnapshot("(max-width: 360px)");

function MockBrowseUI({ clips }: { clips: BrowseClipRecord[] }) {
  const gridClips = clips.slice(0, 8);
  const previewClip = clips[0];

  return (
    <div
      className="mx-auto mt-8 hidden max-w-[960px] overflow-hidden rounded-xl md:block"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex" style={{ height: 340 }}>
        {/* Left panel — folders */}
        <div
          className="flex w-[180px] shrink-0 flex-col gap-1.5 p-3"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {["이동", "교전", "피격", "대화", "연출"].map((label) => (
            <div
              key={label}
              className="rounded-md px-3 py-1.5 text-[12px] text-[#666]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Center — clip grid with real thumbnails */}
        <div className="flex-1 overflow-hidden p-3">
          <div className="grid grid-cols-4 gap-2">
            {gridClips.map((clip, i) => (
              <div
                key={`${clip.id}-mock-${i}`}
                className="overflow-hidden rounded-md"
                style={{
                  aspectRatio: "16/9",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <img
                  data-testid="landing-hero-mock-grid-preview"
                  src={getMediaUrl(clip.thumbnailUrl)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — inspector */}
        <div
          className="flex w-[220px] shrink-0 flex-col p-3"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Preview thumbnail */}
          <div className="overflow-hidden rounded-md" style={{ aspectRatio: "16/9" }}>
            {previewClip && (
              <img
                data-testid="landing-hero-mock-inspector-preview"
                src={getMediaUrl(previewClip.thumbnailUrl)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Metadata skeleton */}
          <div className="mt-3 space-y-2">
            <div
              className="h-3 rounded"
              style={{ background: "rgba(255,255,255,0.1)", width: "80%" }}
            />
            <div
              className="h-2.5 rounded"
              style={{ background: "rgba(255,255,255,0.06)", width: "60%" }}
            />
            <div
              className="h-2.5 rounded"
              style={{ background: "rgba(255,255,255,0.04)", width: "45%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHero({ lang, clips, dict }: LandingHeroProps) {
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerMobileSnapshot);
  const isCompactMobile = useSyncExternalStore(subscribeCompact, getCompactSnapshot, getServerMobileSnapshot);

  const gridCols = isMobile ? 3 : 5;
  const gridRows = isMobile ? 2 : 3;
  const visibleClips = clips.slice(0, gridCols * gridRows);
  const pills = dict.heroPills.split(",");
  const heroTitleText = isCompactMobile
    ? dict.heroTitleMobileCompact ?? dict.heroTitleMobile ?? dict.heroTitle
    : isMobile
      ? dict.heroTitleMobile ?? dict.heroTitle
      : dict.heroTitle;
  const heroSubText = isMobile ? dict.heroSubMobile ?? dict.heroSub : dict.heroSub;

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-10 pt-28 md:px-8 md:pt-24">
      {/* Background clip grid */}
      <div
        className="absolute inset-0 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          opacity: 0.35,
        }}
      >
        {visibleClips.map((clip, i) => (
          <div key={`${clip.id}-${i}`} className="relative overflow-hidden">
            <video
              src={getMediaUrl(clip.previewUrl)}
              poster={getMediaUrl(clip.thumbnailUrl)}
              muted
              autoPlay
              loop
              playsInline
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(8,9,10,0.3) 0%, rgba(8,9,10,0.95) 100%)",
        }}
      />

      {/* Purple glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "80%",
          height: "60%",
          background:
            "radial-gradient(ellipse, rgba(60,50,120,0.12), transparent)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto text-center" style={{ maxWidth: 600 }}>
        <h1
          className="whitespace-pre-line font-bold tracking-tight"
          style={{
            fontSize: isMobile ? "clamp(20px, 6.5vw, 26px)" : 52,
            letterSpacing: isMobile ? "-0.6px" : "-0.03em",
            lineHeight: 1.12,
            textWrap: isMobile ? "wrap" : "balance",
            wordBreak: "keep-all",
            background: "linear-gradient(180deg, #fff 30%, rgba(255,255,255,0.45) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {heroTitleText}
        </h1>

        <p
          className="mx-auto whitespace-pre-line"
          style={{ wordBreak: "keep-all", color: "rgba(255,255,255,0.45)", fontSize: "clamp(14px, 2vw, 16px)", maxWidth: 440, marginTop: 20, lineHeight: 1.65 }}
        >
          {heroSubText}
        </p>

        <div className="flex flex-col items-center" style={{ gap: 10, marginTop: 8 }}>
          <Link
            href={`/${lang}/browse`}
            className="inline-block rounded-full bg-white px-8 py-3 text-[16px] font-semibold text-black transition-opacity hover:opacity-80"
          >
            {dict.heroCta}
          </Link>
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>{dict.heroCtaSub}</span>
        </div>

        {/* Category pills */}
        <div className="mx-auto flex flex-wrap justify-center" style={{ gap: 8, marginTop: 12, maxWidth: 600 }}>
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                color: "rgba(255,255,255,0.5)",
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      </div>

      {/* Product screenshot */}
      <div className="relative z-10 w-full">
        <MockBrowseUI clips={clips} />
      </div>
    </section>
  );
}
