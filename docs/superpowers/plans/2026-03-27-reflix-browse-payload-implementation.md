# Reflix Browse Payload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browse 첫 진입에서는 가벼운 summary만 전달하고, projection background preload + selection detail lazy load 구조로 10k 클립 규모의 browse payload를 안정화한다.

**Architecture:** export가 `summary`, `projection`, `clip detail`을 분리 생성하도록 바꾸고, browse route는 server query 결과의 첫 page만 주입한다. client는 background에서 projection을 preload한 뒤 local search/filter를 수행하고, 오른쪽 패널 / quick view / detail page는 공통 detail loader로 무거운 정보를 개별 로드한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand, Vitest, Node.js export scripts

---

### Task 1: Browse Artifact 타입과 Loader 경계 만들기

**Files:**
- Create: `src/lib/browse-data.ts`
- Create: `src/lib/browse-data.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`

- [ ] **Step 1: Browse artifact 타입 테스트 추가**

```ts
import { describe, expect, it } from "vitest";
import { normalizeBrowseProjectionRecord } from "./browse-data";

describe("browse-data", () => {
  it("normalizes a projection record without detail-only fields", () => {
    const record = normalizeBrowseProjectionRecord({
      id: "clip-1",
      name: "Magic Attack",
      thumbnailUrl: "/thumbnails/clip-1.webp",
      previewUrl: "/previews/clip-1.mp4",
      width: 1280,
      height: 720,
      duration: 2.1,
      star: 4,
      category: "combat",
      tags: ["magic"],
      aiStructuredTags: ["spell", "attack"],
      folders: ["folder-1"],
      searchTokens: ["magic", "spell", "attack"],
    });

    expect(record.id).toBe("clip-1");
    expect(record.searchTokens).toContain("magic");
    expect("annotation" in record).toBe(false);
  });
});
```

- [ ] **Step 2: Browse artifact 타입 정의 추가**

```ts
export interface BrowseSummaryRecord {
  id: string;
  name: string;
  thumbnailUrl: string;
  previewUrl: string;
  lqipBase64: string;
  width: number;
  height: number;
  duration: number;
  star: number;
  category: string;
}

export interface BrowseProjectionRecord extends BrowseSummaryRecord {
  tags: string[];
  aiStructuredTags: string[];
  folders: string[];
  searchTokens: string[];
}
```

- [ ] **Step 3: `src/lib/data.ts`에 loader 경계 추가**

```ts
export async function loadBrowseSummary(): Promise<BrowseSummaryRecord[]> {
  const fs = await import("fs");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "public", "data", "browse", "summary.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export async function loadBrowseProjection(): Promise<BrowseProjectionRecord[]> {
  const fs = await import("fs");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "public", "data", "browse", "projection.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
```

- [ ] **Step 4: 기존 full index import 경계 고정**

Run: `rg -n "@/data/index.json|getClipIndex\\(" src scripts`

Expected: browse 신규 loader 도입 전까지 남아 있는 참조 위치만 확인되고, 이후 Task 3 완료 시 browse 쪽 참조는 0개가 된다.

- [ ] **Step 5: Run targeted tests**

Run: `npx vitest run src/lib/browse-data.test.ts src/lib/data.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/browse-data.ts src/lib/browse-data.test.ts src/lib/types.ts src/lib/data.ts
git commit -m "refactor: add browse artifact types and loaders"
```

### Task 2: Export가 Summary / Projection Artifact를 생성하게 바꾸기

**Files:**
- Modify: `scripts/lib/index-builder.mjs`
- Modify: `scripts/export.mjs`
- Create: `scripts/lib/browse-artifacts.mjs`
- Create: `scripts/lib/browse-artifacts.test.mjs`

- [ ] **Step 1: Artifact generation 테스트 추가**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildBrowseArtifacts } from "./browse-artifacts.mjs";

