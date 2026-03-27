# Feed View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "전체" 클릭 시 카테고리별 매거진 타임라인 피드를 보여주고, 폴더/태그 선택 시 기존 메이슨리 그리드로 자동 전환하는 뷰 모드 시스템 구현.

**Architecture:** `ViewMode` 타입에 `"feed"` 추가, `BrowseClient`에 `showFeed` 분기, 새 `FeedView` 컴포넌트가 `BrowseSummaryRecord[]`를 `clip.category` → top-level 카테고리로 그룹핑하여 섹션 렌더링. 기존 `ClipCard` 재사용, `IntersectionObserver`로 히어로 자동재생.

**Tech Stack:** React 19, Zustand, Tailwind CSS 4, IntersectionObserver, 기존 ClipCard/useIntersectionLoader

**Design Doc:** `~/.gstack/projects/effiraid-reflix-nextjs/macbook-main-design-20260327-143325.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | `ViewMode` 타입에 `"feed"` 추가 |
| `src/lib/feedGrouping.ts` | Create | leaf slug → top-level 매핑 빌드 + 클립 그룹핑 유틸 |
| `src/lib/feedGrouping.test.ts` | Create | feedGrouping 유틸 테스트 |
| `src/app/[lang]/browse/FeedView.tsx` | Create | 피드 뷰 컨테이너 (그룹핑 + 섹션 렌더) |
| `src/app/[lang]/browse/FeedCategorySection.tsx` | Create | 카테고리 섹션 (헤더 + 히어로 + 서브 행) |
| `src/app/[lang]/browse/BrowseClient.tsx` | Modify | `showFeed` 분기 로직 추가 |
| `src/app/[lang]/browse/LeftPanelContent.tsx` | Modify | "전체" 클릭 시 `setViewMode('feed')` |
| `src/components/layout/SubToolbar.tsx` | Modify | 피드/그리드 토글 + 셔플 비활성화 |

---

### Task 1: ViewMode 타입 확장

**Files:**
- Modify: `src/lib/types.ts:113`

- [ ] **Step 1: ViewMode 타입에 "feed" 추가**

```typescript
// src/lib/types.ts:113
// Before:
export type ViewMode = "masonry" | "grid" | "list";
// After:
export type ViewMode = "masonry" | "grid" | "list" | "feed";
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 에러 없음. `uiStore`는 이미 `ViewMode` 타입을 사용하고 `setViewMode(mode: ViewMode)`로 제네릭하게 처리하므로 추가 수정 불필요.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add 'feed' to ViewMode type"
```

---

### Task 2: feedGrouping 유틸리티 (TDD)

**Files:**
- Create: `src/lib/feedGrouping.ts`
- Create: `src/lib/feedGrouping.test.ts`

`clip.category`는 leaf slug (예: "walk", "attack")이다. 이걸 top-level 카테고리 (예: "movement", "combat")로 매핑하는 유틸과, 전체 클립을 top-level 기준으로 그룹핑하는 함수.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// src/lib/feedGrouping.test.ts
import { describe, it, expect } from "vitest";
import {
  buildLeafToTopMap,
  groupClipsByTopCategory,
  pickHeroAndSubs,
  type TopCategoryInfo,
} from "./feedGrouping";
import type { BrowseSummaryRecord, CategoryTree } from "./types";

const CATEGORIES: CategoryTree = {
  FOLDER_MOVE: {
    slug: "movement",
    i18n: { ko: "이동", en: "Movement" },
    children: {
      FOLDER_WALK: { slug: "walk", i18n: { ko: "걷기", en: "Walk" } },
      FOLDER_RUN: { slug: "run", i18n: { ko: "달리기", en: "Run" } },
    },
  },
  FOLDER_COMBAT: {
    slug: "combat",
    i18n: { ko: "교전", en: "Combat" },
    children: {
      FOLDER_ATTACK: { slug: "attack", i18n: { ko: "공격", en: "Attack" } },
    },
  },
  FOLDER_RETURN: {
    slug: "return",
    i18n: { ko: "리턴", en: "Return" },
    // no children — top-level is also leaf
  },
};

function makeClip(
  id: string,
  category: string,
  star: number
): BrowseSummaryRecord {
  return {
    id,
    name: `clip-${id}`,
    thumbnailUrl: `/thumbnails/${id}.webp`,
    previewUrl: `/previews/${id}.mp4`,
    lqipBase64: "",
    width: 1920,
    height: 1080,
    duration: 2,
    star,
    category,
  };
}

describe("buildLeafToTopMap", () => {
  it("maps leaf slugs to their top-level parent", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    expect(map.get("walk")).toEqual({
      topSlug: "movement",
      topFolderId: "FOLDER_MOVE",
      topI18n: { ko: "이동", en: "Movement" },
    });
    expect(map.get("attack")).toEqual({
      topSlug: "combat",
      topFolderId: "FOLDER_COMBAT",
      topI18n: { ko: "교전", en: "Combat" },
    });
  });

  it("maps top-level slug to itself when it has no children", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    expect(map.get("return")).toEqual({
      topSlug: "return",
      topFolderId: "FOLDER_RETURN",
      topI18n: { ko: "리턴", en: "Return" },
    });
  });

  it("maps top-level slug to itself when it also has children", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    expect(map.get("movement")?.topSlug).toBe("movement");
  });
});

describe("groupClipsByTopCategory", () => {
  it("groups clips by top-level category", () => {
    const clips = [
      makeClip("1", "walk", 5),
      makeClip("2", "run", 3),
      makeClip("3", "attack", 4),
    ];
    const map = buildLeafToTopMap(CATEGORIES);
    const grouped = groupClipsByTopCategory(clips, map);

    expect(grouped.get("movement")?.length).toBe(2);
    expect(grouped.get("combat")?.length).toBe(1);
  });

  it("puts unknown categories under 'uncategorized'", () => {
    const clips = [makeClip("1", "unknown-slug", 3)];
    const map = buildLeafToTopMap(CATEGORIES);
    const grouped = groupClipsByTopCategory(clips, map);

    expect(grouped.get("uncategorized")?.length).toBe(1);
  });

  it("handles empty clip array", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    const grouped = groupClipsByTopCategory([], map);
    expect(grouped.size).toBe(0);
  });
});

describe("pickHeroAndSubs", () => {
  it("picks highest-star clip as hero, next 3 as subs", () => {
    const clips = [
      makeClip("1", "walk", 3),
      makeClip("2", "walk", 5),
      makeClip("3", "walk", 4),
      makeClip("4", "walk", 4),
      makeClip("5", "walk", 2),
    ];
    const { hero, subs } = pickHeroAndSubs(clips);

    expect(hero.id).toBe("2"); // star 5
    expect(subs).toHaveLength(3);
    expect(subs[0].id).toBe("3"); // star 4 (first in array)
    expect(subs[1].id).toBe("4"); // star 4 (second in array)
    expect(subs[2].id).toBe("1"); // star 3
  });

  it("returns hero only when fewer than 2 clips", () => {
    const clips = [makeClip("1", "walk", 3)];
    const { hero, subs } = pickHeroAndSubs(clips);
    expect(hero.id).toBe("1");
    expect(subs).toHaveLength(0);
  });

  it("handles all-zero stars by using array order", () => {
    const clips = [
      makeClip("a", "walk", 0),
      makeClip("b", "walk", 0),
      makeClip("c", "walk", 0),
    ];
    const { hero, subs } = pickHeroAndSubs(clips);
    expect(hero.id).toBe("a"); // first in array
    expect(subs).toHaveLength(2);
  });

  it("limits subs to 3 even with many clips", () => {
    const clips = Array.from({ length: 10 }, (_, i) =>
      makeClip(`${i}`, "walk", i)
    );
    const { subs } = pickHeroAndSubs(clips);
    expect(subs).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/feedGrouping.test.ts`
