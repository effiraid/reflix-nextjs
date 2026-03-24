"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMediaUrl } from "@/lib/mediaUrl";

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  compact?: boolean;
  playbackToggleCount?: number;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

function formatPlaybackTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return [minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  duration,
  compact = false,
  playbackToggleCount = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousPlaybackToggleCount = useRef(playbackToggleCount);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const resolvedVideoUrl = getMediaUrl(videoUrl);
  const resolvedThumbnailUrl = getMediaUrl(thumbnailUrl);
  const totalDuration = Math.max(0, duration);
  const progressRatio = totalDuration > 0 ? Math.min(currentTime / totalDuration, 1) : 0;

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      setIsPlaying(true);
      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(() => {
          setIsPlaying(false);
        });
      }
      return;
    }

    video.pause();
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      if (!video || totalDuration === 0) return;

      const bounds = event.currentTarget.getBoundingClientRect();
      const nextRatio = Math.min(
        1,
        Math.max(0, (event.clientX - bounds.left) / bounds.width)
      );
      const nextTime = nextRatio * totalDuration;
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [totalDuration]
  );

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const video = videoRef.current;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const nextRate = PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackRate(nextRate);
    if (video) {
      video.playbackRate = nextRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (playbackToggleCount === previousPlaybackToggleCount.current) {
      return;
    }

    previousPlaybackToggleCount.current = playbackToggleCount;
    queueMicrotask(() => {
      void togglePlayback();
    });
  }, [playbackToggleCount, togglePlayback]);

  const toggleLabel = isPlaying ? "Pause video" : "Play video";

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-black"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={() => {
            void togglePlayback();
          }}
          aria-hidden="true"
        />
        <video
          ref={videoRef}
          src={resolvedVideoUrl}
          poster={resolvedThumbnailUrl}
          loop
          muted={compact}
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onTimeUpdate={handleTimeUpdate}
          onContextMenu={(event) => event.preventDefault()}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          className="aspect-video w-full object-cover"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium hover:bg-surface/80"
          onClick={() => {
            void togglePlayback();
          }}
          aria-label={toggleLabel}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <div
          className="h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-surface"
          onClick={handleSeek}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>

        <span className="min-w-fit text-xs tabular-nums text-muted">
          {formatPlaybackTime(currentTime)} / {formatPlaybackTime(totalDuration)}
        </span>

        {!compact && (
          <button
            type="button"
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium hover:bg-surface/80"
            onClick={cyclePlaybackRate}
            aria-label="Speed"
          >
            {playbackRate}x
          </button>
        )}
      </div>
    </div>
  );
}
