"use client";

import { useState, type ReactNode } from "react";
import { VideoPlayer } from "@/components/clip/VideoPlayer";
import type { Locale } from "@/lib/types";

interface ClipDetailLayoutProps {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  children: ReactNode;
  lang?: Locale;
}

export function ClipDetailLayout({
  videoUrl,
  thumbnailUrl,
  duration,
  children,
  lang,
}: ClipDetailLayoutProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Left: Video Player */}
      <div className="min-w-0 flex-1">
        <VideoPlayer
          videoUrl={videoUrl}
          thumbnailUrl={thumbnailUrl}
          duration={duration}
          useBlobUrl
          isExpanded={isExpanded}
          onExpandToggle={() => setIsExpanded((prev) => !prev)}
          lang={lang}
        />
      </div>

      {/* Right: Detail Info */}
      {!isExpanded && children}
    </div>
  );
}
