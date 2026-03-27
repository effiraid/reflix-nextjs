"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getMediaUrl } from "@/lib/mediaUrl";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface LandingHeroProps {
  lang: Locale;
  clips: BrowseClipRecord[];
  dict: {
    heroTitle: string;
    heroSub: string;
    heroCta: string;
    heroCtaSub: string;
    heroPills: string;
    [key: string]: string;
  };
}

function MockBrowseUI() {
  return (
    <div
      className="mx-auto mt-12 hidden max-w-[900px] overflow-hidden rounded-xl md:block"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex" style={{ height: 320 }}>
        {/* Left panel */}
        <div
          className="flex w-[180px] shrink-0 flex-col gap-2 p-3"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {["이동", "교전", "피격", "대화", "연출"].map((label) => (
            <div
              key={label}
              className="rounded px-2 py-1 text-[12px] text-[#777]"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Center: grid */}
        <div className="flex-1 p-3">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded"
                style={{
                  aspectRatio: "16/9",
                  background: `rgba(255,255,255,${0.03 + i * 0.005})`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div
          className="w-[200px] shrink-0 p-3"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="mb-2 h-24 rounded"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 rounded"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  width: `${70 - i * 15}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHero({ lang, clips, dict }: LandingHeroProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const gridCols = isMobile ? 3 : 5;
  const gridRows = isMobile ? 2 : 3;
  const visibleClips = clips.slice(0, gridCols * gridRows);
  const pills = dict.heroPills.split(",");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-14">
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
            <Image
              src={getMediaUrl(clip.thumbnailUrl)}
              alt=""
              fill
              sizes={`${Math.floor(100 / gridCols)}vw`}
              className="object-cover"
              aria-hidden="true"
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
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h1
          className="font-bold leading-tight tracking-tight text-white"
          style={{
            fontSize: isMobile ? 36 : 52,
            letterSpacing: "-1.5px",
          }}
        >
          {dict.heroTitle.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </h1>

        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-[#777]">
          {dict.heroSub.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href={`/${lang}/browse`}
            className="inline-block rounded-full bg-white px-8 py-3 text-[16px] font-semibold text-black transition-opacity hover:opacity-80"
          >
            {dict.heroCta}
          </Link>
          <span className="text-[12px] text-[#555]">{dict.heroCtaSub}</span>
        </div>

        {/* Category pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full px-3 py-1 text-[12px] text-[#777]"
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
        <MockBrowseUI />
      </div>
    </section>
  );
}
