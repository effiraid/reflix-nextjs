# Browse Pagefind Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/browse` 검색을 전체 projection/filter-index 스캔 방식에서 Pagefind 기반 ID 검색으로 전환해, 10k 클립 규모에서도 검색 시 전체 JSON 다운로드 병목을 제거한다.

**Architecture:** 빌드 시 `public/pagefind/`에 locale-aware Pagefind 인덱스를 생성하고, 클라이언트는 검색어가 있을 때만 Pagefind에서 `clip id` 목록을 받아온다. browse 화면은 기존 cards display envelope를 렌더 source로 유지하되, tag/folder/category 같은 구조 필터는 기존 로컬 로직을 쓰고, 텍스트 검색은 Pagefind 결과 ID와 교집합 처리한다. 한국어 `초성 검색`, `영타→한글 변환`, `clipSearch.ts`의 전체 배열 점수 계산은 browse 검색 경로에서 제거한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Zustand, Vitest, Testing Library, Pagefind Node API

**Spec:** `docs/superpowers/specs/2026-03-29-reflix-browse-pagefind-search-design.md`

---

## Current Decisions

- 검색 UX는 계속 `/browse` 안에서 동작한다. `/search` 전용 페이지는 만들지 않는다.
- `public/pagefind/`는 빌드 산출물로 취급하고 git에 커밋하지 않는다.
- Pagefind 인덱스는 `public/data/index.json` + `src/data/tag-i18n.json`에서 생성한다.
- 한국어 `초성 검색`, `영타→한글 변환`은 이번 단계에서 제거한다.
- 태그 패널 내부의 소규모 태그 이름 검색은 기존 `createMatcher()`를 그대로 유지한다.
- 검색 결과 렌더에는 여전히 cards display envelope를 사용한다. detail-grade JSON은 검색 렌더용으로 올리지 않는다.
- search-only 경로는 `filter-index`를 받지 않는다. tag/folder/category filters가 함께 있는 경우에만 projection이 필요할 수 있다.

## File Structure

```text
repo root/
├── .gitignore                                      ← ignore generated public/pagefind
├── package.json                                    ← add pagefind dependency + search index script
└── package-lock.json                               ← dependency lock update

scripts/
├── build-pagefind-index.mjs                        ← build public/pagefind from clip index
└── lib/
    ├── pagefind-records.mjs                        ← locale-aware Pagefind record builder
    └── pagefind-records.test.mjs                   ← record builder coverage

src/lib/
├── browsePagefind.ts                               ← client Pagefind adapter (init/search/result ids)
├── browsePagefind.test.ts                          ← adapter coverage with mocked pagefind module
├── browse-service.ts                               ← search no longer implies projection requirement
├── browse-service.test.ts                          ← updated requirement tests
├── filter.ts                                       ← split structural filtering from text search
├── filter.test.ts                                  ← structural filter coverage
├── clipSearch.ts                                   ← remove browse-wide array search usage or deprecate
└── search.ts                                       ← remove choseong / qwerty conversion helpers if unused

src/app/[lang]/browse/
├── ClipDataProvider.tsx                            ← cards/projection loading separated
├── ClipDataProvider.test.tsx                       ← cards-only vs projection loading coverage
├── BrowseClient.tsx                                ← async Pagefind search + structural filter intersection
├── BrowseClient.test.tsx                           ← browse search integration coverage
├── page.tsx                                        ← cards bootstrap stays lightweight
└── page.test.tsx                                   ← browse shell regression coverage

src/components/layout/
├── Navbar.tsx                                      ← search focus prewarms Pagefind instead of projection
├── Navbar.test.tsx                                 ← prewarm callback coverage
├── MobileSearchOverlay.tsx                         ← same Pagefind path for mobile search
└── MobileSearchOverlay.test.tsx                    ← mobile search integration coverage
```

---

