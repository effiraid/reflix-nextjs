"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { useIntersectionLoader } from "@/hooks/useIntersectionLoader";
import { getMediaUrl } from "@/lib/mediaUrl";
import { getTagDisplayLabels } from "@/lib/tagDisplay";
import { THUMBNAIL_ASPECT_RATIO } from "@/lib/thumbnailSize";
import { useClipStore } from "@/stores/clipStore";
import { useAuthStore } from "@/stores/authStore";
import { ProBadge } from "@/components/auth/ProBadge";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface ClipCardProps {
  clip: BrowseClipRecord;
  lang?: Locale;
  tagI18n?: Record<string, string>;
  enablePreview?: boolean; // false → stop at static thumbnail, skip video preview
  previewOnHover?: boolean;
  showInfo?: boolean;
  prioritizeThumbnail?: boolean;
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
  onOpenQuickView,
}: ClipCardProps) {
  const { ref, stage, isInView } = useIntersectionLoader();
  const { selectedClipId, setSelectedClipId } = useClipStore();
  const { tier: userTier } = useAuthStore();
  const isSelected = selectedClipId === clip.id;
  const isProClip = (clip.accessTier ?? "pro") === "pro";
  const showProBadge = isProClip && userTier !== "pro";
  const [isHovered, setIsHovered] = useState(false);
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);

  const thumbnailUrl = getMediaUrl(clip.thumbnailUrl);
  const previewUrl = getMediaUrl(clip.previewUrl);
  const previewFailed = failedPreviewUrl === previewUrl;
  const displayTags = getTagDisplayLabels(clip.tags ?? [], lang, tagI18n);

  const handleClick = useCallback(() => {
    if (isSelected) {
      onOpenQuickView?.(clip.id);
      return;
    }

    setSelectedClipId(clip.id);
  }, [clip.id, isSelected, onOpenQuickView, setSelectedClipId]);

  const handleDoubleClick = useCallback(() => {
    setSelectedClipId(clip.id);
    onOpenQuickView?.(clip.id);
  }, [clip.id, onOpenQuickView, setSelectedClipId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const showPreview =
    enablePreview &&
    stage === "webp" &&
    isInView &&
    (!previewOnHover || isHovered) &&
    !previewFailed;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={clip.name}
      aria-pressed={isSelected}
      className={`group relative rounded-lg overflow-hidden cursor-pointer transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-accent bg-black ${
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
          className="h-full w-full object-cover blur-lg scale-110"
          aria-hidden="true"
        />
      )}

      {/* Stage 2: Static WebP thumbnail */}
      {stage !== "lqip" && (
        <Image
          src={thumbnailUrl}
          alt={clip.name}
          width={clip.width}
          height={clip.height}
          loading={prioritizeThumbnail ? "eager" : undefined}
          sizes="33vw"
          className="h-full w-full object-contain"
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
          className="absolute inset-0 w-full h-full object-contain"
          onContextMenu={(e) => e.preventDefault()}
          onError={() => setFailedPreviewUrl(previewUrl)}
        />
      )}

      {showProBadge ? <ProBadge /> : null}

      {showInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <div className="flex items-center justify-between text-xs text-white/60 transition-colors group-hover:text-white">
            <span className="truncate">{displayTags.join(", ")}</span>
            <span>{clip.duration.toFixed(1)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
