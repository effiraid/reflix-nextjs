"use client";

import { useEffect, useRef, useState } from "react";

interface LandingStatsProps {
  clipCount: number;
  aiRecommendationCount: number;
  tagCount: number;
  dict: {
    statsClips: string;
    statsAiRecommendedTags: string;
    statsTags: string;
    [key: string]: string;
  };
}

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(target);
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset to 0 on mount to prepare for animation
    setValue(0);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          observer.disconnect();

          const startTime = performance.now();
          function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOut cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) {
              rafRef.current = requestAnimationFrame(tick);
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return { ref, value };
}

function StatItem({
  target,
  label,
  suffix = "+",
}: {
  target: number;
  label: string;
  suffix?: string;
}) {
  const { ref, value } = useCountUp(target);
  return (
    <div ref={ref} className="text-center">
      <div
        className="text-[48px] font-bold text-white"
        style={{ letterSpacing: "-2px" }}
      >
        {value.toLocaleString()}
        {suffix}
      </div>
      <div className="mt-1 text-[14px] text-[#777]">{label}</div>
    </div>
  );
}

export function LandingStats({
  clipCount,
  aiRecommendationCount,
  tagCount,
  dict,
}: LandingStatsProps) {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-8">
        <StatItem target={clipCount} label={dict.statsClips} />
        <StatItem
          target={aiRecommendationCount}
          label={dict.statsAiRecommendedTags}
        />
        <StatItem target={tagCount} label={dict.statsTags} />
      </div>
    </section>
  );
}
