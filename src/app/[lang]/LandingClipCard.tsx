"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getMediaUrl } from "@/lib/mediaUrl";
import type { BrowseClipRecord } from "@/lib/types";

interface LandingClipCardProps {
  clip: BrowseClipRecord;
  autoPlay?: boolean;
  aspectRatio?: string;
  overlay?: React.ReactNode;
  disableVideo?: boolean;
  priority?: boolean;
  className?: string;
}

export function LandingClipCard({
  clip,
  autoPlay = false,
  aspectRatio,
  overlay,
  disableVideo = false,
  priority = false,
  className = "",
}: LandingClipCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const thumbnailUrl = getMediaUrl(clip.thumbnailUrl);
  const previewUrl = getMediaUrl(clip.previewUrl);

  useEffect(() => {
    if (disableVideo || !autoPlay) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowVideo(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoPlay, disableVideo]);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-lg bg-black/50 ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Always render thumbnail — SSR-safe, no hydration mismatch */}
      <Image
        src={thumbnailUrl}
        alt={clip.name}
        width={clip.width}
        height={clip.height}
        sizes="33vw"
        priority={priority}
        loading={priority ? "eager" : undefined}
        className="h-full w-full object-cover"
      />

      {showVideo && !videoFailed && (
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
