"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useClipData } from "@/app/[lang]/browse/ClipDataProvider";
import { InspectorSidebarSections } from "@/components/clip/InspectorSidebarSections";
import { VideoPlayer, PLAYBACK_SPEEDS } from "@/components/clip/VideoPlayer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { useClipDetail } from "@/hooks/useClipDetail";
import { useClipStore } from "@/stores/clipStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { BrowseClipRecord, CategoryTree, Clip, Locale } from "@/lib/types";

const ANIMATION_DURATION = 100;

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
  const browseClips = useClipData();
  const { setSelectedClipId } = useClipStore();
  const [playbackState, setPlaybackState] = useState(() => ({
    clipId: clip.id,
    rate: 1,
  }));
  const [isClosing, setIsClosing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const playbackRate = playbackState.clipId === clip.id ? playbackState.rate : 1;
  const videoUrl = detailClip?.videoUrl ?? `/videos/${clip.id}.mp4`;
  const thumbnailUrl = detailClip?.thumbnailUrl ?? clip.thumbnailUrl;
  const duration = detailClip?.duration ?? clip.duration;
  const sidebarClip = useMemo(
    () => detailClip ?? buildQuickViewSidebarClip(clip),
    [clip, detailClip]
  );
  const relatedClips = useMemo(() => {
    if (!detailClip?.relatedClips?.length) {
      return [];
    }

    const browseClipMap = new Map(browseClips.map((entry) => [entry.id, entry] as const));
    return detailClip.relatedClips
      .map((relatedClipId) => browseClipMap.get(relatedClipId))
      .filter((entry): entry is BrowseClipRecord => Boolean(entry));
  }, [browseClips, detailClip]);
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

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(onClose, ANIMATION_DURATION);
  }, [isClosing, onClose]);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      { key: "Escape", action: handleClose },
      { key: "-", action: () => stepSpeed(-1), allowRepeat: true },
      { key: "+", action: () => stepSpeed(1), allowRepeat: true },
      { key: "=", action: () => stepSpeed(1), allowRepeat: true },
    ],
    [handleClose, stepSpeed]
  );
  useKeyboardShortcuts(shortcuts);

  useLayoutEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    dialogRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const backdropAnimation = isClosing
    ? "motion-safe:animate-[modalBackdropOut_100ms_ease-in_forwards]"
    : "motion-safe:animate-[modalBackdropIn_100ms_ease-out]";

  const contentAnimation = isClosing
    ? "motion-safe:animate-[modalContentOut_80ms_ease-in_forwards]"
    : "motion-safe:animate-[modalContentIn_80ms_cubic-bezier(0.16,1,0.3,1)]";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 will-change-[opacity] ${backdropAnimation}`}
      data-testid="quick-view-backdrop"
      onClick={handleClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={clip.name}
        tabIndex={-1}
        className={`max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-background shadow-2xl will-change-[transform,opacity] ${contentAnimation}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          data-testid="quick-view-layout"
          className={`grid gap-6 p-6 lg:items-start ${isExpanded ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,2fr)_320px]"}`}
        >
          <VideoPlayer
            videoUrl={videoUrl}
            thumbnailUrl={thumbnailUrl}
            duration={duration}
            autoPlayMuted
            useBlobUrl
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
            isExpanded={isExpanded}
            onExpandToggle={() => setIsExpanded((prev) => !prev)}
            lang={lang}
          />

          <aside className="flex w-full flex-col gap-5 text-sm text-foreground">
            <InspectorSidebarSections
              clip={sidebarClip}
              categories={categories}
              lang={lang}
              dict={dict}
              tagI18n={tagI18n}
              relatedClips={relatedClips}
              onSelectRelatedClip={setSelectedClipId}
            />
            <Link
              href={`/${lang}/clip/${clip.id}`}
              className="rounded-xl bg-foreground px-4 py-3 text-center text-sm font-medium text-background hover:bg-foreground/90"
            >
              {dict.clip.detail}
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}

function buildQuickViewSidebarClip(clip: BrowseClipRecord): Clip {
  return {
    id: clip.id,
    name: clip.name,
    ext: inferClipExt(clip),
    size: 0,
    width: clip.width,
    height: clip.height,
    duration: clip.duration,
    tags: clip.tags ?? [],
    folders: clip.folders ?? [],
    url: "",
    palettes: [],
    btime: 0,
    mtime: 0,
    i18n: {
      title: {
        ko: clip.name,
        en: clip.name,
      },
      description: {
        ko: "",
        en: "",
      },
    },
    aiTags: clip.aiTags,
    videoUrl: clip.previewUrl,
    thumbnailUrl: clip.thumbnailUrl,
    previewUrl: clip.previewUrl,
    lqipBase64: clip.lqipBase64,
    category: clip.category,
    relatedClips: [],
  };
}

function inferClipExt(clip: BrowseClipRecord): string {
  return extractFileExtension(clip.previewUrl) ?? extractFileExtension(clip.thumbnailUrl) ?? "mp4";
}

function extractFileExtension(path: string): string | null {
  const match = path.match(/\.([a-z0-9]+)(?:$|[?#])/i);
  return match?.[1]?.toLowerCase() ?? null;
}
