"use client";

import { useCallback, useRef } from "react";

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

  const toRatio = (time: number) =>
    duration > 0
      ? Math.round(Math.min(1, Math.max(0, time / duration)) * 1e10) / 1e10
      : 0;

  const toTime = (clientX: number) => {
    const track = trackRef.current;
    if (!track || duration === 0) return 0;
    const bounds = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    return ratio * duration;
  };

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onSeek(toTime(e.clientX));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, duration, onSeek]
  );

  const startDrag = useCallback(
    (
      onMove: (time: number) => void,
      onEnd?: () => void
    ) =>
      (e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        if (e.currentTarget.setPointerCapture) {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        onDragStart();

        const handleMove = (me: PointerEvent) => onMove(toTime(me.clientX));
        const handleUp = (ue: PointerEvent) => {
          const target = ue.target as Element;
          if (target?.releasePointerCapture) {
            target.releasePointerCapture(ue.pointerId);
          }
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          onDragEnd();
          onEnd?.();
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, duration, onDragStart, onDragEnd]
  );

  const fmt = (ratio: number) =>
    `${Math.round(ratio * 100 * 1e8) / 1e8}%`;

  const progressPercent = fmt(toRatio(currentTime));
  const inPercent = fmt(toRatio(inPoint));
  const outPercent = fmt(toRatio(outPoint));
  const regionWidth = fmt(toRatio(outPoint) - toRatio(inPoint));

  return (
    <div
      ref={trackRef}
      data-testid="seekbar-track"
      className="relative flex h-5 flex-1 cursor-pointer items-center"
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      onClick={handleTrackClick}
    >
      {/* Track background */}
      <div className="h-0.5 w-full rounded-sm bg-border">
        {/* Loop region highlight */}
        <div
          data-testid="loop-region"
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-accent/30"
          style={{ left: inPercent, width: regionWidth }}
        />

        {/* Progress fill */}
        <div
          data-testid="seekbar-fill"
          className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-sm bg-accent"
          style={{ width: progressPercent }}
        />

        {/* In marker */}
        <div
          data-testid="in-marker"
          className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 cursor-col-resize bg-accent"
          style={{ left: inPercent }}
          onPointerDown={startDrag(onInPointChange)}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Out marker */}
        <div
          data-testid="out-marker"
          className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 cursor-col-resize bg-accent"
          style={{ left: outPercent }}
          onPointerDown={startDrag(onOutPointChange)}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Playback handle */}
        <div
          data-testid="seekbar-handle"
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm"
          style={{ left: progressPercent }}
          onPointerDown={startDrag(onSeek)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
