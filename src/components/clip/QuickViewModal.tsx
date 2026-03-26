"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { VideoPlayer, PLAYBACK_SPEEDS } from "@/components/clip/VideoPlayer";
import { ShareButton } from "@/components/clip/ShareButton";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { formatClipDuration } from "@/lib/clipInspector";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { ClipIndex, Locale } from "@/lib/types";


interface QuickViewModalProps {
  clip: ClipIndex;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
  onClose: () => void;
}

export function QuickViewModal({
  clip,
  lang,
  dict,
  onClose,
}: QuickViewModalProps) {
  const [playbackState, setPlaybackState] = useState(() => ({
    clipId: clip.id,
    rate: 1,
  }));
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const playbackRate = playbackState.clipId === clip.id ? playbackState.rate : 1;
  const setPlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackState({ clipId: clip.id, rate });
    },
    [clip.id]
  );

  const stepSpeed = useCallback((direction: 1 | -1) => {
    setPlaybackState((prev) => {
      const currentRate = prev.clipId === clip.id ? prev.rate : 1;
      const idx = PLAYBACK_SPEEDS.indexOf(currentRate);
      const nextIdx = Math.min(PLAYBACK_SPEEDS.length - 1, Math.max(0, idx + direction));
      return {
        clipId: clip.id,
        rate: PLAYBACK_SPEEDS[nextIdx],
      };
    });
  }, [clip.id]);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      { key: "Escape", action: onClose },
      { key: "-", action: () => stepSpeed(-1), allowRepeat: true },
      { key: "+", action: () => stepSpeed(1), allowRepeat: true },
      { key: "=", action: () => stepSpeed(1), allowRepeat: true },
    ],
    [onClose, stepSpeed]
  );
  useKeyboardShortcuts(shortcuts);

  useLayoutEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      data-testid="quick-view-backdrop"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={clip.name}
        tabIndex={-1}
        className="w-full max-w-5xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,2fr)_320px]">
          <VideoPlayer
            videoUrl={`/videos/${clip.id}.mp4`}
            thumbnailUrl={clip.thumbnailUrl}
            duration={clip.duration}
            autoPlayMuted
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
          />

          <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/40 p-4">
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                {dict.clip.tags}
              </h3>
              <div className="flex flex-wrap gap-2">
                {clip.tags.length > 0 ? (
                  clip.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm italic text-muted">-</span>
                )}
              </div>
            </section>

            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">{dict.clip.rating}</dt>
                <dd className="font-medium">
                  {"★".repeat(clip.star)}
                  {"☆".repeat(Math.max(0, 5 - clip.star))}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">{dict.clip.duration}</dt>
                <dd className="font-medium">{formatClipDuration(clip.duration)}</dd>
              </div>
            </dl>

            <div className="mt-auto flex gap-2">
              <ShareButton
                clipId={clip.id}
                lang={lang}
                label={dict.clip.share}
                copiedLabel={dict.clip.copied}
                className="flex flex-1 items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface/80"
              />
              <Link
                href={`/${lang}/clip/${clip.id}`}
                className="flex-1 rounded-full bg-foreground px-4 py-2 text-center text-sm font-medium text-background hover:bg-foreground/90"
              >
                {dict.clip.detail}
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