test("buildBrowseArtifacts splits summary and projection fields", () => {
  const { summary, projection } = buildBrowseArtifacts([
    {
      id: "A",
      name: "Arcane Attack",
      tags: ["arcane", "attack"],
      aiTags: {
        actionType: ["attack"],
        emotion: ["anger"],
        composition: ["close-up"],
        pacing: "fast",
        characterType: ["mage"],
        effects: ["glow"],
        description: { ko: "상세 설명", en: "detail description" },
        model: "gemini",
        generatedAt: "2026-03-27T00:00:00.000Z",
      },
      folders: ["f1"],
      star: 4,
      category: "combat",
      width: 1280,
      height: 720,
      duration: 2,
      previewUrl: "/previews/A.mp4",
      thumbnailUrl: "/thumbnails/A.webp",
      lqipBase64: "data:image/jpeg;base64,AAA",
    },
  ]);

  assert.equal(summary[0].id, "A");
  assert.equal("tags" in summary[0], false);
  assert.deepEqual(projection[0].aiStructuredTags, ["attack", "anger", "close-up", "fast", "mage", "glow"]);
});
```

- [ ] **Step 2: Artifact builder 구현**

```js
export function buildBrowseArtifacts(entries) {
  const summary = entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    thumbnailUrl: entry.thumbnailUrl,
    previewUrl: entry.previewUrl,
    lqipBase64: entry.lqipBase64,
    width: entry.width,
    height: entry.height,
    duration: entry.duration,
    star: entry.star,
    category: entry.category,
  }));

  const projection = entries.map((entry) => ({
    ...summary.find((summaryEntry) => summaryEntry.id === entry.id),
    tags: entry.tags,
    aiStructuredTags: getStructuredAiTags(entry.aiTags),
    folders: entry.folders,
    searchTokens: buildSearchTokens(entry),
  }));

  return { summary, projection };
}
```

- [ ] **Step 3: export write 단계에 browse artifacts 추가**

```js
const { summary, projection } = buildBrowseArtifacts(Array.from(mergedEntries.values()));
fs.mkdirSync(path.join(outputDir, "public", "data", "browse"), { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "public", "data", "browse", "summary.json"),
  JSON.stringify(summary, null, 2)
);
fs.writeFileSync(
  path.join(outputDir, "public", "data", "browse", "projection.json"),
  JSON.stringify(projection, null, 2)
);
```

- [ ] **Step 4: `ClipIndex` 생성에서 detail-only field 제거**

```js
export function buildClipIndex(meta, lqipBase64) {
  return {
    id: meta.id,
    name: meta.name,
    star: meta.star || 0,
    category: getCategoryForFolders(meta.folders || []),
    width: meta.width || 640,
    height: meta.height || 360,
    duration: meta.duration || 0,
    previewUrl: `/previews/${meta.id}.mp4`,
    thumbnailUrl: `/thumbnails/${meta.id}.webp`,
    lqipBase64: lqipBase64 || "",
  };
}
```

- [ ] **Step 5: Run targeted tests**

Run: `node --test scripts/lib/browse-artifacts.test.mjs scripts/lib/index-builder.test.mjs scripts/export.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/browse-artifacts.mjs scripts/lib/browse-artifacts.test.mjs scripts/lib/index-builder.mjs scripts/export.mjs
git commit -m "refactor: export browse summary and projection artifacts"
```

### Task 3: Server Browse Query Service 만들기

**Files:**
- Create: `src/lib/browse-service.ts`
- Create: `src/lib/browse-service.test.ts`
- Create: `src/app/api/browse/route.ts`
- Modify: `src/lib/filter.ts`
- Modify: `src/lib/clipSearch.ts`

- [ ] **Step 1: Browse service 테스트 추가**

```ts
import { describe, expect, it } from "vitest";
import { listBrowseResults } from "./browse-service";