### Task 1: Add Build-Time Pagefind Index Generation

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/lib/pagefind-records.mjs`
- Create: `scripts/lib/pagefind-records.test.mjs`
- Create: `scripts/build-pagefind-index.mjs`

- [ ] **Step 1: Write failing tests for locale-specific Pagefind records**

Create `scripts/lib/pagefind-records.test.mjs` with coverage for:
- Korean record content includes Korean name + original tags
- English record content includes translated tags from `tag-i18n.json`
- records include deterministic `url`, `language`, and `meta.clipId`
- records do **not** include choseong or qwerty-expanded fallback strings

Add tests like:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildPagefindRecords } from "./pagefind-records.mjs";

test("buildPagefindRecords emits ko and en records with clipId metadata", () => {
  const records = buildPagefindRecords(
    [
      {
        id: "clip-1",
        name: "슬픈 걷기",
        tags: ["걷기", "슬픔"],
        aiTags: {
          actionType: ["걷기"],
          emotion: ["슬픔"],
          composition: [],
          pacing: "느림",
          characterType: [],
          effects: [],
          description: { ko: "슬픈 장면", en: "sad scene" },
          model: "test",
          generatedAt: "2026-03-29T00:00:00.000Z",
        },
        folders: [],
        category: "acting",
      },
    ],
    { 걷기: "Walk", 슬픔: "Sadness" }
  );

  assert.equal(records.length, 2);
});
```

Use plain `assert.equal(records.length, 2)` etc. Verify:
- `records.find(r => r.language === "ko").meta.clipId === "clip-1"`
- English content includes `"Walk"` and `"Sadness"`
- No record content contains `getChoseong` output like `"ㅅㅍ"` or qwerty fallback text

- [ ] **Step 2: Run the new tests to confirm failure**

Run:

```bash
node --test scripts/lib/pagefind-records.test.mjs
```

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Implement the record builder**

Create `scripts/lib/pagefind-records.mjs` exporting:

```js
function joinSearchContent(values) {
  return values
    .flat()
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
}

function getStructuredAiTags(aiTags) {
  if (!aiTags) return [];
  return [
    ...(aiTags.actionType ?? []),
    ...(aiTags.emotion ?? []),
    ...(aiTags.composition ?? []),
    aiTags.pacing,
    ...(aiTags.characterType ?? []),
    ...(aiTags.effects ?? []),
  ].filter(Boolean);
}

export function buildPagefindRecords(indexEntries, tagI18n = {}) {
  return indexEntries.flatMap((entry) => {
    const structured = getStructuredAiTags(entry.aiTags);
    const enTags = (entry.tags ?? []).map((tag) => tagI18n[tag] || tag);
    const enStructured = structured.map((tag) => tagI18n[tag] || tag);

    return [
      {
        url: `/ko/clip/${entry.id}`,
        language: "ko",
        content: joinSearchContent([
          entry.name,
          entry.tags ?? [],
          structured,
          entry.searchTokens ?? [],
        ]),
        meta: {
          clipId: entry.id,
          name: entry.name,
        },
        filters: {
          category: [entry.category || "uncategorized"],
          tags: entry.tags ?? [],
          folders: entry.folders ?? [],
        },
      },
      {
        url: `/en/clip/${entry.id}`,
        language: "en",
        content: joinSearchContent([
          entry.name,
          enTags,
          enStructured,
          entry.searchTokens ?? [],
        ]),
        meta: {
          clipId: entry.id,
          name: entry.name,
        },
        filters: {
          category: [entry.category || "uncategorized"],
          tags: enTags,
          folders: entry.folders ?? [],
        },
      },
    ];
  });
}
```

- [ ] **Step 4: Add the actual build script**

Create `scripts/build-pagefind-index.mjs`:

```js
#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import * as pagefind from "pagefind";
import { buildPagefindRecords } from "./lib/pagefind-records.mjs";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const indexPath = path.join(projectRoot, "public", "data", "index.json");
const tagI18nPath = path.join(projectRoot, "src", "data", "tag-i18n.json");
const outputPath = path.join(projectRoot, "public", "pagefind");

if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing clip index: ${indexPath}`);
}

const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
const tagI18n = fs.existsSync(tagI18nPath)
  ? JSON.parse(fs.readFileSync(tagI18nPath, "utf-8"))
  : {};

fs.rmSync(outputPath, { recursive: true, force: true });

