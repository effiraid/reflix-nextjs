# Watermark Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비디오 플레이어 위에 'reflix.dev' CSS 오버레이 워터마크를 표시하여 도용 방지 + 브랜드 노출

**Architecture:** 재사용 가능한 `Watermark` 컴포넌트를 만들고, ClipCard(프리뷰 재생 시)와 VideoPlayer(항상)에 삽입. CSS absolute positioning으로 비디오 위에 오버레이.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-26-watermark-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/clip/Watermark.tsx` | **Create** | 재사용 워터마크 오버레이 컴포넌트 |
| `src/components/clip/Watermark.test.tsx` | **Create** | Watermark 컴포넌트 단위 테스트 |
| `src/components/clip/ClipCard.tsx` | **Edit** (line 112-127) | 프리뷰 재생 시 Watermark 삽입 |
| `src/components/clip/ClipCard.test.tsx` | **Edit** | 워터마크 렌더링 테스트 추가 |
| `src/components/clip/VideoPlayer.tsx` | **Edit** (line 538-564) | 비디오 영역에 Watermark 삽입 |
| `src/components/clip/VideoPlayer.test.tsx` | **Edit** | 워터마크 렌더링 테스트 추가 |

---

### Task 1: Watermark 컴포넌트 생성

**Files:**
- Create: `src/components/clip/Watermark.tsx`
- Create: `src/components/clip/Watermark.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/clip/Watermark.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Watermark } from "./Watermark";

