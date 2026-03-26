# Reflix 100K / 1M Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reflix를 `10만 클립`까지는 현재 제품 경험을 유지한 채 안정적으로 운영 가능하게 만들고, `100만 클립`부터는 별도 메타데이터 조회 계층으로 무리 없이 전환할 수 있게 한다.

**Architecture:** `browse`를 “전체 카탈로그를 클라이언트에 전달한 뒤 로컬 필터링” 구조에서 “서버 질의 + 페이지네이션 + 패싯 응답” 구조로 전환한다. 메타데이터는 앱 번들에 포함되는 `src/data/index.json`에서 분리해 shard/manifest 기반 정적 데이터 또는 이후 DB-backed repository로 읽게 하고, 미디어는 `thumbnail/public preview/protected full video`로 역할을 분리한다. export는 배치 단위 처리만 수행하고, 전체 코퍼스 재계산은 비동기 인덱싱 단계로 분리한다.

**Tech Stack:** Next.js 16 App Router, React 19, Route Handlers, Zustand, Vitest, Node.js export scripts, Cloudflare Worker/R2

**Input:** 2026-03-26 기준 스케일 리뷰 결과 (`/browse` 전체 index 전달, 클라이언트 전체 배열 필터링, static clip JSON 누적, blob 기반 detail playback, export 후 전체 related recompute)

---

## Milestones

### Milestone A: 100K Stabilization

- `/browse`가 전체 `clips[]`를 RSC/client payload로 전달하지 않는다.
- 필터/검색/정렬이 서버 응답 기반으로 동작한다.
- `src/data/index.json` 단일 import가 제거된다.
- 상세 페이지는 전체 blob 다운로드가 아니라 표준 `<video src>` 스트리밍으로 재생한다.
- browse preview는 공유 캐시 가능한 경로를 사용한다.
- export 배치 처리 시간이 전체 퍼블리시 corpus 크기에 선형 재의존하지 않는다.

### Milestone B: 1M Cutover

- browse/search/facet 조회가 shard 스캔이 아니라 queryable metadata store를 통해 동작한다.
- related clips, facet aggregates, 검색 인덱스가 비동기 파이프라인으로 생성된다.
- 앱 서버는 “정적 파일 + DB/검색 API 클라이언트” 역할만 수행한다.

---

### Task 1: Metadata Repository 경계 만들기

**Files:**
- Create: `src/lib/catalog-repository.ts`
- Create: `src/lib/catalog-repository.test.ts`
- Modify: `src/lib/data.ts`
- Reference: `src/lib/types.ts`

- [ ] **Step 1: Repository contract 테스트 추가**

```ts
import { describe, expect, it } from "vitest";
import { createInMemoryCatalogRepository } from "./catalog-repository";

describe("catalog repository", () => {
  it("returns paginated browse results without exposing the full catalog", async () => {
    const repo = createInMemoryCatalogRepository([
      { id: "A", name: "Alpha", tags: ["magic"], folders: ["f1"], star: 3, category: "direction-video", width: 640, height: 360, duration: 1, previewUrl: "/previews/A.mp4", thumbnailUrl: "/thumbnails/A.webp", lqipBase64: "" },
      { id: "B", name: "Beta", tags: ["sword"], folders: ["f2"], star: 4, category: "combat", width: 640, height: 360, duration: 2, previewUrl: "/previews/B.mp4", thumbnailUrl: "/thumbnails/B.webp", lqipBase64: "" },
    ]);

    const result = await repo.listClips({
      limit: 1,
      searchQuery: "Alpha",
      selectedTags: [],
      excludedTags: [],
      selectedFolders: [],
      sortBy: "newest",
      category: null,
      locale: "ko",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("A");
    expect(result.total).toBe(1);
    expect(result.nextCursor).toBeNull();
  });
});
```

- [ ] **Step 2: Repository contract 구현**

