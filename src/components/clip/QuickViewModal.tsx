"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VideoPlayer, PLAYBACK_SPEEDS } from "@/components/clip/VideoPlayer";
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
  const [playbackRate, setPlaybackRate] = useState(1);

  // Reset speed when clip changes
  useEffect(() => {
    setPlaybackRate(1);
  }, [clip.id]);

  const stepSpeed = useCallback((direction: 1 | -1) => {
    setPlaybackRate((prev) => {
      const idx = PLAYBACK_SPEEDS.indexOf(prev);
      const nextIdx = Math.min(PLAYBACK_SPEEDS.length - 1, Math.max(0, idx + direction));
      return PLAYBACK_SPEEDS[nextIdx];
    });
  }, []);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      data-testid="quick-view-backdrop"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={clip.name}
        className="w-full max-w-5xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,2fr)_320px]">
          <div className="space-y-4">
            <VideoPlayer
              videoUrl={`/videos/${clip.id}.mp4`}
              thumbnailUrl={clip.thumbnailUrl}
              duration={clip.duration}
              autoPlayMuted
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
            />

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">{clip.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {dict.clip.duration}: {formatClipDuration(clip.duration)}
                </p>
              </div>
              <Link
                href={`/${lang}/clip/${clip.id}`}
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface/80"
              >
                {dict.clip.detail}
              </Link>
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl border border-border bg-surface/40 p-4">
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
          </aside>
        </div>
      </section>
    </div>
  );
}
