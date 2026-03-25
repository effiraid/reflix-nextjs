"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMediaUrl } from "@/lib/mediaUrl";
import { SeekBar } from "./SeekBar";
import { useVideoKeyboard } from "./useVideoKeyboard";
import {
  PlayIcon,
  PauseIcon,
  VolumeOffIcon,
  VolumeOnIcon,
  RepeatIcon,
} from "./PlayerIcons";

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  compact?: boolean;
  playbackToggleCount?: number;
  autoPlayMuted?: boolean;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
}

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

function formatPlaybackTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return String(minutes) + ":" + String(seconds).padStart(2, "0");
}

export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  duration,
  compact = false,
  playbackToggleCount = 0,
  autoPlayMuted = false,
  playbackRate: controlledRate,
  onPlaybackRateChange,
}: VideoPlayerProps) {
  const isControlled = controlledRate !== undefined;
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousPlaybackToggleCount = useRef(playbackToggleCount);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [internalRate, setInternalRate] = useState(1);
  const playbackRate = isControlled ? controlledRate : internalRate;
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [isMuted, setIsMuted] = useState(compact || autoPlayMuted);
  const [isLooping, setIsLooping] = useState(true);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(duration);

  const resolvedVideoUrl = getMediaUrl(videoUrl);
  const resolvedThumbnailUrl = getMediaUrl(thumbnailUrl);
  const totalDuration = Math.max(0, duration);

  // Sync outPoint when duration becomes available
  useEffect(() => {
    setOutPoint((prev) => (prev === 0 ? duration : prev));
  }, [duration]);

  // Sync isMuted state to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || hasPlaybackError) return;

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
  }, [hasPlaybackError]);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleDragStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  }, []);

  const handleDragEnd = useCallback(() => {
    // Stay paused after drag (per spec) — no-op
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    setCurrentTime(time);
    if (time >= outPoint) {
      if (isLooping) {
        video.currentTime = inPoint;
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [inPoint, outPoint, isLooping]);

  const cyclePlaybackRate = useCallback(() => {
    if (hasPlaybackError) {
      return;
    }

    const video = videoRef.current;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const nextRate = PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length];
    if (isControlled) {
      onPlaybackRateChange?.(nextRate);
    } else {
      setInternalRate(nextRate);
    }
    if (video) {
      video.playbackRate = nextRate;
    }
  }, [hasPlaybackError, playbackRate, isControlled, onPlaybackRateChange]);

  const handlePlaybackError = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }

    setIsPlaying(false);
    setHasPlaybackError(true);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const seekRelative = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      const newTime = Math.min(totalDuration, Math.max(0, video.currentTime + seconds));
      video.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [totalDuration]
  );

  const resetMarkers = useCallback(() => {
    setInPoint(0);
    setOutPoint(totalDuration);
  }, [totalDuration]);

  useVideoKeyboard({
    togglePlayback,
    seekRelative,
    toggleMute,
    resetMarkers,
    disabled: hasPlaybackError,
  });

  useEffect(() => {
    if (playbackToggleCount === previousPlaybackToggleCount.current) {
      return;
    }

    previousPlaybackToggleCount.current = playbackToggleCount;
    queueMicrotask(() => {
      void togglePlayback();
    });
  }, [playbackToggleCount, togglePlayback]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    setHasPlaybackError(false);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [resolvedVideoUrl]);

  useEffect(() => {
    if (!autoPlayMuted) {
      return;
    }

    if (hasPlaybackError) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = true;
    setIsPlaying(true);

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        setIsPlaying(false);
      });
    }
  }, [autoPlayMuted, hasPlaybackError, resolvedVideoUrl]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* Video area */}
      <div className="relative bg-black" onContextMenu={(e) => e.preventDefault()}>
        <div
          className={`absolute inset-0 z-10 ${hasPlaybackError ? "cursor-default" : "cursor-pointer"}`}
          onClick={() => {
            void togglePlayback();
          }}
          aria-hidden="true"
        />
        <video
          ref={videoRef}
          src={resolvedVideoUrl}
          poster={resolvedThumbnailUrl}
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onTimeUpdate={handleTimeUpdate}
          onContextMenu={(e) => e.preventDefault()}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onError={handlePlaybackError}
          className="aspect-video w-full object-cover"
        />
      </div>

      {/* Control bar */}
      <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2">
        <button
          type="button"
          className="flex items-center p-1 text-foreground hover:text-foreground/80 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void togglePlayback();
          }}
          aria-label={hasPlaybackError ? "Video unavailable" : isPlaying ? "Pause video" : "Play video"}
          disabled={hasPlaybackError}
        >
          {hasPlaybackError ? <PlayIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          className="flex items-center p-1 text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
          disabled={hasPlaybackError}
        >
          {isMuted ? <VolumeOffIcon /> : <VolumeOnIcon />}
        </button>

        <span className="text-xs tabular-nums text-muted">
          {formatPlaybackTime(currentTime)} / {formatPlaybackTime(totalDuration)}
        </span>

        <span className="text-[10px] tabular-nums text-muted/60">
          F:{Math.floor(currentTime * 15)}
        </span>

        <SeekBar
          currentTime={currentTime}
          duration={totalDuration}
          inPoint={inPoint}
          outPoint={outPoint}
          onSeek={handleSeek}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onInPointChange={setInPoint}
          onOutPointChange={setOutPoint}
          disabled={hasPlaybackError}
        />

        <button
          type="button"
          className="flex items-center p-1 text-xs font-medium text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          onClick={cyclePlaybackRate}
          aria-label="Playback speed"
          disabled={hasPlaybackError}
        >
          {playbackRate}x
        </button>

        <button
          type="button"
          className={`flex items-center p-1 ${isLooping ? "text-accent" : "text-muted"} hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60`}
          onClick={() => setIsLooping((prev) => !prev)}
          aria-label={isLooping ? "Disable loop" : "Enable loop"}
          disabled={hasPlaybackError}
        >
          <RepeatIcon />
        </button>
      </div>
    </div>
  );
}
