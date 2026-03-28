"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMediaUrl } from "@/lib/mediaUrl";
import { fetchBlobUrl } from "@/lib/blobVideo";
import { SeekBar } from "./SeekBar";
import { useVideoKeyboard } from "./useVideoKeyboard";
import { Watermark } from "./Watermark";
import {
  PlayIcon,
  PauseIcon,
  VolumeOffIcon,
  VolumeOnIcon,
  RepeatIcon,
  FullscreenIcon,
  FullscreenExitIcon,
  ExpandIcon,
  CollapseIcon,
} from "./PlayerIcons";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Locale } from "@/lib/types";

const TOOLTIPS = {
  ko: {
    play: "재생 (Space)",
    pause: "일시정지 (Space)",
    mute: "음소거 (M)",
    unmute: "음소거 해제 (M)",
    timeFrame: "시간 / 프레임",
    speed: "속도 (+/−)",
    loop: "반복 (L)",
    expand: "확장 (E)",
    fullscreen: "전체화면 (F)",
  },
  en: {
    play: "Play (Space)",
    pause: "Pause (Space)",
    mute: "Mute (M)",
    unmute: "Unmute (M)",
    timeFrame: "Time / Frame",
    speed: "Speed (+/−)",
    loop: "Loop (L)",
    expand: "Expand (E)",
    fullscreen: "Fullscreen (F)",
  },
} as const;

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  compact?: boolean;
  enableKeyboardShortcuts?: boolean;
  playbackToggleCount?: number;
  autoPlayMuted?: boolean;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  useBlobUrl?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  lang?: Locale;
}

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

const SCRUB_PX_PER_SEC = 200;
const DRAG_THRESHOLD = 5;

function formatPlaybackTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return String(minutes) + ":" + String(seconds).padStart(2, "0");
}

function formatFrameCount(time: number, frameDuration: number) {
  return String(frameDuration > 0 ? Math.round(time / frameDuration) : 0);
}