Expected: FAIL — 모듈이 존재하지 않음

- [ ] **Step 3: 구현 작성**

```typescript
// src/lib/feedGrouping.ts
import type { BrowseSummaryRecord, CategoryTree } from "./types";

export interface TopCategoryInfo {
  topSlug: string;
  topFolderId: string;
  topI18n: { ko: string; en: string };
}

/**
 * Build a map from every slug (leaf + top-level) to its top-level parent info.
 * categories.json has ~10 top-level × ~5 children = ~50 entries. Cheap.
 */
export function buildLeafToTopMap(
  categories: CategoryTree
): Map<string, TopCategoryInfo> {
  const map = new Map<string, TopCategoryInfo>();
  for (const [folderId, node] of Object.entries(categories)) {
    const topInfo: TopCategoryInfo = {
      topSlug: node.slug,
      topFolderId: folderId,
      topI18n: node.i18n,
    };
    map.set(node.slug, topInfo);
    if (node.children) {
      for (const child of Object.values(node.children)) {
        map.set(child.slug, topInfo);
      }
    }
  }
  return map;
}

/**
 * Single-pass grouping: iterate all clips once, bucket by top-level slug.
 * O(n) where n = total clip count.
 */
export function groupClipsByTopCategory(
  clips: BrowseSummaryRecord[],
  leafToTopMap: Map<string, TopCategoryInfo>
): Map<string, BrowseSummaryRecord[]> {
  const grouped = new Map<string, BrowseSummaryRecord[]>();
  for (const clip of clips) {
    const topInfo = leafToTopMap.get(clip.category);
    const key = topInfo?.topSlug ?? "uncategorized";
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = [];
      grouped.set(key, bucket);
    }
    bucket.push(clip);
  }
  return grouped;
}

const MAX_SUBS = 3;

/**
 * Pick the highest-star clip as hero, next 3 highest as subs.
 * Stable sort: ties preserve original array order (proxy for newest-first).
 */
export function pickHeroAndSubs(clips: BrowseSummaryRecord[]): {
  hero: BrowseSummaryRecord;
  subs: BrowseSummaryRecord[];
} {
  // Sort descending by star, preserving original order for ties
  const sorted = clips
    .map((clip, idx) => ({ clip, idx }))
    .sort((a, b) => b.clip.star - a.clip.star || a.idx - b.idx);

  const hero = sorted[0].clip;
  const subs = sorted.slice(1, 1 + MAX_SUBS).map((s) => s.clip);
  return { hero, subs };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/feedGrouping.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedGrouping.ts src/lib/feedGrouping.test.ts
git commit -m "feat: add feedGrouping utils with leaf-to-top mapping"
```