const { index } = await pagefind.createIndex({ writePlayground: false, verbose: false });
for (const record of buildPagefindRecords(indexData.clips ?? [], tagI18n)) {
  const { errors } = await index.addCustomRecord(record);
  if (errors?.length) {
    throw new Error(errors.join("\n"));
  }
}
await index.writeFiles({ outputPath });
await pagefind.close();
```

- [ ] **Step 5: Wire the script into build**

Update `.gitignore`:

```gitignore
public/pagefind/
```

Update `package.json` scripts:

```json
"search:index": "node scripts/build-pagefind-index.mjs",
"build": "node scripts/prepare-protected-public-build.mjs && node scripts/build-pagefind-index.mjs && next build"
```

Add `"pagefind"` to `devDependencies`.

- [ ] **Step 6: Verify the build-side pieces**

Run:

```bash
npm install
node --test scripts/lib/pagefind-records.test.mjs
npm run search:index
```

Expected:
- tests PASS
- `public/pagefind/pagefind.js` exists
- `git status --short public/pagefind` stays clean because `.gitignore` covers it

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json scripts/lib/pagefind-records.mjs scripts/lib/pagefind-records.test.mjs scripts/build-pagefind-index.mjs
git commit -m "feat(search): add build-time Pagefind index generation"
```

---

### Task 2: Split Cards Loading From Projection Loading

**Files:**
- Modify: `src/lib/browse-service.ts`
- Modify: `src/lib/browse-service.test.ts`
- Modify: `src/app/[lang]/browse/ClipDataProvider.tsx`
- Modify: `src/app/[lang]/browse/ClipDataProvider.test.tsx`

- [ ] **Step 1: Add a failing browse-service test that search no longer requires projection**

Extend `src/lib/browse-service.test.ts` with:

```ts
it("does not require detailed browse index for search-only queries", () => {
  expect(
    requiresDetailedBrowseIndex({
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "alpha",
    })
  ).toBe(false);
});
```

- [ ] **Step 2: Add failing provider tests for cards-only prewarm vs projection loading**

In `src/app/[lang]/browse/ClipDataProvider.test.tsx`, add:

```tsx
it("fetches cards only when search surfaces request prewarm", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => cards,
  });
  vi.stubGlobal("fetch", fetchMock);

  function CardsProbe() {
    const { requestCardIndex } = useBrowseData() as ReturnType<typeof useBrowseData> & {
      requestCardIndex?: () => void;
    };
    return <button onClick={() => requestCardIndex?.()}>cards</button>;
  }

  render(
    <ClipDataProvider clips={initialClips}>
      <CardsProbe />
    </ClipDataProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: "cards" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/browse/cards",
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
});
```

Also keep a separate test proving tag/folder surfaces still load both cards + filter-index through `requestDetailedIndex`.

- [ ] **Step 3: Run tests to confirm failure**

Run:

```bash
npx vitest run 'src/lib/browse-service.test.ts' 'src/app/[lang]/browse/ClipDataProvider.test.tsx'
```

Expected: FAIL because `searchQuery` still implies detailed index and the provider has no cards-only request path.

- [ ] **Step 4: Implement the split loading contract**

Update `requiresDetailedBrowseIndex` in `src/lib/browse-service.ts` to:

```ts
export function requiresDetailedBrowseIndex(
  filters: Pick<FilterState, "selectedFolders" | "excludedFolders" | "selectedTags" | "excludedTags">
) {
  return (
    filters.selectedFolders.length > 0 ||
    filters.excludedFolders.length > 0 ||
    filters.selectedTags.length > 0 ||
    filters.excludedTags.length > 0
  );
}
```

Refactor `ClipDataProvider.tsx` to keep separate state:

```tsx
const [allCards, setAllCards] = useState<BrowseCardRecord[] | null>(null);
const [cardsStatus, setCardsStatus] = useState<ProjectionStatus>("loading");
const [projectionClips, setProjectionClips] = useState<BrowseProjectionRecord[] | null>(null);

const requestCardIndex = useCallback(() => setCardIndexRequested(true), []);
const requestDetailedIndex = useCallback(() => setDetailedIndexRequested(true), []);
```

Cards fetch:

```tsx
fetch("/api/browse/cards", { signal: controller.signal })
```

Projection fetch:

```tsx
if (!allCards) await loadCardsFirst();
fetch("/api/browse/filter-index", { signal: controller.signal })
```