describe("Watermark", () => {
  it("renders reflix.dev text", () => {
    render(<Watermark />);
    expect(screen.getByText("reflix.dev")).toBeInTheDocument();
  });

  it("is hidden from screen readers", () => {
    render(<Watermark />);
    expect(screen.getByText("reflix.dev").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("is not interactive", () => {
    render(<Watermark />);
    const el = screen.getByText("reflix.dev").closest("[aria-hidden]") as HTMLElement;
    expect(el.className).toContain("pointer-events-none");
    expect(el.className).toContain("select-none");
  });

  it("uses small size styling by default", () => {
    render(<Watermark />);
    const span = screen.getByText("reflix.dev");
    expect(span.className).toContain("text-[10px]");
  });

  it("uses medium size styling when specified", () => {
    render(<Watermark size="md" />);
    const span = screen.getByText("reflix.dev");
    expect(span.className).toContain("text-[11px]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/clip/Watermark.test.tsx`
Expected: FAIL — module `./Watermark` not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/clip/Watermark.tsx
interface WatermarkProps {
  size?: "sm" | "md";
}

const styles = {
  sm: {
    wrapper: "absolute bottom-7 right-2 z-20 pointer-events-none select-none",
    text: "bg-black/60 text-white/90 text-[10px] font-medium px-1.5 py-0.5 rounded tracking-wide",
  },
  md: {
    wrapper: "absolute bottom-2 right-3 z-20 pointer-events-none select-none",
    text: "bg-black/60 text-white/90 text-[11px] font-semibold px-2 py-0.5 rounded tracking-wide",
  },
};

export function Watermark({ size = "sm" }: WatermarkProps) {
  const s = styles[size];
  return (
    <div className={s.wrapper} aria-hidden="true">
      <span className={s.text}>reflix.dev</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/clip/Watermark.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/clip/Watermark.tsx src/components/clip/Watermark.test.tsx
git commit -m "feat(watermark): add reusable Watermark overlay component"
```

---

### Task 2: ClipCard에 워터마크 삽입

**Files:**
- Modify: `src/components/clip/ClipCard.tsx` (line 1, 112-127)
- Modify: `src/components/clip/ClipCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/clip/ClipCard.test.tsx`, inside the existing `describe("ClipCard")` block:

```tsx
it("shows watermark only when video preview is playing", () => {
  intersectionState.stage = "webp";
  intersectionState.isInView = true;

  const { container } = render(<ClipCard clip={clip} />);

  expect(container.querySelector("video")).toBeInTheDocument();
  expect(screen.getByText("reflix.dev")).toBeInTheDocument();
});

it("hides watermark when preview is not playing", () => {
  intersectionState.stage = "thumbnail";
  intersectionState.isInView = false;

  render(<ClipCard clip={clip} />);

  expect(screen.queryByText("reflix.dev")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/clip/ClipCard.test.tsx`
Expected: FAIL — "reflix.dev" not found (watermark not yet integrated)

- [ ] **Step 3: Edit ClipCard to add watermark**

In `src/components/clip/ClipCard.tsx`:

1. Add import (top of file, with other imports):
```tsx
import { Watermark } from "./Watermark";
```

2. Find the `{showPreview && (` block and replace it with:
```tsx
      {/* Stage 3: Short MP4 loop preview — immediate when zoomed in, hover-triggered when zoomed out */}
      {showPreview && (
        <>
          <video
            src={previewUrl}
            muted
            autoPlay
            loop
            playsInline
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="absolute inset-0 w-full h-full object-contain"
            onContextMenu={(e) => e.preventDefault()}
            onError={() => setFailedPreviewUrl(previewUrl)}
          />
          <Watermark size="sm" />
        </>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/clip/ClipCard.test.tsx`
Expected: All tests PASS (existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add src/components/clip/ClipCard.tsx src/components/clip/ClipCard.test.tsx
git commit -m "feat(watermark): show watermark on ClipCard video preview"
```

---

### Task 3: VideoPlayer에 워터마크 삽입

**Files:**
- Modify: `src/components/clip/VideoPlayer.tsx` (line 1 area, line 538-564)
- Modify: `src/components/clip/VideoPlayer.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/clip/VideoPlayer.test.tsx`, inside the existing `describe("VideoPlayer")` block:

```tsx
it("always renders a watermark over the video area", () => {
  render(
    <VideoPlayer
      videoUrl="/videos/clip-1.mp4"
      thumbnailUrl="/thumbnails/clip-1.webp"
      duration={12}
    />
  );

  const watermark = screen.getByText("reflix.dev");
  expect(watermark).toBeInTheDocument();

  const wrapper = watermark.closest("[aria-hidden]") as HTMLElement;
  expect(wrapper).toHaveAttribute("aria-hidden", "true");
  expect(wrapper.className).toContain("pointer-events-none");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: FAIL — "reflix.dev" not found

- [ ] **Step 3: Edit VideoPlayer to add watermark**

In `src/components/clip/VideoPlayer.tsx`:

1. Add import (at the top, with other component imports):
```tsx
import { Watermark } from "./Watermark";
```

2. Inside the `<div className="relative bg-black">` container (line 538), add `<Watermark size="md" />` after the `<video>` element (before the closing `</div>` on line 564):
```tsx
      {/* Video area */}
      <div className="relative bg-black" onContextMenu={(e) => e.preventDefault()}>
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: All tests PASS (existing + 1 new)

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npx vitest run`
Expected: All test suites PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/clip/VideoPlayer.tsx src/components/clip/VideoPlayer.test.tsx
git commit -m "feat(watermark): show watermark on VideoPlayer"
```

---

### Task 4: Visual verification

- [ ] **Step 1: Start dev server and verify**

Run: `npm run dev`

Check the following:
1. Browse page — 호버 시 프리뷰 재생되면 우하단에 `reflix.dev` 필 표시 확인
2. Browse page — 썸네일 상태에서는 워터마크 미표시 확인
3. 클립 상세 페이지 — VideoPlayer에 항상 `reflix.dev` 필 표시 확인
4. 풀스크린 모드에서도 워터마크 유지 확인

- [ ] **Step 2: Run lint and build**

Run: `npm run lint && npm run build`
Expected: No errors

- [ ] **Step 3: Final commit if any fixes needed**