---

### Task 3: FeedCategorySection 컴포넌트

**Files:**
- Create: `src/app/[lang]/browse/FeedCategorySection.tsx`

각 카테고리 섹션을 렌더링하는 컴포넌트. 헤더(이름 + 클립 수 + "전체 보기") + 히어로 카드 + 서브 클립 3열.

- [ ] **Step 1: FeedCategorySection 작성**

```typescript
// src/app/[lang]/browse/FeedCategorySection.tsx
"use client";

import { ClipCard } from "@/components/clip/ClipCard";
import type { BrowseSummaryRecord, BrowseClipRecord, Locale } from "@/lib/types";

interface FeedCategorySectionProps {
  title: string;
  clipCount: number;
  hero: BrowseSummaryRecord;
  subs: BrowseSummaryRecord[];
  lang: Locale;
  onViewAll: () => void;
  onOpenQuickView: (clipId: string) => void;
}

export function FeedCategorySection({
  title,
  clipCount,
  hero,
  subs,
  lang,
  onViewAll,
  onOpenQuickView,
}: FeedCategorySectionProps) {
  const viewAllLabel = lang === "ko" ? "전체 보기" : "View all";

  return (
    <section className="mb-10">
      {/* Category header */}
      <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-border/50">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <span className="text-xs text-muted">
            {clipCount.toLocaleString()}
            {lang === "ko" ? "개 클립" : " clips"}
          </span>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-primary hover:underline"
        >
          {viewAllLabel} →
        </button>
      </div>

      {/* Hero card — large, with info.
         viewport 자동재생/정지는 ClipCard 내부의 useIntersectionLoader 훅이
         이미 처리하므로 별도 IntersectionObserver 불필요.
         previewOnHover={false} → viewport 진입 시 즉시 재생, 이탈 시 썸네일로 복귀. */}
      <div className="mb-3">
        <ClipCard
          clip={hero as BrowseClipRecord}
          lang={lang}
          enablePreview
          previewOnHover={false}
          showInfo
          onOpenQuickView={onOpenQuickView}
        />
      </div>

      {/* Sub clips — 3-column grid */}
      {subs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {subs.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip as BrowseClipRecord}
              lang={lang}
              enablePreview
              previewOnHover
              showInfo={false}
              onOpenQuickView={onOpenQuickView}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 에러 없음. `BrowseSummaryRecord`는 `BrowseClipRecord`의 상위 타입이므로 `as BrowseClipRecord` 캐스트가 필요. `ClipCard`는 optional 필드(tags, folders)가 없어도 동작함.

- [ ] **Step 3: Commit**

```bash
git add src/app/[lang]/browse/FeedCategorySection.tsx
git commit -m "feat: add FeedCategorySection component"
```

---

### Task 4: FeedView 컴포넌트

**Files:**
- Create: `src/app/[lang]/browse/FeedView.tsx`

피드 뷰 컨테이너. 카테고리별 그룹핑 + 섹션 렌더. `filterCategoriesByMode` 재사용.

- [ ] **Step 1: FeedView 작성**

```typescript
// src/app/[lang]/browse/FeedView.tsx
"use client";

