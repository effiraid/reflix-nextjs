"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ClipDetailsPanel } from "@/components/clip/ClipDetailsPanel";
import { VideoPlayer, PLAYBACK_SPEEDS } from "@/components/clip/VideoPlayer";
import { ShareButton } from "@/components/clip/ShareButton";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { useClipDetail } from "@/hooks/useClipDetail";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { BrowseClipRecord, CategoryTree, Locale } from "@/lib/types";


interface QuickViewModalProps {
  clip: BrowseClipRecord;
  categories: CategoryTree;
  lang: Locale;
  tagI18n?: Record<string, string>;
  dict: Pick<Dictionary, "clip">;
  onClose: () => void;
}

export function QuickViewModal({
  clip,
  categories,
  lang,
  tagI18n = {},
  dict,
  onClose,
}: QuickViewModalProps) {
  const { clip: detailClip } = useClipDetail(clip.id);
  const [playbackState, setPlaybackState] = useState(() => ({
    clipId: clip.id,
    rate: 1,
  }));
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const playbackRate = playbackState.clipId === clip.id ? playbackState.rate : 1;
  const videoUrl = detailClip?.videoUrl ?? `/videos/${clip.id}.mp4`;
  const thumbnailUrl = detailClip?.thumbnailUrl ?? clip.thumbnailUrl;
  const duration = detailClip?.duration ?? clip.duration;
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
        <div className="grid gap-6 p-6 lg:items-start lg:grid-cols-[minmax(0,2fr)_320px]">
          <VideoPlayer
            videoUrl={videoUrl}
            thumbnailUrl={thumbnailUrl}
            duration={duration}
            autoPlayMuted
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
          />

          <ClipDetailsPanel
            clip={detailClip ?? clip}
            categories={categories}
            lang={lang}
            tagI18n={tagI18n}
            dict={dict}
            footer={(
              <div className="flex gap-2">
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
            )}
          />
        </div>
      </section>
    </div>
  );
}
