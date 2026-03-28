"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { LockIcon } from "lucide-react";
import { useIntersectionLoader } from "@/hooks/useIntersectionLoader";
import { getMediaUrl } from "@/lib/mediaUrl";
import { getTagDisplayLabels } from "@/lib/tagDisplay";
import { THUMBNAIL_ASPECT_RATIO } from "@/lib/thumbnailSize";
import { useClipStore } from "@/stores/clipStore";
import { useUIStore } from "@/stores/uiStore";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface ClipCardProps {
  clip: BrowseClipRecord;
  lang?: Locale;
  tagI18n?: Record<string, string>;
  enablePreview?: boolean; // false → stop at static thumbnail, skip video preview
  previewOnHover?: boolean;
  showInfo?: boolean;
  prioritizeThumbnail?: boolean;
  locked?: boolean;
  onOpenQuickView?: (clipId: string) => void;
}

export function ClipCard({
  clip,
  lang = "ko",
  tagI18n = {},
  enablePreview = true,
  previewOnHover = false,
  showInfo = true,
  prioritizeThumbnail = false,
  locked = false,
  onOpenQuickView,
}: ClipCardProps) {
  const { ref, stage, isInView } = useIntersectionLoader();
  const isSelected = useClipStore((s) => s.selectedClipId === clip.id);
  const setSelectedClipId = useClipStore((s) => s.setSelectedClipId);
  const openPricingModal = useUIStore((s) => s.openPricingModal);
  const [isHovered, setIsHovered] = useState(false);
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);

  const thumbnailUrl = getMediaUrl(clip.thumbnailUrl);
  const previewUrl = getMediaUrl(clip.previewUrl);
  const previewFailed = failedPreviewUrl === previewUrl;
  const displayTags = getTagDisplayLabels(clip.tags ?? [], lang, tagI18n);
  const lockedMediaClass = locked ? " blur-lg scale-110" : "";

  const handleClick = useCallback(() => {
    if (locked) {
      openPricingModal();
      return;
    }

    if (isSelected) {
      onOpenQuickView?.(clip.id);
      return;
    }

    setSelectedClipId(clip.id);
  }, [clip.id, isSelected, locked, onOpenQuickView, openPricingModal, setSelectedClipId]);

  const handleDoubleClick = useCallback(() => {
    if (locked) {
      openPricingModal();
      return;
    }

    setSelectedClipId(clip.id);
    onOpenQuickView?.(clip.id);
  }, [clip.id, locked, onOpenQuickView, openPricingModal, setSelectedClipId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (locked) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPricingModal();
        }
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick, locked, openPricingModal]
  );

  const showPreview =
    enablePreview &&
    stage === "webp" &&
    isInView &&
    (!previewOnHover || isHovered) &&
    !previewFailed &&
    !!previewUrl;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-label={clip.name}
      aria-pressed={isSelected}
      aria-disabled={locked ? "true" : undefined}
      className={`group relative overflow-hidden rounded-lg bg-black transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        locked ? "cursor-not-allowed" : "cursor-pointer"
      } ${
        isSelected ? "ring-2 ring-accent" : "hover:shadow-lg"
      }`}
      style={{ aspectRatio: THUMBNAIL_ASPECT_RATIO }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Stage 1: LQIP blur placeholder */}
      {stage === "lqip" && clip.lqipBase64 && (
        <Image
          src={clip.lqipBase64}
          alt=""
          width={clip.width}
          height={clip.height}
          unoptimized
          sizes="33vw"
          className={`h-full w-full object-cover blur-lg scale-110${lockedMediaClass}`}
          aria-hidden="true"
        />
      )}

      {/* Stage 2: Static WebP thumbnail */}
      {stage !== "lqip" && thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt={clip.name ?? ""}
          width={clip.width}
          height={clip.height}
          loading={prioritizeThumbnail ? "eager" : undefined}
          sizes="33vw"
          className={`h-full w-full object-contain${lockedMediaClass}`}
        />
      )}

      {/* Stage 3: Short MP4 loop preview — immediate when zoomed in, hover-triggered when zoomed out */}
      {showPreview && (
        <video
          src={previewUrl}
          muted
          autoPlay
          loop
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className={`absolute inset-0 h-full w-full object-contain${lockedMediaClass}`}
          onContextMenu={(e) => e.preventDefault()}
          onError={() => setFailedPreviewUrl(previewUrl)}
        />
      )}

      {locked ? (
        <div
          data-testid="clip-lock-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10"
        >
          <div className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-black/32 backdrop-blur-[2px]">
            <LockIcon className="size-3.5 text-white/80" strokeWidth={2.1} />
          </div>
        </div>
      ) : null}

      {showInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <div className="flex items-center justify-between text-xs text-white/60 transition-colors group-hover:text-white">
            <span className="truncate">{displayTags.join(", ")}</span>
            <span>{(clip.duration ?? 0).toFixed(1)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
