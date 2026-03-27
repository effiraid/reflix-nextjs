"use client";

import { useState } from "react";
import Image from "next/image";
import { useIntersectionLoader } from "@/hooks/useIntersectionLoader";
import { getMediaUrl } from "@/lib/mediaUrl";
import type { BrowseClipRecord } from "@/lib/types";

interface LandingClipCardProps {
  clip: BrowseClipRecord;
  autoPlay?: boolean;
  aspectRatio?: string;
  overlay?: React.ReactNode;
  disableVideo?: boolean;
  className?: string;
}

export function LandingClipCard({
  clip,
  autoPlay = false,
  aspectRatio,
  overlay,
  disableVideo = false,
  className = "",
}: LandingClipCardProps) {
  const { ref, stage, isInView } = useIntersectionLoader();
  const [videoFailed, setVideoFailed] = useState(false);

  const thumbnailUrl = getMediaUrl(clip.thumbnailUrl);
  const previewUrl = getMediaUrl(clip.previewUrl);

  const showVideo =
    !disableVideo && autoPlay && stage === "webp" && isInView && !videoFailed;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-lg bg-black/50 ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
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

      {stage !== "lqip" && (
        <Image
          src={thumbnailUrl}
          alt={clip.name}
          width={clip.width}
          height={clip.height}
          sizes="33vw"
          className="h-full w-full object-cover"
        />
      )}

      {showVideo && (
        <video
          src={previewUrl}
          muted
          autoPlay
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setVideoFailed(true)}
        />
      )}

      {overlay}
    </div>
  );
}