describe("browse-service", () => {
  it("returns the first page for a deep-link query", async () => {
    const result = await listBrowseResults({
      summary: [
        { id: "A", name: "Arcane", thumbnailUrl: "/thumbnails/A.webp", previewUrl: "/previews/A.mp4", lqipBase64: "", width: 640, height: 360, duration: 1, star: 3, category: "direction-video" },
      ],
      projection: [
        { id: "A", name: "Arcane", thumbnailUrl: "/thumbnails/A.webp", previewUrl: "/previews/A.mp4", lqipBase64: "", width: 640, height: 360, duration: 1, star: 3, category: "direction-video", tags: ["arcane"], aiStructuredTags: [], folders: ["f1"], searchTokens: ["arcane"] },
      ],
      query: {
        limit: 60,
        searchQuery: "arcane",
        selectedTags: [],
        excludedTags: [],
        selectedFolders: [],
        starFilter: null,
        sortBy: "newest",
        category: null,
        lang: "en",
      },
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.facets.tagCounts.arcane).toBe(1);
  });
});
```

- [ ] **Step 2: Browse service 구현**

```ts
export async function listBrowseResults({
  summary,
  projection,
  query,
}: {
  summary: BrowseSummaryRecord[];
  projection: BrowseProjectionRecord[];
  query: BrowseQuery;
}): Promise<BrowseResult> {
  const projectedMatches = filterProjection(projection, query);
  const items = projectedMatches.slice(0, query.limit).map(toSummaryRecord);

  return {
    items,
    total: projectedMatches.length,
    nextCursor: projectedMatches.length > query.limit ? String(query.limit) : null,
    facets: buildProjectionFacets(projectedMatches),
  };
}
```

- [ ] **Step 3: Route handler 추가**

```ts
import { NextRequest, NextResponse } from "next/server";
import { loadBrowseProjection, loadBrowseSummary } from "@/lib/data";
import { listBrowseResults, parseBrowseQuery } from "@/lib/browse-service";

export async function GET(request: NextRequest) {
  const query = parseBrowseQuery(request.nextUrl.searchParams);
  const [summary, projection] = await Promise.all([
    loadBrowseSummary(),
    loadBrowseProjection(),
  ]);
  const result = await listBrowseResults({ summary, projection, query });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
```

- [ ] **Step 4: `filter.ts` / `clipSearch.ts`를 projection-friendly helper로 분리**

```ts
export function searchProjection(
  records: BrowseProjectionRecord[],
  options: SearchProjectionOptions
): BrowseProjectionRecord[] {
  // existing clipSearch scoring adapted to projection fields
}
```

- [ ] **Step 5: Run targeted tests**

Run: `npx vitest run src/lib/browse-service.test.ts src/lib/clipSearch.test.ts src/lib/filter.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/browse-service.ts src/lib/browse-service.test.ts src/app/api/browse/route.ts src/lib/filter.ts src/lib/clipSearch.ts
git commit -m "feat: add server browse query service"
```

### Task 4: Browse Page를 Initial Result + Projection Preload 구조로 전환하기

**Files:**
- Modify: `src/app/[lang]/browse/page.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `src/app/[lang]/browse/ClipDataProvider.tsx`
- Create: `src/hooks/useBrowseProjection.ts`
- Create: `src/hooks/useBrowseProjection.test.ts`

- [ ] **Step 1: Projection preload hook 테스트 추가**

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { useBrowseProjection } from "./useBrowseProjection";

it("loads projection in the background and exposes ready state", async () => {
  const { result } = renderHook(() => useBrowseProjection("/data/browse/projection.json"));
  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("ready"));
});
```

- [ ] **Step 2: Projection preload hook 구현**

```ts
export function useBrowseProjection(url: string) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; records: BrowseProjectionRecord[] }>({
    status: "loading",
    records: [],
  });

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      fetch(url)
        .then((res) => res.json())
        .then((records) => {
          if (!cancelled) setState({ status: "ready", records });
        })
        .catch(() => {
          if (!cancelled) setState({ status: "error", records: [] });
        });
    };

    const id = window.requestIdleCallback ? window.requestIdleCallback(run) : window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof id === "number") {
        window.cancelIdleCallback(id);
      } else {
        window.clearTimeout(id as number);
      }
    };
  }, [url]);

  return state;
}
```

- [ ] **Step 3: `browse/page.tsx`를 initial result 주입 방식으로 변경**

```tsx
const initialQuery = parseBrowsePageQuery(searchParams, lang as Locale);

const [dict, categories, tagGroups, tagI18n, summary, projection] = await Promise.all([
  getDictionary(lang as Locale),
  getCategories(),
  getTagGroups(),
  getTagI18n(),
  loadBrowseSummary(),
  loadBrowseProjection(),
]);

const initialBrowseData = await listBrowseResults({
  summary,
  projection,
  query: initialQuery,
});