```ts
export interface BrowseQuery {
  limit: number;
  cursor?: string | null;
  selectedFolders: string[];
  selectedTags: string[];
  excludedTags: string[];
  starFilter: number | null;
  searchQuery: string;
  sortBy: SortBy;
  category: string | null;
  locale: Locale;
}

export interface BrowseResult {
  items: ClipIndex[];
  total: number;
  nextCursor: string | null;
  facets: {
    folderCounts: Record<string, number>;
    tagCounts: Record<string, number>;
  };
}

export interface CatalogRepository {
  listClips(query: BrowseQuery): Promise<BrowseResult>;
  getClipById(id: string): Promise<Clip | null>;
}
```

- [ ] **Step 3: `data.ts`를 repository 경유로 바꾸기**

```ts
import { getCatalogRepository } from "@/lib/catalog-repository";

export async function getClip(id: string): Promise<Clip | null> {
  return getCatalogRepository().getClipById(id);
}
```

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/lib/catalog-repository.test.ts src/lib/data.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog-repository.ts src/lib/catalog-repository.test.ts src/lib/data.ts
git commit -m "refactor: add catalog repository boundary"
```

---

### Task 2: App Bundle에서 Monolithic Index 제거

**Files:**
- Modify: `scripts/lib/index-builder.mjs`
- Modify: `scripts/export.mjs`
- Create: `src/lib/catalog-files.ts`
- Create: `src/lib/catalog-files.test.ts`
- Modify: `src/lib/data.ts`

- [ ] **Step 1: 현재 단일 index 대신 manifest + shard 포맷 테스트 추가**

```ts
expect(manifest).toEqual({
  version: 1,
  totalCount: 1000,
  shards: [
    { id: "0000", path: "/data/catalog/shards/0000.json", itemCount: 500 },
    { id: "0001", path: "/data/catalog/shards/0001.json", itemCount: 500 },
  ],
});
```

- [ ] **Step 2: export가 shard와 manifest를 쓰도록 구현**

```js
const manifest = writeCatalogShards({
  outputDir: path.join(outputDir, "public", "data", "catalog"),
  entries: Array.from(mergedEntries.values()),
  shardSize: 1000,
});