import { useMemo, useCallback } from "react";
import { buildLeafToTopMap, groupClipsByTopCategory, pickHeroAndSubs } from "@/lib/feedGrouping";
import { filterCategoriesByMode } from "@/lib/categories";
import { useFilterStore } from "@/stores/filterStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useUIStore } from "@/stores/uiStore";
import { FeedCategorySection } from "./FeedCategorySection";
import type { BrowseSummaryRecord, CategoryTree, Locale } from "@/lib/types";

interface FeedViewProps {
  clips: BrowseSummaryRecord[];
  categories: CategoryTree;
  lang: Locale;
  onOpenQuickView: (clipId: string) => void;
}

export function FeedView({ clips, categories, lang, onOpenQuickView }: FeedViewProps) {
  const contentMode = useFilterStore((s) => s.contentMode);
  const { updateURL } = useFilterSync();
  const setViewMode = useUIStore((s) => s.setViewMode);

  const leafToTopMap = useMemo(
    () => buildLeafToTopMap(categories),
    [categories]
  );

  // Group clips by top-level category, respecting contentMode
  const sections = useMemo(() => {
    const visibleCategories = filterCategoriesByMode(categories, contentMode);
    const visibleTopSlugs = new Set(
      Object.values(visibleCategories).map((n) => n.slug)
    );

    const grouped = groupClipsByTopCategory(clips, leafToTopMap);

    // Build ordered sections: only visible categories with clips
    const result: {
      topSlug: string;
      topFolderId: string;
      title: string;
      clips: BrowseSummaryRecord[];
    }[] = [];

    // Iterate categories in their original order (Object.entries preserves insertion order)
    for (const [folderId, node] of Object.entries(categories)) {
      if (!visibleTopSlugs.has(node.slug)) continue;
      const bucket = grouped.get(node.slug);
      if (!bucket || bucket.length === 0) continue;
      result.push({
        topSlug: node.slug,
        topFolderId: folderId,
        title: node.i18n[lang] || node.slug,
        clips: bucket,
      });
    }

    return result;
  }, [clips, categories, leafToTopMap, contentMode, lang]);

  const handleViewAll = useCallback(
    (topFolderId: string) => {
      updateURL({ selectedFolders: [topFolderId] });
      setViewMode("masonry");
    },
    [updateURL, setViewMode]
  );

  if (sections.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted">
        {lang === "ko" ? "표시할 카테고리가 없습니다" : "No categories to display"}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-5 py-6">
        {sections.map((section) => {
          const { hero, subs } = pickHeroAndSubs(section.clips);
          return (
            <FeedCategorySection
              key={section.topSlug}
              title={section.title}
              clipCount={section.clips.length}
              hero={hero}
              subs={subs}
              lang={lang}
              onViewAll={() => handleViewAll(section.topFolderId)}
              onOpenQuickView={onOpenQuickView}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/app/[lang]/browse/FeedView.tsx
git commit -m "feat: add FeedView container with category grouping"
```

---

### Task 5: BrowseClient 분기 로직

**Files:**
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`

`showFeed` 분기 추가. 피드일 때 `FeedView` 렌더, 아닐 때 기존 `MasonryGrid`.

- [ ] **Step 1: import 추가 + viewMode 가져오기**

`BrowseClient.tsx` 상단에 `FeedView` import 추가:
```typescript
import { FeedView } from "./FeedView";
```

`useUIStore` 셀렉터에 `viewMode` 추가 (기존 `useShallow` 블록, 약 line 122-136):
```typescript
const {
  quickViewOpen,
  setQuickViewOpen,
  stepThumbnailSize,
  shuffleSeed,
  thumbnailSize,
  viewMode, // 추가
} = useUIStore(
  useShallow((s) => ({
    quickViewOpen: s.quickViewOpen,
    setQuickViewOpen: s.setQuickViewOpen,
    stepThumbnailSize: s.stepThumbnailSize,
    shuffleSeed: s.shuffleSeed,
    thumbnailSize: s.thumbnailSize,
    viewMode: s.viewMode, // 추가
  }))
);
```

- [ ] **Step 2: showFeed 분기 변수 추가**

기존 `hasActiveBrowseFilters` (line 165) 아래에 추가:
```typescript
// Feed-specific filter check: exclude contentMode and sortBy
const hasFeedBlockingFilters =
  filters.category !== null ||
  filters.selectedFolders.length > 0 ||
  filters.selectedTags.length > 0 ||
  filters.excludedTags.length > 0 ||
  filters.starFilter !== null ||
  filters.searchQuery.length > 0;

const showFeed = viewMode === "feed" && !hasFeedBlockingFilters;
```

- [ ] **Step 3: return문에 FeedView 분기 추가**

기존 return문 (약 line 440-485)에서 `MasonryGrid` 렌더링 앞에 showFeed 분기:

기존 코드의 빈 상태 체크 (line 432) 바로 뒤, `return (<>` 이전에:
```typescript
if (showFeed) {
  return (
    <>
      <FeedView
        clips={initialDisplayClips}
        categories={categories}
        lang={lang}
        onOpenQuickView={openQuickViewForClip}
      />
      {quickViewOpen && selectedClip ? (
        <QuickViewModal
          clip={selectedClip}
          lang={lang}
          tagI18n={tagI18n}
          dict={dict}
          onClose={handleCloseQuickView}
        />
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: 타입 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/app/[lang]/browse/BrowseClient.tsx
git commit -m "feat: add showFeed branch in BrowseClient"
```

---

### Task 6: LeftPanelContent "전체" 버튼 연동

**Files:**
- Modify: `src/app/[lang]/browse/LeftPanelContent.tsx:94-95`

"전체" 버튼 클릭 시 `setViewMode('feed')` 추가.

- [ ] **Step 1: setViewMode import 추가**

`LeftPanelContent.tsx`의 기존 `useUIStore` 사용 (line 44) 확장:
```typescript
const { setFilterBarOpen, setActiveFilterTab, setViewMode } = useUIStore();
```

- [ ] **Step 2: "전체" 버튼 onClick에 setViewMode 추가**

기존 onClick (line 95):
```typescript
onClick={() => updateURL({ category: null, selectedTags: [], selectedFolders: [], starFilter: null, sortBy: "newest" })}
```
변경:
```typescript
onClick={() => {
  updateURL({ category: null, selectedTags: [], selectedFolders: [], starFilter: null, sortBy: "newest" });
  setViewMode("feed");
}}
```

- [ ] **Step 3: 폴더 클릭 시 자동 masonry 전환**

`LeftPanelContent.tsx`의 폴더 클릭 핸들러 (`onFolderClick`, 약 line 179)에서, 폴더가 실제로 선택될 때 `setViewMode("masonry")` 호출 추가. 기존 `updateURL({ selectedFolders: next })` 바로 앞에:

```typescript
if (next.length > 0) {
  setViewMode("masonry");
}
```

이렇게 하면 폴더 선택 시 자동으로 그리드로 전환되고, 폴더 해제 시에는 viewMode가 유지된다. 사용자가 필터를 모두 해제하면 viewMode가 `"feed"`인 경우 피드로 자동 복귀하는 동작은 의도된 것이다 (viewMode가 persist되므로).

> **참고 (persist 동작):** `uiStore`의 `partialize`에 `viewMode`가 포함되어 있어 `"feed"`가 localStorage에 저장됨. 사용자가 피드 모드를 선택하면 다음 방문에도 유지. 이것은 의도된 동작 — 사용자의 뷰 선호를 존중.

- [ ] **Step 4: 타입 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/app/[lang]/browse/LeftPanelContent.tsx
git commit -m "feat: switch to feed view on '전체' click, auto-masonry on folder select"
```

---

### Task 7: SubToolbar 피드/그리드 토글 + 셔플 비활성화

**Files:**
- Modify: `src/components/layout/SubToolbar.tsx`

피드/그리드 토글 버튼 추가 (썸네일 슬라이더 좌측). 피드 모드에서 셔플 비활성화.

- [ ] **Step 1: viewMode/setViewMode 가져오기**

기존 `useUIStore` 셀렉터 (line 33-51)에 추가:
```typescript
viewMode: state.viewMode,
setViewMode: state.setViewMode,
```

- [ ] **Step 2: 피드 모드에서 셔플 비활성화**

기존 셔플 버튼 (line 167-176)의 조건을 변경:
```typescript
{isProUser ? (
  <button
    type="button"
    aria-label={shuffleLabel}
    onClick={reshuffleClips}
    disabled={viewMode === "feed"}
    className={`p-1.5 rounded hover:bg-surface-hover text-muted ${
      viewMode === "feed" ? "opacity-40 cursor-not-allowed" : ""
    }`}
  >
    <RefreshIcon />
  </button>
) : null}
```

- [ ] **Step 3: 피드/그리드 토글 추가**

썸네일 사이즈 슬라이더 (line 224) 앞에 토글 추가:
```typescript
{/* View mode toggle */}
<div className="flex items-center rounded bg-surface/60 border border-border overflow-hidden mr-2">
  <button
    type="button"
    onClick={() => setViewMode("feed")}
    className={`px-2 py-1 text-[11px] ${
      viewMode === "feed"
        ? "bg-accent text-white"
        : "text-muted hover:text-foreground"
    }`}
  >
    {lang === "ko" ? "피드" : "Feed"}
  </button>
  <button
    type="button"
    onClick={() => setViewMode("masonry")}
    className={`px-2 py-1 text-[11px] ${
      viewMode !== "feed"
        ? "bg-accent text-white"
        : "text-muted hover:text-foreground"
    }`}
  >
    {lang === "ko" ? "그리드" : "Grid"}
  </button>
</div>
```

Note: `SubToolbar`의 props에 이미 `lang`이 있음.

- [ ] **Step 4: 타입 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/SubToolbar.tsx
git commit -m "feat: add feed/grid toggle and disable shuffle in feed mode"
```

---

### Task 8: (Scope-out) 키보드 네비게이션

> **Phase 2로 연기.** 디자인 스펙에서 피드 전용 키보드 네비게이션을 명시했지만 (ArrowDown = 다음 카드, ArrowUp = 이전 카드), 현재 BrowseClient의 grid 네비게이션은 `columnCount` 기반이라 피드에서 부적합하다. 피드 전용 키보드 핸들링은 별도 PR로 구현한다. 현재는 피드 모드에서 기존 키보드 단축키(Escape, +/-, Enter/Space)만 동작하고, 화살표 네비게이션은 동작하지 않는다 (기존 navigateGrid가 filtered 배열 기준으로 동작하므로 의도치 않은 동작 없음).

---

### Task 9: 통합 테스트 + 수동 확인

**Files:**
- No new files

- [ ] **Step 1: 기존 테스트 실행**

Run: `npx vitest run`
Expected: 모든 테스트 PASS (기존 + feedGrouping)

- [ ] **Step 2: 빌드 확인**

Run: `npm run build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 3: 수동 확인 (dev 서버)**

Run: `npm run dev`

확인 항목:
1. `http://localhost:3000/ko/browse` 접속 → "전체" 클릭 → 매거진 피드 표시
2. 카테고리 섹션별 히어로 + 서브 3개 표시 확인
3. "전체 보기 →" 클릭 → 해당 카테고리 폴더 필터 적용 + 그리드로 전환
4. 폴더 선택 → 그리드로 전환 확인
5. 피드/그리드 토글 버튼 동작 확인
6. 피드 모드에서 셔플 버튼 비활성화 확인
7. 피드에서 클립 클릭 → 우측 패널 업데이트 확인
8. 피드에서 클립 더블클릭 → 퀵뷰 열기 확인

- [ ] **Step 4: Commit (필요시 수정사항)**

```bash
git add -A
git commit -m "fix: integration fixes for feed view"
```