<BrowseClient initialBrowseData={initialBrowseData} categories={categories} tagI18n={tagI18n} lang={lang as Locale} dict={dict} />
```

- [ ] **Step 4: `BrowseClient`를 local projection state 기준으로 재구성**

```tsx
const projection = useBrowseProjection("/data/browse/projection.json");
const filtered = useMemo(() => {
  if (projection.status !== "ready") {
    return initialBrowseData.items;
  }
  return filterProjectionRecords(projection.records, filters, lang, tagI18n);
}, [projection.status, projection.records, filters, lang, tagI18n, initialBrowseData.items]);
```

- [ ] **Step 5: 기존 full dataset provider 제거 또는 축소**

```tsx
<ClipDataProvider initialItems={initialBrowseData.items}>
  {children}
</ClipDataProvider>
```

- [ ] **Step 6: Run targeted tests**

Run: `npx vitest run src/hooks/useBrowseProjection.test.ts src/app/[lang]/browse/page.test.tsx src/app/[lang]/browse/BrowseClient.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/[lang]/browse/page.tsx src/app/[lang]/browse/BrowseClient.tsx src/app/[lang]/browse/ClipDataProvider.tsx src/hooks/useBrowseProjection.ts src/hooks/useBrowseProjection.test.ts
git commit -m "feat: switch browse to initial summary plus projection preload"
```

### Task 5: Search / Filter Surface를 Projection 기준으로 정리하기

**Files:**
- Modify: `src/components/filter/TagFilterPanel.tsx`
- Modify: `src/app/[lang]/browse/LeftPanelContent.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.tsx`
- Modify: `src/components/clip/MasonryGrid.tsx`

- [ ] **Step 1: 모바일 검색 결과 렌더 제한 테스트 추가**

```ts
it("caps mobile search results to avoid unbounded rendering", () => {
  const results = buildManyResults(500);
  const visible = capMobileSearchResults(results, 50);
  expect(visible).toHaveLength(50);
});
```

- [ ] **Step 2: 모바일 검색 결과 cap helper 추가**

```ts
const MOBILE_SEARCH_RESULT_LIMIT = 50;

const visibleResults = results.slice(0, MOBILE_SEARCH_RESULT_LIMIT);
```

- [ ] **Step 3: Tag / folder count 계산을 projection 기준으로 전환**

```tsx
const tagCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  for (const record of projectionRecords) {
    for (const tag of [...record.tags, ...record.aiStructuredTags]) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return counts;
}, [projectionRecords]);
```

- [ ] **Step 4: projection loading 상태를 검색 UI에 연결**

```tsx
<SearchBar
  initialQuery={currentSearchQuery}
  placeholder={dict.nav.searchPlaceholder}
  onSearch={handleSearch}
  isSearching={projectionStatus === "loading"}
  statusText={projectionStatus === "loading" ? dict.browse.preparingCatalog : undefined}
/>
```

- [ ] **Step 5: masonry 입력은 summary envelope만 사용하도록 보장**

```tsx
interface MasonryGridProps {
  clips: BrowseSummaryRecord[];
  lang?: Locale;
  tagI18n?: Record<string, string>;
  onOpenQuickView?: (clipId: string) => void;
}
```

- [ ] **Step 6: Run targeted tests**

Run: `npx vitest run src/components/filter/TagFilterPanel.test.tsx src/components/layout/MobileSearchOverlay.test.tsx src/components/layout/Navbar.test.tsx src/components/clip/MasonryGrid.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/filter/TagFilterPanel.tsx src/app/[lang]/browse/LeftPanelContent.tsx src/components/layout/Navbar.tsx src/components/layout/MobileSearchOverlay.tsx src/components/clip/MasonryGrid.tsx
git commit -m "refactor: drive browse search and filters from projection data"
```

### Task 6: Detail Lazy Load를 공통화하고 Browse Heavy Dependency를 제거하기

**Files:**
- Create: `src/lib/clip-detail-client.ts`
- Create: `src/lib/clip-detail-client.test.ts`
- Modify: `src/components/layout/RightPanelContent.tsx`
- Modify: `src/components/clip/QuickViewModal.tsx`
- Modify: `src/app/[lang]/clip/[id]/page.tsx`

- [ ] **Step 1: Detail client cache 테스트 추가**

```ts
import { describe, expect, it, vi } from "vitest";
import { createClipDetailClient } from "./clip-detail-client";