fs.writeFileSync(
  path.join(outputDir, "public", "data", "catalog", "manifest.json"),
  JSON.stringify(manifest, null, 2)
);
```

- [ ] **Step 3: `getClipIndex()` 제거, 파일 기반 loader로 교체**

```ts
export async function loadCatalogManifest(): Promise<CatalogManifest> {
  const fs = await import("fs");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "public", "data", "catalog", "manifest.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
```

- [ ] **Step 4: `src/data/index.json` import 경로를 남기지 않았는지 확인**

Run: `rg -n "@/data/index.json|src/data/index.json|getClipIndex\\(" src scripts`

Expected: 신규 repository/shard loader 외 직접 import 없음

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/index-builder.mjs scripts/export.mjs src/lib/catalog-files.ts src/lib/catalog-files.test.ts src/lib/data.ts
git commit -m "refactor: move catalog index out of app bundle into shard manifest"
```

---

### Task 3: Browse를 Server Query + Pagination으로 전환

**Files:**
- Create: `src/lib/browse-service.ts`
- Create: `src/lib/browse-service.test.ts`
- Create: `src/app/api/clips/route.ts`
- Modify: `src/app/[lang]/browse/page.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `src/app/[lang]/browse/LeftPanelContent.tsx`
- Modify: `src/components/filter/FilterPanel.tsx`
- Modify: `src/components/filter/TagFilterPanel.tsx`
- Modify: `src/components/filter/FolderTree.tsx`
- Delete or stop using: `src/app/[lang]/browse/ClipDataProvider.tsx`

- [ ] **Step 1: browse service 테스트 추가**

```ts
it("returns items plus tag/folder facets for the current filter set", async () => {
  const result = await listBrowseClips(repo, {
    limit: 60,
    searchQuery: "",
    selectedFolders: [],
    selectedTags: ["magic"],
    excludedTags: [],
    starFilter: null,
    sortBy: "newest",
    category: null,
    locale: "ko",
  });

  expect(result.items.length).toBeLessThanOrEqual(60);
  expect(result.facets.tagCounts.magic).toBeGreaterThan(0);
  expect(result.facets.folderCounts).toBeDefined();
});
```

- [ ] **Step 2: route handler 구현**

```ts
export async function GET(request: NextRequest) {
  const query = parseBrowseQuery(request.nextUrl.searchParams);
  const result = await listBrowseClips(getCatalogRepository(), query);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
```

- [ ] **Step 3: browse page를 “초기 결과만 주입” 방식으로 교체**

```tsx
const initialBrowseData = await listBrowseClips(getCatalogRepository(), {
  limit: 60,
  cursor: null,
  selectedFolders: [],
  selectedTags: [],
  excludedTags: [],
  starFilter: null,
  searchQuery: "",
  sortBy: "newest",
  category: null,
  locale: lang as Locale,
});

<BrowseClient
  initialBrowseData={initialBrowseData}
  categories={categories}
  tagI18n={tagI18n}
  lang={lang as Locale}
  dict={dict}
/>
```

- [ ] **Step 4: client filtering 제거, API fetch 기반으로 바꾸기**

```tsx
const [browseData, setBrowseData] = useState(initialBrowseData);

useEffect(() => {
  const controller = new AbortController();
  const params = new URLSearchParams(serializeFilters(filters));
  fetch(`/api/clips?${params.toString()}`, { signal: controller.signal })
    .then((res) => res.json())
    .then(setBrowseData);
  return () => controller.abort();
}, [filters]);
```

- [ ] **Step 5: facet UI를 `clips[]`가 아니라 `facet counts` 소비자로 교체**

```tsx
<LeftPanelContent
  categories={categories}
  folderCounts={browseData.facets.folderCounts}
  totalCount={browseData.total}
  lang={lang}
  dict={dict}
/>

<TagFilterPanel
  tagGroups={tagGroups}
  tagCounts={browseData.facets.tagCounts}
  totalTagCount={Object.keys(browseData.facets.tagCounts).length}
  ...
/>
```

- [ ] **Step 6: Verify payload regression is gone**

Run: `npm run build`

Run: `rg -n '"clips":\\[' .next/server/app/ko/browse.rsc -a -S`

Expected: full catalog array가 browse RSC에 없음

- [ ] **Step 7: Commit**

```bash
git add src/lib/browse-service.ts src/lib/browse-service.test.ts src/app/api/clips/route.ts src/app/[lang]/browse/page.tsx src/app/[lang]/browse/BrowseClient.tsx src/app/[lang]/browse/LeftPanelContent.tsx src/components/filter/FilterPanel.tsx src/components/filter/TagFilterPanel.tsx src/components/filter/FolderTree.tsx src/app/[lang]/browse/ClipDataProvider.tsx
git commit -m "refactor: move browse filtering and facets to server queries"
```

---

### Task 4: Detail Playback을 Streaming으로 되돌리고 Preview 전략 분리

**Files:**
- Modify: `src/components/clip/ClipDetailLayout.tsx`
- Modify: `src/components/clip/VideoPlayer.tsx`
- Modify: `src/lib/blobVideo.ts`
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`
- Modify: `src/lib/mediaSession.ts`
- Modify: `workers/media-gateway/src/index.ts`
- Modify: `workers/media-gateway/src/index.test.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: detail playback 테스트를 blob preload 금지 기준으로 작성**

```ts
it("uses the direct video URL for detail playback when protected media is streamable", () => {
  render(<ClipDetailLayout videoUrl="/videos/A.mp4" thumbnailUrl="/thumbnails/A.webp" duration={3} />);
  expect(screen.getByRole("video")).toHaveAttribute("src", expect.stringContaining("/videos/A.mp4"));
});
```

- [ ] **Step 2: `useBlobUrl` 제거 또는 기본 비활성화**

```tsx
<VideoPlayer
  videoUrl={videoUrl}
  thumbnailUrl={thumbnailUrl}
  duration={duration}
  useBlobUrl={false}
  isExpanded={isExpanded}
  onExpandToggle={() => setIsExpanded((prev) => !prev)}
/>;
```

- [ ] **Step 3: preview는 cacheable public path로 분리**

```ts
const PROTECTED_PREFIXES = ["/videos/"] as const;
const PUBLIC_CACHEABLE_PREFIXES = ["/thumbnails/", "/previews/"] as const;
```

```ts
if (url.pathname.startsWith("/previews/") || url.pathname.startsWith("/thumbnails/")) {
  const response = await serveR2Object(request, env, key, false);
  response.headers.set("cache-control", "public, max-age=31536000, immutable");
  return response;
}
```

- [ ] **Step 4: `next/image`는 인증이 필요한 자원에 쓰지 않도록 정리**

```tsx
<Image
  src={thumbnailUrl}
  alt={clip.name}
  fill
  unoptimized
  sizes="33vw"
  className="object-contain"
/>
```

- [ ] **Step 5: Verify worker behavior**

Run: `npx vitest run workers/media-gateway/src/index.test.ts src/lib/blobVideo.test.ts src/components/clip/VideoPlayer.test.tsx`

Expected: preview public/cacheable, full video protected/range streaming, blob fetch path 제거

- [ ] **Step 6: Commit**

```bash
git add src/components/clip/ClipDetailLayout.tsx src/components/clip/VideoPlayer.tsx src/lib/blobVideo.ts src/components/clip/ClipCard.tsx src/components/layout/RightPanelInspector.tsx src/lib/mediaSession.ts workers/media-gateway/src/index.ts workers/media-gateway/src/index.test.ts next.config.ts
git commit -m "refactor: stream protected videos and make previews cacheable"
```

---

### Task 5: Export에서 전체 Corpus 재계산 제거

**Files:**
- Modify: `scripts/export.mjs`
- Modify: `scripts/lib/similarity.mjs`
- Create: `scripts/lib/catalog-jobs.mjs`
- Create: `scripts/lib/catalog-jobs.test.mjs`
- Modify: `scripts/export.test.mjs`

- [ ] **Step 1: export 테스트를 “현재 배치만 갱신” 기준으로 추가**

```js
test("runExport does not rewrite every published clip JSON after a small batch", async () => {
  const summary = await runExport(flags, { projectRoot: tmpDir, env });
  assert.equal(summary.processed, 2);
  assert.equal(summary.catalogJobQueued, true);
  assert.deepEqual(summary.rewrittenClipIds.sort(), ["A", "B"]);
});
```

- [ ] **Step 2: related recompute를 inline export에서 제거하고 job enqueue로 대체**

```js
console.log("\n🧾 Queueing catalog refresh job...");
const catalogJob = enqueueCatalogRefreshJob({
  projectRoot,
  changedClipIds: clipIds,
});
```

- [ ] **Step 3: 비동기 catalog refresh job 구현**

```js
export async function refreshCatalogArtifacts({ projectRoot }) {
  const entries = await readAllCatalogEntries(projectRoot);
  const relatedMap = computeRelatedClips(entries);
  await writeRelatedClipSidecars({ projectRoot, relatedMap });
  await writeFacetSnapshots({ projectRoot, entries });
}
```

- [ ] **Step 4: 운영 명령 분리**

```json
"catalog:refresh": "node scripts/catalog-refresh.mjs",
"export:batch": "node scripts/export.mjs",
"export:batch:r2": "node scripts/export.mjs --r2"
```

- [ ] **Step 5: Run script tests**

Run: `node --test scripts/export.test.mjs scripts/lib/catalog-jobs.test.mjs scripts/lib/index-builder.test.mjs`

- [ ] **Step 6: Commit**

```bash
git add scripts/export.mjs scripts/lib/similarity.mjs scripts/lib/catalog-jobs.mjs scripts/lib/catalog-jobs.test.mjs scripts/export.test.mjs package.json
git commit -m "refactor(export): move full catalog recompute into async refresh job"
```

---

### Task 6: 100K 검증용 Synthetic Corpus / Performance Gate 추가

**Files:**
- Create: `scripts/generate-synthetic-catalog.mjs`
- Create: `scripts/benchmark-browse.mjs`
- Create: `scripts/benchmark-browse.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: synthetic catalog generator 추가**

```js
node scripts/generate-synthetic-catalog.mjs --count 100000 --output .tmp/catalog-100k
```

- [ ] **Step 2: browse benchmark 정의**

```js
const thresholds = {
  initialPayloadBytes: 300_000,
  firstResponseMs: 400,
  filterResponseMs: 500,
};
```

- [ ] **Step 3: CI/로컬 실행 명령 추가**

```json
"bench:browse:100k": "node scripts/benchmark-browse.mjs --dataset .tmp/catalog-100k",
"catalog:synthetic:100k": "node scripts/generate-synthetic-catalog.mjs --count 100000 --output .tmp/catalog-100k"
```

- [ ] **Step 4: Verify against explicit gates**

Run: `npm run catalog:synthetic:100k`

Run: `npm run bench:browse:100k`

Expected:
- `/browse` initial payload이 threshold 이하
- filter/search round-trip이 threshold 이하
- detail playback에서 full file blob preload 없음

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-synthetic-catalog.mjs scripts/benchmark-browse.mjs scripts/benchmark-browse.test.mjs package.json
git commit -m "test: add 100k synthetic catalog benchmark gates"
```

---

### Task 7: 1M Cutover용 DB/Search Repository 추가

**Files:**
- Create: `src/lib/catalog-repository-db.ts`
- Create: `src/lib/catalog-repository-db.test.ts`
- Modify: `src/lib/catalog-repository.ts`
- Create: `scripts/catalog-sync.mjs`
- Create: `docs/ARCHITECTURE-catalog.md`

- [ ] **Step 1: file-backed / db-backed repository 선택 스위치 추가**

```ts
export function getCatalogRepository(): CatalogRepository {
  if (process.env.CATALOG_REPOSITORY === "db") {
    return createDbCatalogRepository();
  }
  return createFileCatalogRepository();
}
```

- [ ] **Step 2: DB schema / query 목표 고정**

```sql
CREATE TABLE clips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  star INTEGER NOT NULL,
  duration REAL NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  thumbnail_url TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  search_text TEXT NOT NULL
);
```

- [ ] **Step 3: metadata sync job 추가**

```js
await upsertClips(db, clips);
await replaceClipTags(db, clipTags);
await replaceClipFolders(db, clipFolders);
await refreshFacetTables(db);
```

- [ ] **Step 4: browse API가 DB-backed repository로 동일 contract를 만족하는지 검증**

Run: `npx vitest run src/lib/catalog-repository.test.ts src/lib/catalog-repository-db.test.ts src/lib/browse-service.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog-repository-db.ts src/lib/catalog-repository-db.test.ts src/lib/catalog-repository.ts scripts/catalog-sync.mjs docs/ARCHITECTURE-catalog.md
git commit -m "feat: add db-backed catalog repository for 1m cutover"
```

---

## Rollout Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Ship 100K
8. Task 7
9. Ship 1M

## Explicit Non-Goals

- browse에서 `1M`을 static JSON shard 스캔만으로 끝까지 버티려 하지 않는다.
- 보호가 필요한 full video와 browse preview를 동일 정책으로 묶지 않는다.
- export 배치 실행 시 전체 corpus rewrite를 다시 허용하지 않는다.

## Success Criteria

- `npm run build` 후 `.next/server/app/ko/browse.rsc`에 full `clips[]` 직렬화가 없다.
- `100K` synthetic dataset에서 browse 초기 payload와 query latency가 gate 이내다.
- 상세 페이지 네트워크에서 full-video blob preload가 사라지고 ranged media request만 보인다.
- export 배치 실행 시간은 “배치 크기”에 비례하고, 전체 catalog refresh는 분리된 job으로 이동한다.
- `1M` 전환 시 API contract는 그대로 두고 repository 구현만 교체한다.
