"use client";

import { useEffect, useRef, useState } from "react";

type LoadStage = "lqip" | "thumbnail" | "webp";

export function useIntersectionLoader() {
  const ref = useRef<HTMLDivElement>(null);
  const supportsIntersectionObserver =
    typeof IntersectionObserver !== "undefined";
  const [stage, setStage] = useState<LoadStage>("lqip");
  const [isInView, setIsInView] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!supportsIntersectionObserver) {
      setIsInView(true);
      setStage("thumbnail");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          setStage((prev) => (prev === "lqip" ? "thumbnail" : prev));
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setStage("webp");
          }, 300);
        } else {
          setIsInView(false);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          setStage("thumbnail");
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [supportsIntersectionObserver]);

  return { ref, stage, isInView };
}