Expose `allCards`, `cardsStatus`, and `requestCardIndex` from the context.

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run 'src/lib/browse-service.test.ts' 'src/app/[lang]/browse/ClipDataProvider.test.tsx'
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/browse-service.ts src/lib/browse-service.test.ts src/app/[lang]/browse/ClipDataProvider.tsx src/app/[lang]/browse/ClipDataProvider.test.tsx
git commit -m "refactor(browse): split cards prewarm from detailed projection loading"
```

---

### Task 3: Add a Client Pagefind Search Adapter

**Files:**
- Create: `src/lib/browsePagefind.ts`
- Create: `src/lib/browsePagefind.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `src/lib/browsePagefind.test.ts` covering:
- `prewarmBrowseSearch()` imports `/pagefind/pagefind.js` and calls `init()`
- `searchBrowseClipIds()` returns clip IDs from result metadata
- empty queries short-circuit to `[]`
- language change calls `destroy()` before `init()` again

Example shape:

```ts
it("returns clip ids from Pagefind result metadata", async () => {
  const pagefindMock = {
    init: vi.fn(),
    search: vi.fn(async () => ({
      results: [
        { data: async () => ({ meta: { clipId: "clip-a" } }) },
        { data: async () => ({ meta: { clipId: "clip-b" } }) },
      ],
    })),
  };

  vi.stubGlobal("__mockPagefindImport", vi.fn(async () => pagefindMock));

  const ids = await searchBrowseClipIds("ko", "alpha", {
    importPagefind: globalThis.__mockPagefindImport,
  });

  expect(ids).toEqual(["clip-a", "clip-b"]);
});
```

- [ ] **Step 2: Run the tests to confirm failure**

Run:

```bash
npx vitest run 'src/lib/browsePagefind.test.ts'
```

Expected: FAIL because the adapter file does not exist.

- [ ] **Step 3: Implement the adapter**

Create `src/lib/browsePagefind.ts`:

```ts
type PagefindModule = {
  init: () => Promise<void> | void;
  destroy?: () => Promise<void> | void;
  search: (
    query: string,
    options?: Record<string, unknown>
  ) => Promise<{
    results: Array<{ data: () => Promise<{ meta?: Record<string, string> }> }>;
  }>;
};

let loadedModule: PagefindModule | null = null;
let activeLang: string | null = null;

async function defaultImportPagefind(): Promise<PagefindModule> {
  return import("/pagefind/pagefind.js") as Promise<PagefindModule>;
}

export async function prewarmBrowseSearch(
  lang: string,
  { importPagefind = defaultImportPagefind } = {}
) {
  const module = loadedModule ?? (await importPagefind());
  if (loadedModule && activeLang && activeLang !== lang) {
    await loadedModule.destroy?.();
  }
  loadedModule = module;
  activeLang = lang;
  await loadedModule.init();
  return loadedModule;
}

export async function searchBrowseClipIds(
  lang: string,
  query: string,
  { importPagefind = defaultImportPagefind } = {}
) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const pagefind = await prewarmBrowseSearch(lang, { importPagefind });
  const search = await pagefind.search(trimmed);
  const results = await Promise.all(search.results.map((result) => result.data()));

  return results
    .map((result) => result.meta?.clipId)
    .filter((clipId): clipId is string => typeof clipId === "string" && clipId.length > 0);
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run 'src/lib/browsePagefind.test.ts'
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/browsePagefind.ts src/lib/browsePagefind.test.ts
git commit -m "feat(search): add Pagefind browse search adapter"
```

---

### Task 4: Replace Legacy Browse Text Search With Pagefind in BrowseClient

