# Video Player Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign VideoPlayer controls to Eagle-style always-visible icon bar with seekbar scrubbing, In/Out markers, frame counter, and keyboard shortcuts.

**Architecture:** Extract seekbar into a dedicated `SeekBar` component with pointer-event-based drag. Add `useVideoKeyboard` hook for shortcut handling. Convert muted/loop from prop/attribute-driven to internal state with JS control. Keep VideoPlayer as the orchestrator.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-25-video-player-redesign.md`

---

## Important Notes

- **No changes needed to `ClipDetailView.tsx`** — it's a server component that just renders VideoPlayer. Keyboard shortcuts work automatically via `useVideoKeyboard` inside VideoPlayer (client component).
- **Tasks 4 and 5 must be deployed together** — Task 4 adds `useVideoKeyboard` (Space = play/pause) while the old QuickViewModal still has Space = close. Task 5 removes the conflict. Ship both in the same PR.
- **Time format**: Update `formatPlaybackTime` to use `M:SS` (no zero-pad on minutes, e.g., `0:32 / 2:05`) per spec. Existing test asserting `"00:32 / 02:05"` must be updated to `"0:32 / 2:05"`.

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/clip/VideoPlayer.tsx` | Modify | Orchestrator: video element, state, control bar layout |
| `src/components/clip/VideoPlayer.test.tsx` | Modify | Tests for VideoPlayer (update for new UI) |
| `src/components/clip/SeekBar.tsx` | Create | Seekbar with drag handle + In/Out markers |
| `src/components/clip/SeekBar.test.tsx` | Create | SeekBar unit tests |
| `src/components/clip/useVideoKeyboard.ts` | Create | Keyboard shortcut hook |
| `src/components/clip/useVideoKeyboard.test.ts` | Create | Keyboard hook tests |
| `src/components/clip/QuickViewModal.tsx` | Modify | Update keyboard bindings, remove onNext/onPrevious |
| `src/components/clip/QuickViewModal.test.tsx` | Modify | Update keyboard tests |
| `src/components/clip/PlayerIcons.tsx` | Create | SVG icon components for player controls |
| `src/app/[lang]/browse/BrowseClient.tsx` | Modify | Remove onNext/onPrevious props from QuickViewModal usage |

---

### Task 1: Create PlayerIcons component

**Files:**
- Create: `src/components/clip/PlayerIcons.tsx`

No tests needed — pure SVG components with no logic.

- [ ] **Step 1: Create icon components**

```tsx
// src/components/clip/PlayerIcons.tsx
const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PlayIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

export function VolumeOffIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

export function VolumeOnIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function RepeatIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/clip/PlayerIcons.tsx
git commit -m "feat(player): add SVG icon components for player controls"
```

---

### Task 2: Create SeekBar component with drag support

**Files:**
- Create: `src/components/clip/SeekBar.tsx`
- Create: `src/components/clip/SeekBar.test.tsx`

- [ ] **Step 1: Write failing tests for SeekBar**

```tsx
// src/components/clip/SeekBar.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeekBar } from "./SeekBar";

describe("SeekBar", () => {
  const defaultProps = {
    currentTime: 3,
    duration: 10,
    inPoint: 0,
    outPoint: 10,
    onSeek: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onInPointChange: vi.fn(),
    onOutPointChange: vi.fn(),
  };

  it("renders the progress track with correct width", () => {
    render(<SeekBar {...defaultProps} />);
    const fill = screen.getByTestId("seekbar-fill");
    expect(fill.style.width).toBe("30%");
  });

  it("renders In/Out markers at correct positions", () => {
    render(<SeekBar {...defaultProps} inPoint={2} outPoint={8} />);
    const inMarker = screen.getByTestId("in-marker");
    const outMarker = screen.getByTestId("out-marker");
    expect(inMarker.style.left).toBe("20%");
    expect(outMarker.style.left).toBe("80%");
  });

  it("renders the loop region highlight", () => {
    render(<SeekBar {...defaultProps} inPoint={2} outPoint={8} />);
    const region = screen.getByTestId("loop-region");
    expect(region.style.left).toBe("20%");
    expect(region.style.width).toBe("60%");
  });

  it("calls onSeek when the track is clicked", () => {
    const onSeek = vi.fn();
    render(<SeekBar {...defaultProps} onSeek={onSeek} />);
    const track = screen.getByTestId("seekbar-track");

    Object.defineProperty(track, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20 }),
    });

    fireEvent.click(track, { clientX: 100 });
    expect(onSeek).toHaveBeenCalledWith(5); // 100/200 * 10 = 5
  });

  it("calls onDragStart on pointerdown on handle", () => {
    const onDragStart = vi.fn();
    render(<SeekBar {...defaultProps} onDragStart={onDragStart} />);
    const handle = screen.getByTestId("seekbar-handle");
    fireEvent.pointerDown(handle);
    expect(onDragStart).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/clip/SeekBar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SeekBar**

```tsx
// src/components/clip/SeekBar.tsx
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
    duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;

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
        e.currentTarget.setPointerCapture(e.pointerId);
        onDragStart();

        const handleMove = (me: PointerEvent) => onMove(toTime(me.clientX));
        const handleUp = (ue: PointerEvent) => {
          (ue.target as Element)?.releasePointerCapture(ue.pointerId);
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          onDragEnd();
          onEnd?.();
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      },
    [disabled, duration, onDragStart, onDragEnd]
  );

  const progressPercent = `${toRatio(currentTime) * 100}%`;
  const inPercent = `${toRatio(inPoint) * 100}%`;
  const outPercent = `${toRatio(outPoint) * 100}%`;
  const regionWidth = `${(toRatio(outPoint) - toRatio(inPoint)) * 100}%`;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/clip/SeekBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/clip/SeekBar.tsx src/components/clip/SeekBar.test.tsx
