"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import {
  getClipRatingCacheKey,
  useClipRatingStore,
} from "@/stores/clipRatingStore";
import {
  fetchClipRating,
  saveClipRating,
} from "@/lib/clipRatingClient";
import type { Locale } from "@/lib/types";

interface ClipRatingPanelProps {
  clipId: string;
  lang: Locale;
}

const LABELS = {
  ko: {
    myRating: "내 평가",
    rating: "평가",
    memo: "메모",
    saved: "저장됨",
    loginPrompt: "로그인하면 별점과 메모를 남길 수 있어요",
    placeholder: "이 클립에 대한 메모를 남겨보세요",
  },
  en: {
    myRating: "My Rating",
    rating: "Rating",
    memo: "Memo",
    saved: "Saved",
    loginPrompt: "Sign in to rate clips and leave notes",
    placeholder: "Leave a note about this clip",
  },
};

const MEMO_DEBOUNCE_MS = 800;

export function ClipRatingPanel({ clipId, lang }: ClipRatingPanelProps) {
  const user = useAuthStore((s) => s.user);
  const cacheKey = user ? getClipRatingCacheKey(user.id, clipId) : null;
  const { ratings, loading, setRating, setLoading, clearRating } =
    useClipRatingStore();
  const currentRating = cacheKey ? ratings[cacheKey] : undefined;
  const isLoading = cacheKey ? (loading[cacheKey] ?? false) : false;
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [localMemo, setLocalMemo] = useState("");
  const [saving, setSaving] = useState(false);
  // 1. 별점 저장 피드백: "saved" flash
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef<string | null>(null);
  const queuedRatingRef = useRef<number | null | undefined>(undefined);
  const starSaveInFlightRef = useRef(false);
  // 2. 메모 자동 저장 debounce
  const memoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoSaveInFlightRef = useRef(false);
  // 4. textarea 자동 높이
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = LABELS[lang];

  useEffect(() => {
    if (!user || !cacheKey || fetchedRef.current === cacheKey) return;
    fetchedRef.current = cacheKey;
    setLoading(cacheKey, true);
    fetchClipRating(clipId)
      .then((data) => {
        setRating(cacheKey, data);
      })
      .catch(() => {})
      .finally(() => setLoading(cacheKey, false));
  }, [cacheKey, clipId, setLoading, setRating, user]);

  useEffect(() => {
    fetchedRef.current = null;
    queuedRatingRef.current = undefined;
    starSaveInFlightRef.current = false;
    if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
  }, [cacheKey]);

  useEffect(() => {
    setLocalMemo(currentRating?.memo ?? "");
  }, [cacheKey, currentRating?.memo]);

  // 4. Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [localMemo]);

  // 1. Flash "saved" indicator
  const flashSaved = useCallback(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setShowSaved(true);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
  }, []);

  const persistRating = useCallback(
    async (nextRating: number | null) => {
      if (!user || !cacheKey) return;

      const previousRating = useClipRatingStore.getState().ratings[cacheKey];
      const previousMemo = previousRating?.memo ?? null;

      setRating(cacheKey, {
        rating: nextRating,
        memo: previousMemo,
      });
      starSaveInFlightRef.current = true;
      setSaving(true);

      try {
        const result = await saveClipRating(clipId, nextRating, previousMemo);
        setRating(cacheKey, result);
        flashSaved();
      } catch {
        if (previousRating) {
          setRating(cacheKey, previousRating);
        } else {
          clearRating(cacheKey);
        }
      } finally {
        starSaveInFlightRef.current = false;
        setSaving(false);
      }
    },
    [cacheKey, clearRating, clipId, flashSaved, setRating, user]
  );

  const handleStarClick = useCallback(
    async (star: number) => {
      if (!user || !cacheKey) return;
      if (saving && !starSaveInFlightRef.current) return;

      const activeRating =
        useClipRatingStore.getState().ratings[cacheKey]?.rating ?? null;
      const nextRating = activeRating === star ? null : star;

      if (starSaveInFlightRef.current) {
        queuedRatingRef.current = nextRating;
        return;
      }

      await persistRating(nextRating);

      while (queuedRatingRef.current !== undefined) {
        const queuedRating = queuedRatingRef.current;
        queuedRatingRef.current = undefined;
        await persistRating(queuedRating);
      }
    },
    [cacheKey, persistRating, saving, user]
  );

  // 2. Debounced memo auto-save
  const saveMemo = useCallback(
    async (memo: string) => {
      if (!user || !cacheKey) return;
      if (memoSaveInFlightRef.current) return;
      memoSaveInFlightRef.current = true;
      setSaving(true);
      try {
        const result = await saveClipRating(
          clipId,
          useClipRatingStore.getState().ratings[cacheKey]?.rating ?? null,
          memo || null
        );
        setRating(cacheKey, result);
        flashSaved();
      } catch {
        // ignore
      } finally {
        memoSaveInFlightRef.current = false;
        setSaving(false);
      }
    },
    [cacheKey, clipId, flashSaved, setRating, user]
  );

  const handleMemoChange = useCallback(
    (value: string) => {
      setLocalMemo(value);
      if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
      memoDebounceRef.current = setTimeout(() => saveMemo(value), MEMO_DEBOUNCE_MS);
    },
    [saveMemo]
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
    };
  }, []);

  if (!user) {
    return (
      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <p className="text-xs italic text-muted">{t.loginPrompt}</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <div className="h-6 animate-pulse rounded bg-surface" />
      </section>
    );
  }

  const activeRating = currentRating?.rating ?? 0;

  return (
    <section className="rounded-2xl border border-accent/25 bg-surface/40 p-4">
      <dl className="space-y-3">
        {/* 평가 행 */}
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 text-sm text-muted">
            {t.rating}
            <span
              className={`text-[10px] text-accent transition-opacity duration-300 ${
                showSaved ? "opacity-100" : "opacity-0"
              }`}
              aria-live="polite"
            >
              ✓ {t.saved}
            </span>
          </dt>
          <dd
            className="-mr-1 flex"
            role="radiogroup"
            aria-label={t.rating}
            onMouseLeave={() => setHoveredStar(null)}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= (hoveredStar ?? activeRating);
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={star === activeRating}
                  aria-label={`${star}`}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  className={`px-0.5 text-base transition-colors ${
                    filled
                      ? "text-yellow-400"
                      : "text-muted/30 hover:text-yellow-400/50"
                  }`}
                >
                  {filled ? "★" : "☆"}
                </button>
              );
            })}
          </dd>
        </div>

        {/* 메모 행 */}
        <div>
          <dt className="mb-1.5 text-sm text-muted">{t.memo}</dt>
          <dd>
            <textarea
              ref={textareaRef}
              value={localMemo}
              onChange={(e) => handleMemoChange(e.target.value)}
              placeholder={t.placeholder}
              rows={1}
              className="w-full resize-none overflow-hidden rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted/50 focus:border-accent/40 focus:outline-none"
            />
          </dd>
        </div>
      </dl>

    </section>
  );
}