**Files:**
- Modify: `src/lib/filter.ts`
- Modify: `src/lib/filter.test.ts`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.test.tsx`

- [ ] **Step 1: Write failing tests for structural filtering without text search**

Add `filter.ts` coverage for a new helper:

```ts
it("filters tags and folders without applying text search", () => {
  const filtered = filterClipsByStructure(clips, {
    ...baseFilters,
    searchQuery: "Alpha",
    selectedTags: ["마법"],
  });

  expect(filtered.map((clip) => clip.id)).toEqual(["clip-1", "clip-2"]);
});
```

Add `BrowseClient` coverage:
- search-only path uses Pagefind IDs and does **not** require projection
- search + selectedTags path waits for projection and then intersects
- result order follows Pagefind result order, not alphabetical fallback

Use a mocked `searchBrowseClipIds`:

```ts
vi.mock("@/lib/browsePagefind", () => ({
  prewarmBrowseSearch: vi.fn(),
  searchBrowseClipIds: vi.fn(async () => ["clip-c", "clip-a"]),
}));
```

- [ ] **Step 2: Run tests to confirm failure**

Run:

```bash
npx vitest run 'src/lib/filter.test.ts' 'src/app/[lang]/browse/BrowseClient.test.tsx'
```

Expected: FAIL because the code still routes text search through `filterClips`.

- [ ] **Step 3: Implement structural-only filtering**

In `src/lib/filter.ts`, extract:

```ts
export function filterClipsByStructure<T extends FilterableClipRecord>(
  clips: T[],
  filters: FilterState,
  categories?: CategoryTree,
  boardClipIds?: Set<string> | null
): T[] {
  let result = clips;
  // board/category/contentMode/folder/tag logic only
  return result;
}
```

Then make `filterClips` call it and only apply local text search when explicitly still needed elsewhere.

- [ ] **Step 4: Integrate async Pagefind search into BrowseClient**

Refactor `BrowseClient.tsx`:

1. Read `allCards`, `cardsStatus`, `requestCardIndex`, `projectionClips`, `projectionStatus` from `useBrowseData()`
2. Prewarm cards + Pagefind on search focus via navbar/mobile overlay callback
3. Run async effect when `filters.searchQuery` changes:

```tsx
const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

useEffect(() => {
  if (!filters.searchQuery.trim()) {
    setSearchResultIds(null);
    setSearchStatus("idle");
    return;
  }

  let cancelled = false;
  setSearchStatus("loading");
  requestCardIndex();

  void searchBrowseClipIds(lang, filters.searchQuery).then((ids) => {
    if (cancelled) return;
    setSearchResultIds(ids);
    setSearchStatus("ready");
  }).catch(() => {
    if (cancelled) return;
    setSearchStatus("error");
  });

  return () => {
    cancelled = true;
  };
}, [filters.searchQuery, lang, requestCardIndex]);
```

4. Compute final clips:

```tsx
const baseCards = allCards ?? initialClips;
const structuralFilters = { ...effectiveFilters, searchQuery: "" };
const structuralSource =
  projectionClips && projectionStatus === "ready" && hasDetailedFilters
    ? projectionClips
    : baseCards;
const structurallyFiltered = filterClipsByStructure(
  structuralSource,
  structuralFilters,
  categories,
  activeBoardClipIds
);

const searchIdSet = searchResultIds ? new Set(searchResultIds) : null;
const finalClips =
  searchIdSet
    ? searchResultIds
        .map((id) => structurallyFiltered.find((clip) => clip.id === id))
        .filter(Boolean)
    : structurallyFiltered;
```

Where `hasDetailedFilters` means folder/tag filters that need projection.

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run 'src/lib/filter.test.ts' 'src/app/[lang]/browse/BrowseClient.test.tsx'
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/filter.ts src/lib/filter.test.ts 'src/app/[lang]/browse/BrowseClient.tsx' 'src/app/[lang]/browse/BrowseClient.test.tsx'
git commit -m "feat(browse): use Pagefind ids for browse text search"
```

---

### Task 5: Migrate Mobile Search and Remove Browse Dependence on Legacy Local Text Search

**Files:**
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/Navbar.test.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.test.tsx`
- Modify: `src/lib/clipSearch.ts`
- Modify: `src/lib/clipSearch.test.ts`
- Modify: `src/lib/search.ts`
- Modify: `src/lib/search.test.ts`

- [ ] **Step 1: Add failing mobile search tests**

Extend `MobileSearchOverlay.test.tsx` to prove:
- opening the overlay prewarms cards/Pagefind
- search results are driven by mocked `searchBrowseClipIds`, not local `searchClips`
- loading label shows while Pagefind/cards are not ready

- [ ] **Step 2: Run tests to confirm failure**

Run:

```bash
npx vitest run \
  'src/components/layout/Navbar.test.tsx' \
  'src/components/layout/MobileSearchOverlay.test.tsx' \
  'src/lib/clipSearch.test.ts' \
  'src/lib/search.test.ts'