git commit -m "feat(player): add SeekBar component with drag and In/Out markers"
```

---

### Task 3: Create useVideoKeyboard hook

**Files:**
- Create: `src/components/clip/useVideoKeyboard.ts`
- Create: `src/components/clip/useVideoKeyboard.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/components/clip/useVideoKeyboard.test.ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVideoKeyboard } from "./useVideoKeyboard";

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("useVideoKeyboard", () => {
  it("calls togglePlayback on Space", () => {
    const togglePlayback = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback,
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
      })
    );
    fireKey(" ");
    expect(togglePlayback).toHaveBeenCalledTimes(1);
  });

  it("calls seekRelative(-1) on ArrowLeft", () => {
    const seekRelative = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative,
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
      })
    );
    fireKey("ArrowLeft");
    expect(seekRelative).toHaveBeenCalledWith(-1);
  });

  it("calls seekRelative(1) on ArrowRight", () => {
    const seekRelative = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative,
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
      })
    );
    fireKey("ArrowRight");
    expect(seekRelative).toHaveBeenCalledWith(1);
  });

  it("calls toggleMute on M key", () => {
    const toggleMute = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute,
        resetMarkers: vi.fn(),
      })
    );
    fireKey("m");
    expect(toggleMute).toHaveBeenCalledTimes(1);
  });

  it("calls resetMarkers on X key", () => {
    const resetMarkers = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers,
      })
    );
    fireKey("x");
    expect(resetMarkers).toHaveBeenCalledTimes(1);
  });

  it("ignores keys when disabled", () => {
    const togglePlayback = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback,
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        disabled: true,
      })
    );
    fireKey(" ");
    expect(togglePlayback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/clip/useVideoKeyboard.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

```ts
// src/components/clip/useVideoKeyboard.ts
import { useEffect } from "react";

interface UseVideoKeyboardOptions {
  togglePlayback: () => void;
  seekRelative: (seconds: number) => void;
  toggleMute: () => void;
  resetMarkers: () => void;
  disabled?: boolean;
}

export function useVideoKeyboard({
  togglePlayback,
  seekRelative,
  toggleMute,
  resetMarkers,
  disabled = false,
}: UseVideoKeyboardOptions) {
  useEffect(() => {
    if (disabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture keys when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlayback();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekRelative(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekRelative(1);
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "x":
        case "X":
          e.preventDefault();
          resetMarkers();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, togglePlayback, seekRelative, toggleMute, resetMarkers]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/clip/useVideoKeyboard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/clip/useVideoKeyboard.ts src/components/clip/useVideoKeyboard.test.ts
git commit -m "feat(player): add useVideoKeyboard hook for keyboard shortcuts"
```

---

### Task 4: Rewrite VideoPlayer with new control bar

This is the main integration task. We rewrite VideoPlayer to use SeekBar, PlayerIcons, useVideoKeyboard, and add mute/loop internal state.

**Files:**
- Modify: `src/components/clip/VideoPlayer.tsx`
- Modify: `src/components/clip/VideoPlayer.test.tsx`

- [ ] **Step 1: Update existing tests for new UI**

Key changes to `VideoPlayer.test.tsx`:
- Play/Pause button now uses `aria-label` "Play video" / "Pause video" (already matches)
- Speed button `aria-label` changes from "Speed" to "Playback speed"
- **Delete** the test `"hides the speed control and starts muted in compact mode"` (compact no longer hides speed)
- Update time display test: `"00:32 / 02:05"` → `"0:32 / 2:05"`
- Add test for mute toggle button
- Add test for frame counter rendering (use `waitFor` for batched updates)
- Add test for loop toggle button
- Add test for compact mode mute initialization

```tsx
// Replace the compact mode test and add new tests.
// Keep all existing passing tests, update aria-labels as needed.

// NEW: mute toggle test
it("toggles mute state when mute button is clicked", () => {
  render(
    <VideoPlayer
      videoUrl="/videos/clip-1.mp4"
      thumbnailUrl="/thumbnails/clip-1.webp"
      duration={12}
    />
  );

  const muteBtn = screen.getByRole("button", { name: "Mute" });
  expect(muteBtn).toBeInTheDocument();

  fireEvent.click(muteBtn);
  expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
});

// NEW: frame counter test (use waitFor for batched state updates)
it("renders the frame counter based on current time", async () => {
  render(
    <VideoPlayer
      videoUrl="/videos/clip-1.mp4"
      thumbnailUrl="/thumbnails/clip-1.webp"
      duration={12}
    />
  );

  const video = document.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => 2,
  });

  fireEvent.timeUpdate(video);

  await waitFor(() => {
    expect(screen.getByText("F:30")).toBeInTheDocument(); // 2 * 15 = 30
  });
});

// NEW: loop toggle test
it("toggles loop state when loop button is clicked", () => {
  render(
    <VideoPlayer
      videoUrl="/videos/clip-1.mp4"
      thumbnailUrl="/thumbnails/clip-1.webp"
      duration={12}
    />
  );

  // Default: loop on
  const loopBtn = screen.getByRole("button", { name: "Disable loop" });
  fireEvent.click(loopBtn);
  expect(screen.getByRole("button", { name: "Enable loop" })).toBeInTheDocument();
});

// NEW: compact mode shows all controls (mute starts on)
it("starts muted with mute button in compact mode", () => {
  render(
    <VideoPlayer
      videoUrl="/videos/clip-1.mp4"
      thumbnailUrl="/thumbnails/clip-1.webp"
      duration={12}
      compact
    />
  );

  // Mute button visible and shows unmute option (since already muted)
  expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to see which fail**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: Some tests FAIL (new tests, changed aria-labels)

- [ ] **Step 3: Rewrite VideoPlayer component**

Rewrite `src/components/clip/VideoPlayer.tsx` with these changes:
- Update `formatPlaybackTime` to `M:SS` format (no zero-pad on minutes): change `[minutes, seconds].map(part => String(part).padStart(2, "0"))` to `String(minutes) + ":" + String(seconds).padStart(2, "0")`
- Update time display test from `"00:32 / 02:05"` to `"0:32 / 2:05"`
- Remove `space-y-3` gap between video and controls → flush layout
- Remove `<video loop>` attribute → JS-controlled loop via `timeupdate`
- Add `isMuted` internal state (initial: `compact || autoPlayMuted`)
- Add `isLooping` internal state (initial: `true`)
- Add `inPoint`/`outPoint` state (initial: `0`/`duration`), with sync effect for `duration` changes:
  ```tsx
  const [outPoint, setOutPoint] = useState(duration);
  useEffect(() => { setOutPoint(prev => prev === 0 ? duration : prev); }, [duration]);
  ```
- Replace text buttons with PlayerIcons SVG components
- Replace inline seekbar with `<SeekBar>` component
- Add frame counter: `F:{Math.floor(currentTime * 15)}`
- Add `useVideoKeyboard` hook
- Wire up `timeupdate` to check Out marker + loop logic
- All controls get `aria-label` attributes
- Speed and loop buttons visible in all modes (not hidden in compact)

Key structural changes in the JSX:

```tsx
<div className="overflow-hidden rounded-2xl border border-border">
  {/* Video area */}
  <div className="relative bg-black" onContextMenu={...}>
    <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlayback} />
    <video ref={videoRef} ... />  {/* no loop attribute */}
  </div>

  {/* Control bar — flush, no gap */}
  <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2">
    {/* Play/Pause icon button */}
    <button aria-label={isPlaying ? "Pause video" : "Play video"} ...>
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </button>

    {/* Mute icon button */}
    <button aria-label={isMuted ? "Unmute" : "Mute"} ...>
      {isMuted ? <VolumeOffIcon /> : <VolumeOnIcon />}
    </button>

    {/* Time display */}
    <span className="...text-xs tabular-nums text-muted">
      {formatPlaybackTime(currentTime)} / {formatPlaybackTime(totalDuration)}
    </span>

    {/* Frame counter */}
    <span className="...text-[10px] tabular-nums text-muted/60">
      F:{Math.floor(currentTime * 15)}
    </span>

    {/* SeekBar */}
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

    {/* Speed */}
    <button aria-label="Playback speed" ...>
      <span className="text-xs font-medium">{playbackRate}x</span>
    </button>

    {/* Loop toggle */}
    <button
      aria-label={isLooping ? "Disable loop" : "Enable loop"}
      className={isLooping ? "text-accent" : "text-muted"}
      ...
    >
      <RepeatIcon />
    </button>
  </div>
