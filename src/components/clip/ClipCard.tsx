"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useIntersectionLoader } from "@/hooks/useIntersectionLoader";
import { getMediaUrl } from "@/lib/mediaUrl";
import { useClipStore } from "@/stores/clipStore";
import type { ClipIndex } from "@/lib/types";

interface ClipCardProps {
  clip: ClipIndex;
  enablePreview?: boolean; // false → stop at static thumbnail, skip video preview
  previewOnHover?: boolean;
  showInfo?: boolean;
  infoOpacity?: number;
  onOpenQuickView?: (clipId: string) => void;
}

export function ClipCard({
  clip,
  enablePreview = true,
  previewOnHover = false,
  showInfo = true,
  infoOpacity = 1,
  onOpenQuickView,
}: ClipCardProps) {
  const { ref, stage, isInView } = useIntersectionLoader();
  const { selectedClipId, setSelectedClipId } = useClipStore();
  const isSelected = selectedClipId === clip.id;
  const [isHovered, setIsHovered] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const thumbnailUrl = getMediaUrl(clip.thumbnailUrl);
  const previewUrl = getMediaUrl(clip.previewUrl);
  const clampedInfoOpacity = Math.min(1, Math.max(0, infoOpacity));

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUrl]);

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

  const showPreview =
    enablePreview &&
    stage === "webp" &&
    isInView &&
    (!previewOnHover || isHovered) &&
    !previewFailed;

  return (
    <div
      ref={ref}
      className={`group relative rounded-lg overflow-hidden cursor-pointer transition-shadow ${
        isSelected ? "ring-2 ring-accent" : "hover:shadow-lg"
      }`}
      style={{ aspectRatio: `${clip.width}/${clip.height}` }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Stage 1: LQIP blur placeholder */}
      {clip.lqipBase64 && (
        <Image
          src={clip.lqipBase64}
          alt=""
          fill
          unoptimized
          sizes="33vw"
          className="object-cover blur-lg scale-110"
          aria-hidden="true"
        />
      )}

      {/* Stage 2: Static WebP thumbnail */}
      {stage !== "lqip" && (
        <Image
          src={thumbnailUrl}
          alt={clip.name}
          fill
          sizes="33vw"
          className="object-cover"
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
          className="absolute inset-0 w-full h-full object-cover"
          onContextMenu={(e) => e.preventDefault()}
          onError={() => setPreviewFailed(true)}
        />
      )}

      {showInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <div
            className="flex items-center justify-between text-xs text-white/60 transition-colors group-hover:text-white"
            style={{ opacity: clampedInfoOpacity }}
          >
            <span className="truncate">{clip.name}</span>
            <span>{clip.duration.toFixed(1)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