```

Expected: FAIL because the overlay still uses local `searchClips`, and the old Korean helpers still exist.

- [ ] **Step 3: Update navbar/mobile search prewarm path**

`Navbar.tsx`:
- desktop search focus should call `requestCardIndex()` and `prewarmBrowseSearch(lang)`
- mobile overlay open should do the same

`MobileSearchOverlay.tsx`:
- stop importing `searchClips`
- when query changes, call `searchBrowseClipIds(lang, query)`
- render results from `allCards` lookup provided by context or passed prop

Recommended minimal rendering flow:

```tsx
const [resultIds, setResultIds] = useState<string[] | null>(null);
const cardMap = useMemo(() => new Map(cards.map((clip) => [clip.id, clip])), [cards]);
const results = resultIds?.map((id) => cardMap.get(id)).filter(Boolean) ?? [];
```

- [ ] **Step 4: Remove legacy browse-wide Korean convenience search**

In `src/lib/search.ts`, remove:

```ts
export function isChoseongOnly(...) {}
export function isLatinOnly(...) {}
```

and simplify Korean matcher to plain includes:

```ts
export function matchesKorean(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}
```

Then remove or de-scope `clipSearch.ts` so it is no longer used by browse/mobile search. Keep only what is still needed by small local tag lists, or delete unused code if tests prove it is dead.

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run \
  'src/components/layout/Navbar.test.tsx' \
  'src/components/layout/MobileSearchOverlay.test.tsx' \
  'src/lib/clipSearch.test.ts' \
  'src/lib/search.test.ts'
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Navbar.tsx src/components/layout/Navbar.test.tsx src/components/layout/MobileSearchOverlay.tsx src/components/layout/MobileSearchOverlay.test.tsx src/lib/clipSearch.ts src/lib/clipSearch.test.ts src/lib/search.ts src/lib/search.test.ts
git commit -m "refactor(search): remove legacy browse-wide local text search"
```

---

### Task 6: Full Verification and Manual Network Check

**Files:**
- No new code unless verification reveals regressions

- [ ] **Step 1: Run the targeted verification suite**

Run:

```bash
npx vitest run \
  'src/lib/browse-service.test.ts' \
  'src/lib/filter.test.ts' \
  'src/lib/browsePagefind.test.ts' \
  'src/app/[lang]/browse/ClipDataProvider.test.tsx' \
  'src/app/[lang]/browse/BrowseClient.test.tsx' \
  'src/components/layout/Navbar.test.tsx' \
  'src/components/layout/MobileSearchOverlay.test.tsx'
```

Expected: ALL PASS

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected:
- Pagefind index generation succeeds
- Next build succeeds
- `public/pagefind/pagefind.js` exists after the script runs

- [ ] **Step 3: Manual network verification**

Run the dev server:

```bash
npm run dev
```

Then verify:

1. Open `http://localhost:3000/ko/browse`
2. Confirm first visit does **not** request `/api/browse/filter-index`
3. Focus the desktop search input
4. Confirm prewarm path requests `/api/browse/cards` and Pagefind bundle files, but not `/api/browse/filter-index`
5. Type a query
6. Confirm results appear and stay inside `/browse`
7. Add a tag or folder filter and confirm results narrow correctly
8. Repeat on mobile overlay

- [ ] **Step 4: Record the before/after network contract**

Capture this exact summary in the task log or PR:

```text
Before:
- search focus fetched /api/browse/cards + /api/browse/filter-index
- text search ran against full local projection/filter-index data

After:
- first browse visit fetched no detailed search data
- search focus fetched /api/browse/cards + /pagefind/* only
- search query no longer required /api/browse/filter-index unless structural filters were also active
```

- [ ] **Step 5: Check working tree**

Run:

```bash
git status --short
```

Expected:
- only intended source changes remain
- `public/pagefind/` does not pollute git status

---

## Follow-Up Notes

- If broad-query search later needs better Korean UX, add a dedicated Korean search enhancement as a separate task after 10k rollout is stable.
- If `result.data()` cost turns out high for very broad queries, the next optimization should be a tiny lookup manifest keyed by result URL or clipId metadata, not a return to full `filter-index` downloads.
- Do not reintroduce `searchQuery` into `requiresDetailedBrowseIndex`; that would partially undo priority 1.