</div>
```

Loop logic in `handleTimeUpdate`:

```tsx
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
```

Drag handlers:

```tsx
const handleDragStart = useCallback(() => {
  const video = videoRef.current;
  if (!video) return;
  video.pause();
}, []);

const handleDragEnd = useCallback(() => {
  // Stay paused after drag (per spec) — no-op
}, []);

const handleSeek = useCallback((time: number) => {
  const video = videoRef.current;
  if (!video) return;
  video.currentTime = time;
  setCurrentTime(time);
}, []);
```

- [ ] **Step 4: Run all VideoPlayer tests**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: PASS (all updated tests)

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (no regressions in other test files)

- [ ] **Step 6: Commit**

```bash
git add src/components/clip/VideoPlayer.tsx src/components/clip/VideoPlayer.test.tsx
git commit -m "feat(player): redesign control bar with icons, seekbar, mute, loop, frame counter"
```

---

### Task 5: Update QuickViewModal keyboard bindings

**Files:**
- Modify: `src/components/clip/QuickViewModal.tsx`
- Modify: `src/components/clip/QuickViewModal.test.tsx`

- [ ] **Step 1: Update QuickViewModal tests**

Key changes:
- Remove test for Space → close (now Space handled by VideoPlayer)
- Remove test for ArrowLeft/ArrowRight → clip navigation
- Keep test for Escape → close
- Keep test for +/- → speed change
- Remove `onNext`/`onPrevious` from QuickViewModal props

```tsx
// Update keyboard test:
it("closes the modal on Escape key", () => {
  const onClose = vi.fn();
  render(<QuickViewModal clip={clip} lang="ko" dict={dict} onClose={onClose} />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});

// Remove tests for Space→close and Arrow→clip navigation
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/clip/QuickViewModal.test.tsx`
Expected: FAIL (props mismatch since we remove onNext/onPrevious)

- [ ] **Step 3: Update QuickViewModal component**

Changes to `QuickViewModal.tsx`:
- Remove `onNext`, `onPrevious` from props interface
- Remove Space → `onClose()` handler
- Remove ArrowLeft → `onPrevious()` handler
- Remove ArrowRight → `onNext()` handler
- Keep Escape → `onClose()` handler
- Keep +/- → speed step handlers
- VideoPlayer's `useVideoKeyboard` handles Space/Arrow/M/X

```tsx
interface QuickViewModalProps {
  clip: ClipIndex;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
  onClose: () => void;
  // onNext and onPrevious removed
}

// In keyboard handler, only keep:
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }

    if (event.key === "-") {
      event.preventDefault();
      stepSpeed(-1);
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      stepSpeed(1);
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [onClose, stepSpeed]);
```

- [ ] **Step 4: Update callers of QuickViewModal**

Remove `onNext`/`onPrevious` props from QuickViewModal usage in `src/app/[lang]/browse/BrowseClient.tsx`. Also remove the `handleNextClip`/`handlePrevClip` callbacks and `moveSelection` if they have no other callers.

Wrap `stepSpeed` in `useCallback` to fix the exhaustive-deps lint warning (pre-existing issue):
```tsx
const stepSpeed = useCallback((direction: 1 | -1) => {
  setPlaybackRate((prev) => {
    const idx = PLAYBACK_SPEEDS.indexOf(prev);
    const nextIdx = Math.min(PLAYBACK_SPEEDS.length - 1, Math.max(0, idx + direction));
    return PLAYBACK_SPEEDS[nextIdx];
  });
}, []);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/clip/QuickViewModal.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/clip/QuickViewModal.tsx src/components/clip/QuickViewModal.test.tsx
# Also add any modified callers
git commit -m "feat(player): update QuickViewModal keyboard bindings, remove clip navigation shortcuts"
```

---

### Task 6: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Dev server smoke test**

Run: `npm run dev`
Manually verify:
1. Open a clip detail page — control bar renders with icons
2. Click play/pause — toggles correctly
3. Click mute — toggles sound
4. Click speed — cycles through speeds
5. Click loop icon — toggles (accent color when active)
6. Drag seekbar handle — pauses and scrubs
7. Drag In/Out markers — adjusts loop region
8. Press Space, ←, →, M, X — all work
9. Open QuickView modal — controls work, Escape closes
10. Dark/light theme switch — both look correct

- [ ] **Step 5: Final commit if any fixups needed**

```bash
git add -u
git commit -m "fix(player): address integration issues from smoke test"
```