export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  duration,
  compact = false,
  enableKeyboardShortcuts = true,
  playbackToggleCount = 0,
  autoPlayMuted = false,
  playbackRate: controlledRate,
  onPlaybackRateChange,
  useBlobUrl = false,
  isExpanded = false,
  onExpandToggle,
  lang = "ko",
}: VideoPlayerProps) {
  const tt = TOOLTIPS[lang];
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
  const [showFrames, setShowFrames] = useState(false);
  const [frameDuration, setFrameDuration] = useState(1 / 30);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const directVideoUrl = getMediaUrl(videoUrl);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!useBlobUrl) return;

    let cancelled = false;
    fetchBlobUrl(directVideoUrl)
      .then((url) => {
        if (cancelled) return;
        setBlobUrl(url);
      })
      .catch(() => {
        if (cancelled) return;
        setHasPlaybackError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [directVideoUrl, useBlobUrl]);

  const resolvedVideoUrl = useBlobUrl ? (blobUrl ?? "") : directVideoUrl;
  const resolvedThumbnailUrl = getMediaUrl(thumbnailUrl);
  const totalDuration = Math.max(0, duration);
  const iconButtonClass =
    "flex items-center rounded-md p-1 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60";
  const textButtonClass =
    "rounded-md px-1.5 py-1 text-xs font-medium transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60";
  const frameDurationRef = useRef(1 / 30); // fallback: 30fps
  const lastFrameTimeRef = useRef(-1);

  // Render-time state adjustments (avoids cascading-render effects)
  const [prevVideoUrl, setPrevVideoUrl] = useState(directVideoUrl);
  const [prevDuration, setPrevDuration] = useState(duration);

  if (prevVideoUrl !== directVideoUrl) {
    setPrevVideoUrl(directVideoUrl);
    setHasPlaybackError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setFrameDuration(1 / 30);
  }

  if (prevDuration !== duration) {
    setPrevDuration(duration);
    setOutPoint((prev) => (prev === prevDuration ? duration : prev));
  }

  // Sync isMuted state to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || hasPlaybackError) return;

    if (video.paused) {
      if (isLooping && (video.currentTime < inPoint || video.currentTime >= outPoint)) {
        video.currentTime = inPoint;
        setCurrentTime(inPoint);
      }

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
  }, [hasPlaybackError, inPoint, isLooping, outPoint]);

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

    if (video.paused) {
      return;
    }

    if (time >= outPoint) {
      if (isLooping) {
        video.currentTime = inPoint;
        setCurrentTime(inPoint);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [inPoint, outPoint, isLooping]);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isLooping) {
      setIsPlaying(false);
      return;
    }

    video.currentTime = inPoint;
    setCurrentTime(inPoint);
    setIsPlaying(true);

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        setIsPlaying(false);
      });
    }
  }, [inPoint, isLooping]);

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

  const stepSpeed = useCallback((direction: 1 | -1) => {
    if (hasPlaybackError) return;
    const video = videoRef.current;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const nextIdx = Math.min(PLAYBACK_SPEEDS.length - 1, Math.max(0, currentIndex + direction));
    const nextRate = PLAYBACK_SPEEDS[nextIdx];
    if (isControlled) {
      onPlaybackRateChange?.(nextRate);
    } else {
      setInternalRate(nextRate);
    }
    if (video) {
      video.playbackRate = nextRate;
    }
  }, [hasPlaybackError, playbackRate, isControlled, onPlaybackRateChange]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const preventWheelScroll = (event: WheelEvent) => {
      event.preventDefault();
    };

    container.addEventListener("wheel", preventWheelScroll, { passive: false });

    return () => {
      container.removeEventListener("wheel", preventWheelScroll);
    };
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

  // Video-area drag-to-scrub (relative: delta-X → time offset from grab point)
  const scrubState = useRef<{
    startX: number;
    dragging: boolean;
    baseTime: number;
    rafId: number;
  } | null>(null);

  const handleVideoPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (hasPlaybackError) return;
      const video = videoRef.current;
      if (!video) return;

      e.preventDefault();
      (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
      scrubState.current = {
        startX: e.clientX,
        dragging: false,
        baseTime: video.currentTime,
        rafId: 0,
      };
    },
    [hasPlaybackError]
  );

  const handleVideoPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = scrubState.current;
      if (!state) return;
      const video = videoRef.current;
      if (!video) return;

      const dx = e.clientX - state.startX;

      if (!state.dragging && Math.abs(dx) >= DRAG_THRESHOLD) {
        state.dragging = true;
        video.pause();
      }

      if (state.dragging) {
        const totalDx = e.clientX - state.startX;
        let raw = state.baseTime + totalDx / SCRUB_PX_PER_SEC;
        // Wrap around at boundaries
        if (totalDuration > 0) {
          raw = ((raw % totalDuration) + totalDuration) % totalDuration;
        }
        video.currentTime = raw;
        // Throttle React re-renders to rAF
        if (!state.rafId) {
          state.rafId = requestAnimationFrame(() => {
            setCurrentTime(video.currentTime);
            if (scrubState.current) scrubState.current.rafId = 0;
          });
        }
      }
    },
    [totalDuration]
  );

  const handleVideoPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = scrubState.current;
      scrubState.current = null;
      if (!state) return;

      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // already released
      }

      if (state.dragging) {
        if (state.rafId) cancelAnimationFrame(state.rafId);
        setCurrentTime(videoRef.current?.currentTime ?? 0);
      } else {
        void togglePlayback();
      }
    },
    [togglePlayback]
  );

  // Detect actual frame duration from video metadata
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.requestVideoFrameCallback) return;

    frameDurationRef.current = 1 / 30;

    let callbackId: number;
    const detect = (_now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
      if (lastFrameTimeRef.current >= 0) {
        const dt = meta.mediaTime - lastFrameTimeRef.current;
        if (dt > 0 && dt < 0.2) {
          frameDurationRef.current = dt;
          setFrameDuration(dt);
          return; // detected, stop
        }
      }
      lastFrameTimeRef.current = meta.mediaTime;
      callbackId = video.requestVideoFrameCallback(detect);
    };
    callbackId = video.requestVideoFrameCallback(detect);

    return () => {
      video.cancelVideoFrameCallback?.(callbackId);
      lastFrameTimeRef.current = -1;
    };
  }, [directVideoUrl]);

  const stepForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const fd = frameDurationRef.current;

    // Wrap: at or past end → jump to start
    if (video.currentTime >= totalDuration - fd / 2) {
      video.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const t = Math.min(totalDuration, video.currentTime + fd);
    video.currentTime = t;
    setCurrentTime(t);
  }, [totalDuration]);

  const stepBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const fd = frameDurationRef.current;

    // Wrap: at or before start → jump to end
    if (video.currentTime <= fd / 2) {
      video.currentTime = totalDuration;
      setCurrentTime(totalDuration);
      return;
    }

    const t = video.currentTime - fd;
    video.currentTime = t;
    setCurrentTime(t);
  }, [totalDuration]);

  const handleVideoWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (hasPlaybackError) return;
      const video = videoRef.current;
      if (!video) return;

      e.preventDefault();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;

      video.pause();
      setIsPlaying(false);

      if (delta > 0) {
        stepForward();
      } else {
        stepBackward();
      }
    },
    [hasPlaybackError, stepForward, stepBackward]
  );

  const setInPointHere = useCallback(() => {
    const video = videoRef.current;
    if (video) setInPoint(video.currentTime);
  }, []);

  const setOutPointHere = useCallback(() => {
    const video = videoRef.current;
    if (video) setOutPoint(video.currentTime);
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  useVideoKeyboard({
    togglePlayback,
    seekRelative,
    toggleMute,
    resetMarkers,
    toggleFullscreen,
    setInPointHere,
    setOutPointHere,
    toggleLoop,
    stepForward,
    stepBackward,
    stepSpeed,
    onExpandToggle,
    disabled: hasPlaybackError || !enableKeyboardShortcuts,
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

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        setIsPlaying(false);
      });
    }
  }, [autoPlayMuted, hasPlaybackError, directVideoUrl]);

  return (
    <div
      ref={containerRef}
      data-testid="video-player"
      className="rounded-2xl border border-border bg-background shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
    >
      {/* Video area */}
      <div
        data-testid="video-player-surface"
        className="relative overflow-hidden rounded-t-2xl bg-black"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className={`absolute inset-0 z-10 touch-none ${hasPlaybackError ? "cursor-default" : "cursor-pointer"}`}
          onPointerDown={handleVideoPointerDown}
          onPointerMove={handleVideoPointerMove}
          onPointerUp={handleVideoPointerUp}
          onWheel={handleVideoWheel}
          aria-hidden="true"
        />
        <video
          ref={videoRef}
          src={resolvedVideoUrl || undefined}
          poster={resolvedThumbnailUrl}
          preload="auto"
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onContextMenu={(e) => e.preventDefault()}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onError={handlePlaybackError}
          className="aspect-video w-full object-contain"
        />
        <Watermark size="md" />
      </div>

      {/* Control bar */}
      <div
        data-testid="video-player-controls"
        className="flex items-center gap-2 rounded-b-2xl border-t border-border bg-surface px-3 py-2"
      >
        <Tooltip label={isPlaying ? tt.pause : tt.play} side="top">
          <button
            type="button"
            tabIndex={-1}
            className={`${iconButtonClass} text-foreground hover:text-foreground/80`}
            onClick={() => {
              void togglePlayback();
            }}
            aria-label={hasPlaybackError ? "Video unavailable" : isPlaying ? "Pause video" : "Play video"}
            disabled={hasPlaybackError}
          >
            {hasPlaybackError ? <PlayIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
        </Tooltip>

        <Tooltip label={isMuted ? tt.unmute : tt.mute} side="top">
          <button
            type="button"
            tabIndex={-1}
            className={`${iconButtonClass} text-muted hover:text-foreground`}
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            disabled={hasPlaybackError}
          >
            {isMuted ? <VolumeOffIcon /> : <VolumeOnIcon />}
          </button>
        </Tooltip>

        <Tooltip label={tt.timeFrame} side="top">
          <button
            type="button"
            tabIndex={-1}
            className="rounded-md px-1.5 py-1 text-xs tabular-nums text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            onClick={() => setShowFrames((prev) => !prev)}
            aria-label="Toggle time/frame display"
          >
            {showFrames
              ? `${formatFrameCount(currentTime, frameDuration)}f / ${formatFrameCount(totalDuration, frameDuration)}f`
              : `${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(totalDuration)}`}
          </button>
        </Tooltip>

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

        <Tooltip label={tt.speed} side="top">
          <button
            type="button"
            tabIndex={-1}
            className={`${textButtonClass} text-muted hover:text-foreground`}
            onClick={cyclePlaybackRate}
            aria-label="Playback speed"
            disabled={hasPlaybackError}
          >
            {playbackRate}x
          </button>
        </Tooltip>

        <Tooltip label={tt.loop} side="top">
          <button
            type="button"
            tabIndex={-1}
            className={`${iconButtonClass} ${isLooping ? "text-accent hover:text-accent" : "text-muted hover:text-foreground"}`}
            onClick={() => setIsLooping((prev) => !prev)}
            aria-label={isLooping ? "Disable loop" : "Enable loop"}
            disabled={hasPlaybackError}
          >
            <RepeatIcon />
          </button>
        </Tooltip>

        {onExpandToggle && (
          <Tooltip label={tt.expand} side="top">
            <button
              type="button"
              tabIndex={-1}
              className={`${iconButtonClass} text-muted hover:text-foreground`}
              onClick={onExpandToggle}
              aria-label={isExpanded ? "Collapse player" : "Expand player"}
            >
              {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
            </button>
          </Tooltip>
        )}

        <Tooltip label={tt.fullscreen} side="top">
          <button
            type="button"
            tabIndex={-1}
            className={`${iconButtonClass} text-muted hover:text-foreground`}
            onClick={() => { void toggleFullscreen(); }}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
