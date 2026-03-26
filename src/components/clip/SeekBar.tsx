"use client";

import { useCallback, useRef } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toRatio(time: number, duration: number) {
  return duration > 0
    ? Math.round(Math.min(1, Math.max(0, time / duration)) * 1e10) / 1e10
    : 0;
}

interface SeekBarProps {
  currentTime: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  onSeek: (time: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onInPointChange: (time: number) => void;
  onOutPointChange: (time: number) => void;
  disabled?: boolean;
}

export function SeekBar({
  currentTime,
  duration,
  inPoint,
  outPoint,
  onSeek,
  onDragStart,
  onDragEnd,
  onInPointChange,
  onOutPointChange,
  disabled = false,
}: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const suppressTrackClickRef = useRef(false);

  const toTime = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration === 0) return 0;
      const bounds = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      if (suppressTrackClickRef.current) {
        suppressTrackClickRef.current = false;
        return;
      }

      onSeek(toTime(e.clientX));
    },
    [disabled, toTime, onSeek]
  );

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || duration === 0) return;

      suppressTrackClickRef.current = true;
      e.preventDefault();

      const pointerTarget = e.currentTarget;
      const initialTime = toTime(e.clientX);
      let didDrag = false;

      if (pointerTarget.setPointerCapture) {
        pointerTarget.setPointerCapture(e.pointerId);
      }

      onSeek(initialTime);

      const handleMove = (me: PointerEvent) => {
        if (!didDrag) {
          onDragStart();
          didDrag = true;
        }

        onSeek(toTime(me.clientX));
      };

      const handleUp = (ue: PointerEvent) => {
        try {
          pointerTarget.releasePointerCapture?.(ue.pointerId);
        } catch {
          // Pointer capture may already be released in jsdom/browser edge cases.
        }

        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);

        if (didDrag) {
          onDragEnd();
        }

        window.setTimeout(() => {
          suppressTrackClickRef.current = false;
        }, 0);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [disabled, duration, toTime, onDragEnd, onDragStart, onSeek]
  );

  const handleTrackKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || duration === 0) return;

      let nextTime: number | null = null;

      switch (e.key) {
        case "ArrowLeft":
          nextTime = clamp(currentTime - 1, 0, duration);
          break;
        case "ArrowRight":
          nextTime = clamp(currentTime + 1, 0, duration);
          break;
        case "Home":
          nextTime = 0;
          break;
        case "End":
          nextTime = duration;
          break;
        default:
          return;
      }

      e.preventDefault();
      e.stopPropagation();
      onSeek(nextTime);
    },
    [currentTime, disabled, duration, onSeek]
  );

  const handleInMarkerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || duration === 0) return;

      let nextInPoint: number | null = null;

      switch (e.key) {
        case "ArrowLeft":
          nextInPoint = clamp(inPoint - 1, 0, outPoint);
          break;
        case "ArrowRight":
          nextInPoint = clamp(inPoint + 1, 0, outPoint);
          break;
        case "Home":
          nextInPoint = 0;
          break;
        case "End":
          nextInPoint = outPoint;
          break;
        default:
          return;
      }

      e.preventDefault();
      e.stopPropagation();
      onInPointChange(nextInPoint);
    },
    [disabled, duration, inPoint, outPoint, onInPointChange]
  );

  const handleOutMarkerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || duration === 0) return;

      let nextOutPoint: number | null = null;

      switch (e.key) {
        case "ArrowLeft":
          nextOutPoint = clamp(outPoint - 1, inPoint, duration);
          break;
        case "ArrowRight":
          nextOutPoint = clamp(outPoint + 1, inPoint, duration);
          break;
        case "Home":
          nextOutPoint = inPoint;
          break;
        case "End":
          nextOutPoint = duration;
          break;
        default:
          return;
      }

      e.preventDefault();
      e.stopPropagation();
      onOutPointChange(nextOutPoint);
    },
    [disabled, duration, inPoint, outPoint, onOutPointChange]
  );

  const startDrag = useCallback(
    (
      onMove: (time: number) => void,
      onEnd?: () => void
    ) =>
      (e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();

        const pointerTarget = e.currentTarget;

        if (pointerTarget.setPointerCapture) {
          pointerTarget.setPointerCapture(e.pointerId);
        }

        onDragStart();
        onMove(toTime(e.clientX));

        const handleMove = (me: PointerEvent) => onMove(toTime(me.clientX));
        const handleUp = (ue: PointerEvent) => {
          try {
            pointerTarget.releasePointerCapture?.(ue.pointerId);
          } catch {
            // Pointer capture may already be released in jsdom/browser edge cases.
          }

          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          onDragEnd();
          onEnd?.();
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      },
    [disabled, toTime, onDragStart, onDragEnd]
  );

  const fmt = (ratio: number) =>
    `${Math.round(ratio * 100 * 1e8) / 1e8}%`;

  const progressPercent = fmt(toRatio(currentTime, duration));
  const inPercent = fmt(toRatio(inPoint, duration));
  const outPercent = fmt(toRatio(outPoint, duration));
  const regionWidth = fmt(toRatio(outPoint, duration) - toRatio(inPoint, duration));
  const currentRatio = toRatio(currentTime, duration);
  const inRatio = toRatio(inPoint, duration);
  const progressStartPercent = fmt(currentRatio > inRatio ? inRatio : currentRatio);
  const progressWidthPercent = fmt(Math.max(0, currentRatio - inRatio));

  return (
    <div
      ref={trackRef}
      data-testid="seekbar-track"
      className="relative flex h-6 flex-1 cursor-pointer items-center touch-none"
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
      onPointerDown={handleTrackPointerDown}
      onClick={handleTrackClick}
      onKeyDown={handleTrackKeyDown}
    >
      {/* Track background */}
      <div className="h-1 w-full rounded-full bg-border">
        {/* Loop region highlight */}
        <div
          data-testid="loop-region"
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/30"
          style={{ left: inPercent, width: regionWidth }}
        />

        {/* Progress fill */}
        <div
          data-testid="seekbar-fill"
          className="absolute top-1/2 h-1 -translate-y-1/2 cursor-ew-resize rounded-full bg-accent"
          style={{ left: progressStartPercent, width: progressWidthPercent }}
        />

        {/* In marker */}
        <div
          data-testid="in-marker"
          className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 cursor-col-resize rounded-full bg-accent shadow-sm ring-1 ring-surface"
          style={{ left: inPercent }}
          role="slider"
          tabIndex={0}
          aria-label="Set in point"
          aria-valuemin={0}
          aria-valuemax={outPoint}
          aria-valuenow={inPoint}
          onPointerDown={startDrag(onInPointChange)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleInMarkerKeyDown}
        />

        {/* Out marker */}
        <div
          data-testid="out-marker"
          className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 cursor-col-resize rounded-full bg-accent shadow-sm ring-1 ring-surface"
          style={{ left: outPercent }}
          role="slider"
          tabIndex={0}
          aria-label="Set out point"
          aria-valuemin={inPoint}
          aria-valuemax={duration}
          aria-valuenow={outPoint}
          onPointerDown={startDrag(onOutPointChange)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleOutMarkerKeyDown}
        />

        {/* Playback handle */}
        <div
          data-testid="seekbar-handle"
          className="absolute top-1/2 flex h-8 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center cursor-ew-resize"
          style={{ left: progressPercent }}
          onPointerDown={startDrag(onSeek)}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            data-testid="seekbar-handle-bar"
            className="pointer-events-none h-6 w-[5px] rounded-full border border-surface bg-foreground shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