describe("clip-detail-client", () => {
  it("reuses cached clip detail for repeat requests", async () => {
    const fetcher = vi.fn(async (id: string) => ({ id }));
    const client = createClipDetailClient(fetcher);

    await client.load("clip-1");
    await client.load("clip-1");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Shared detail loader 구현**

```ts
export function createClipDetailClient(fetcher = fetchClipDetail) {
  const cache = new Map<string, Promise<Clip>>();

  return {
    load(id: string) {
      if (!cache.has(id)) {
        cache.set(id, fetcher(id));
      }
      return cache.get(id)!;
    },
    clear(id: string) {
      cache.delete(id);
    },
  };
}
```

- [ ] **Step 3: 오른쪽 패널을 shared detail client로 전환**

```tsx
useEffect(() => {
  if (!selectedClipId) return;
  dispatch({ type: "start" });
  clipDetailClient
    .load(selectedClipId)
    .then((nextClip) => dispatch({ type: "success", clip: nextClip }))
    .catch(() => dispatch({ type: "error" }));
}, [selectedClipId]);
```

- [ ] **Step 4: quick view도 selection detail lazy load 경로에 맞추기**

```tsx
const [clipDetail, setClipDetail] = useState<Clip | null>(null);

useEffect(() => {
  if (!clipId) return;
  clipDetailClient.load(clipId).then(setClipDetail);
}, [clipId]);
```

- [ ] **Step 5: Run targeted tests**

Run: `npx vitest run src/lib/clip-detail-client.test.ts src/components/layout/RightPanelContent.test.tsx src/components/clip/QuickViewModal.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/clip-detail-client.ts src/lib/clip-detail-client.test.ts src/components/layout/RightPanelContent.tsx src/components/clip/QuickViewModal.tsx
git commit -m "refactor: unify lazy-loaded clip detail access"
```

### Task 7: Payload Regression Gate와 Final Verification 추가

**Files:**
- Create: `scripts/generate-synthetic-browse-catalog.mjs`
- Create: `scripts/benchmark-browse-payload.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: synthetic dataset generator 추가**

```js
#!/usr/bin/env node
import fs from "node:fs";

const count = Number(process.argv[2] ?? 10000);
const outputPath = process.argv[3] ?? ".tmp/browse-10k";

fs.mkdirSync(outputPath, { recursive: true });
// write summary.json, projection.json fixtures for benchmark runs
```

- [ ] **Step 2: payload benchmark script 추가**

```js
#!/usr/bin/env node
import fs from "node:fs";
import zlib from "node:zlib";

const summary = fs.readFileSync(process.argv[2], "utf-8");
const projection = fs.readFileSync(process.argv[3], "utf-8");

console.log(JSON.stringify({
  summaryRawBytes: Buffer.byteLength(summary),
  summaryGzipBytes: zlib.gzipSync(summary).length,
  projectionRawBytes: Buffer.byteLength(projection),
  projectionGzipBytes: zlib.gzipSync(projection).length,
}, null, 2));
```

- [ ] **Step 3: package scripts 추가**

```json
{
  "scripts": {
    "catalog:browse:10k": "node scripts/generate-synthetic-browse-catalog.mjs 10000 .tmp/browse-10k",
    "bench:browse:payload": "node scripts/benchmark-browse-payload.mjs .tmp/browse-10k/summary.json .tmp/browse-10k/projection.json"
  }
}
```

- [ ] **Step 4: README에 browse payload architecture 문서화**

```md
- browse first load uses summary-only initial results
- browse search projection is fetched in the background
- clip detail is lazy loaded per selected item
```

- [ ] **Step 5: Run verification**

Run:

```bash
npm run lint
npx vitest run
npm run build
npm run catalog:browse:10k
npm run bench:browse:payload
```

Expected:

- lint/test/build PASS
- summary artifact size is materially smaller than the old full index design
- projection artifact remains acceptable for background preload

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-synthetic-browse-catalog.mjs scripts/benchmark-browse-payload.mjs package.json README.md
git commit -m "test: add browse payload regression gates"
```
