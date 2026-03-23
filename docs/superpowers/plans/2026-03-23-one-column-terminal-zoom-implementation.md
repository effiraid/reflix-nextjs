# One-Column Terminal Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `+`를 끝까지 올렸을 때 browse masonry가 `1열 보기`까지 확장되도록 만든다.

**Architecture:** `thumbnailSize` 관련 상한값과 컬럼 계산을 별도 helper로 추출해 store, toolbar, masonry가 같은 규칙을 공유하게 만든다. 테스트는 helper 단위와 toolbar 상호작용 단위로 나눠 `1열` 상태가 UI와 상태에 모두 반영되는지 검증한다.

**Tech Stack:** Next.js 16, React 19, Zustand, Vitest, Testing Library

---

### Task 1: Thumbnail Size Rules

**Files:**
- Create: `src/lib/thumbnailSize.test.ts`
- Create: `src/lib/thumbnailSize.ts`

- [ ] **Step 1: Write the failing test**

```ts
expect(clampThumbnailSize(99)).toBe(4);
expect(getColumnCountFromThumbnailSize(4)).toBe(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/thumbnailSize.test.ts`
Expected: FAIL because helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const MIN_THUMBNAIL_SIZE = 0;
export const MAX_THUMBNAIL_SIZE = 4;

export function clampThumbnailSize(size: number): number {
  return Math.min(MAX_THUMBNAIL_SIZE, Math.max(MIN_THUMBNAIL_SIZE, size));
}

export function getColumnCountFromThumbnailSize(size: number): number {
  return 5 - clampThumbnailSize(size);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/thumbnailSize.test.ts`
Expected: PASS

### Task 2: Wire UI To Shared Rules

**Files:**
- Modify: `src/stores/uiStore.ts`
- Modify: `src/components/clip/MasonryGrid.tsx`
- Modify: `src/components/layout/SubToolbar.tsx`
- Modify: `src/components/layout/SubToolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a toolbar test that clicks `+` from size `3` and expects store state `4` plus range `max="4"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/SubToolbar.test.tsx`
Expected: FAIL because toolbar/store still cap at `3`.

- [ ] **Step 3: Write minimal implementation**

Use the shared helper/constants in the store clamp, toolbar range `max`, and masonry column count calculation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/SubToolbar.test.tsx src/lib/thumbnailSize.test.ts`
Expected: PASS

- [ ] **Step 5: Run focused verification**

Run: `npx vitest run src/components/layout/SubToolbar.test.tsx src/lib/thumbnailSize.test.ts src/app/[lang]/browse/BrowseClient.test.tsx`
Expected: PASS
