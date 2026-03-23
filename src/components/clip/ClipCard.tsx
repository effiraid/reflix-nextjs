"use client";

import { useCallback } from "react";
import Image from "next/image";
import { useIntersectionLoader } from "@/hooks/useIntersectionLoader";
import { useClipStore } from "@/stores/clipStore";
import type { ClipIndex } from "@/lib/types";
import { MEDIA_BASE_URL } from "@/lib/constants";

interface ClipCardProps {
  clip: ClipIndex;
  enablePreview?: boolean; // false → stop at static thumbnail, skip video preview
}

export function ClipCard({ clip, enablePreview = true }: ClipCardProps) {
  const { ref, stage, isInView } = useIntersectionLoader();
  const { selectedClipId, setSelectedClipId } = useClipStore();
  const isSelected = selectedClipId === clip.id;

  const thumbnailUrl = `${MEDIA_BASE_URL}${clip.thumbnailUrl}`;
  const previewUrl = `${MEDIA_BASE_URL}${clip.previewUrl}`;

  const handleClick = useCallback(() => {
    setSelectedClipId(clip.id);
  }, [clip.id, setSelectedClipId]);

  const showPreview = enablePreview && stage === "webp" && isInView;

  return (
    <div
      ref={ref}
      className={`group relative rounded-lg overflow-hidden cursor-pointer transition-shadow ${
        isSelected ? "ring-2 ring-accent" : "hover:shadow-lg"
      }`}
      style={{ aspectRatio: `${clip.width}/${clip.height}` }}
      onClick={handleClick}
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

      {/* Stage 3: Short MP4 loop preview — only when the grid is zoomed in to 1-3 columns */}
      {showPreview && (
        <video
          src={previewUrl}
          muted
          autoPlay
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* Always-visible overlay with clip info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="flex items-center justify-between text-xs text-white/60 transition-colors group-hover:text-white">
          <span className="truncate">{clip.name}</span>
          <span>{clip.duration.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
