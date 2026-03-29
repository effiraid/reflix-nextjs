# Browse Bootstrap Payload Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우즈 첫 진입에서 전체 상세 인덱스를 자동으로 내려받지 않도록 바꿔서, 7k~10k 클립 규모에서도 첫 화면 진입 속도를 지키고 Pagefind 도입 전까지의 병목을 줄인다.

**Architecture:** 첫 화면은 가벼운 카드 payload만으로 렌더하고, 무거운 detailed browse index는 "정말 필요한 순간"에만 로드한다. `ClipDataProvider`가 상세 인덱스 로드의 단일 소유자가 되고, 검색 포커스/모바일 검색 오픈/태그 패널 오픈/URL 기반 상세 필터 활성화가 있을 때만 `/api/browse/filter-index`를 요청한다. 서버 쪽 browse bootstrap도 `summary + cards` 이중 로드를 없애고 `cards` 하나를 기본 lightweight source로 통일한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Zustand, Vitest, Testing Library

---

## Current Decisions

- 이 작업은 **Pagefind 도입 전 단계의 응급 구조조정**이다. 검색 알고리즘 자체는 바꾸지 않는다.
- `/api/browse/filter-index` 응답 shape는 유지한다. 이번 작업의 목표는 "언제 받느냐"를 바꾸는 것이지 "무엇을 받느냐"를 바꾸는 것이 아니다.
- `public/data/browse/summary.json` 파일은 일단 남겨 둔다. 다만 브라우즈 첫 화면 bootstrap에서는 `cards.json`을 우선 사용한다.
- 검색 제안(`allTags`, `popularTags`)은 detailed index가 준비되기 전까지 비어 있어도 괜찮다. 대신 입력창 자체와 실제 검색 동작은 깨지면 안 된다.
- URL에 `q`, `tag`, `exclude`, `folder`, `excludeFolder` 같은 상세 필터가 이미 들어 있는 경우에는 기존처럼 바로 detailed index를 로드한다.

## File Structure

```text
src/app/[lang]/browse/
├── ClipDataProvider.tsx                 ← detailed index on-demand loader + context API
├── ClipDataProvider.test.tsx            ← provider preload / on-demand fetch behavior
├── page.tsx                             ← browse bootstrap payload selection
└── page.test.tsx                        ← page shell bootstrap payload assertions

src/components/common/
├── SearchBar.tsx                        ← search focus hook for requesting detailed index
└── SearchBar.test.tsx                   ← focus callback coverage

src/components/layout/
├── Navbar.tsx                           ← desktop search activates detailed index loading
├── Navbar.test.tsx                      ← navbar passes activation intent
├── MobileSearchOverlay.tsx              ← mobile search opens detailed index on demand
└── MobileSearchOverlay.test.tsx         ← overlay loading / activation coverage

src/components/filter/
├── FilterPanel.tsx                      ← tag panel mount path
├── TagFilterPanel.tsx                   ← tag panel requests detailed index when opened
└── TagFilterPanel.test.tsx              ← loading behavior while index prepares

src/lib/
└── data.ts                              ← cards/summary bootstrap loader helpers
```

---

### Task 1: Freeze the New Loading Contract With Tests

**Files:**
- Modify: `src/app/[lang]/browse/ClipDataProvider.test.tsx`
- Modify: `src/components/common/SearchBar.test.tsx`
- Modify: `src/components/layout/Navbar.test.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.test.tsx`
- Modify: `src/app/[lang]/browse/page.test.tsx`

- [ ] **Step 1: Add a failing provider test that proves idle mount no longer fetches**

Add a new test in `src/app/[lang]/browse/ClipDataProvider.test.tsx`:

```tsx
it("does not auto-fetch detailed data on mount or idle when no detailed filter is active", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestIdleCallback", vi.fn((cb: IdleRequestCallback) => {
    cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    return 1;
  }));

  render(
    <ClipDataProvider clips={initialClips} initialTotalCount={42}>
      <Probe />
    </ClipDataProvider>
  );

  await Promise.resolve();
  expect(fetchMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add a failing provider test for explicit demand loading**

Extend the same test file with a tiny button harness:

```tsx
function DemandProbe() {
  const { requestDetailedIndex } = useBrowseData();
  return (
    <button type="button" onClick={() => requestDetailedIndex()}>
      demand
    </button>
  );
}

it("fetches detailed data exactly once after an explicit request", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => cards })
    .mockResolvedValueOnce({ ok: true, json: async () => filterIndex });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <ClipDataProvider clips={initialClips} initialTotalCount={42}>
      <DemandProbe />
    </ClipDataProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: "demand" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Add a failing SearchBar focus callback test**

In `src/components/common/SearchBar.test.tsx` add:

```tsx
it("calls onActivate when the search input receives focus", () => {
  const onActivate = vi.fn();

  render(
    <SearchBar
      initialQuery=""
      placeholder="Search clips"
      onSearch={vi.fn()}
      onActivate={onActivate}
    />
  );

  fireEvent.focus(screen.getByRole("searchbox", { name: "Search clips" }));
  expect(onActivate).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 4: Add failing surface tests for desktop and mobile search activation**

Add:

- `src/components/layout/Navbar.test.tsx`

```tsx
expect(searchBarProps.onActivate).toBeTypeOf("function");
searchBarProps.onActivate();
expect(requestDetailedIndex).toHaveBeenCalledTimes(1);
```

- `src/components/layout/MobileSearchOverlay.test.tsx`

```tsx
it("requests search preparation as soon as the overlay opens", () => {
  const onRequestSearchReady = vi.fn();

  render(
    <MobileSearchOverlay
      open
      clips={clips}
      searchReady={false}
      onRequestSearchReady={onRequestSearchReady}
      ...
    />
  );

  expect(onRequestSearchReady).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 5: Add a failing page bootstrap test that cards are the only lightweight source**

In `src/app/[lang]/browse/page.test.tsx`, change the shell test setup so `BrowsePageShell` is fed `browseCards` only, then assert:

```tsx
expect(clipDataProviderProps).toMatchObject({
  clips: browseCards,
  initialTotalCount: 1,
  totalClipCount: 3,
});
```

- [ ] **Step 6: Run the failing test set**

Run:

```bash
npx vitest run \
  'src/app/[lang]/browse/ClipDataProvider.test.tsx' \
  'src/components/common/SearchBar.test.tsx' \
  'src/components/layout/Navbar.test.tsx' \
  'src/components/layout/MobileSearchOverlay.test.tsx' \
  'src/app/[lang]/browse/page.test.tsx'
```

Expected:
- `ClipDataProvider` idle preload test FAILS because the provider still auto-loads on idle
- `SearchBar` focus callback test FAILS because `onActivate` does not exist yet
- `Navbar` and `MobileSearchOverlay` tests FAIL because no request hook exists yet
- `BrowsePageShell` cards-only bootstrap test FAILS because the shell still expects `browseSummary`

- [ ] **Step 7: Commit the failing tests**

```bash
git add \
  'src/app/[lang]/browse/ClipDataProvider.test.tsx' \
  'src/components/common/SearchBar.test.tsx' \
  'src/components/layout/Navbar.test.tsx' \
  'src/components/layout/MobileSearchOverlay.test.tsx' \
  'src/app/[lang]/browse/page.test.tsx'
git commit -m "test(browse): lock on-demand detailed index loading contract"
```

---

### Task 2: Move Detailed Index Loading Behind an Explicit Provider API

**Files:**
- Modify: `src/app/[lang]/browse/ClipDataProvider.tsx`

- [ ] **Step 1: Add an explicit request API to the browse data context**

Change the context shape to expose a method:

```tsx
interface BrowseDataContextValue {
  initialClips: BrowseSummaryRecord[];
  projectionClips: BrowseProjectionRecord[] | null;
  projectionStatus: ProjectionStatus;
  initialTotalCount: number;
  totalClipCount: number;
  allTags: string[];
  popularTags: string[];
  requestDetailedIndex: () => void;
}
```

Default context value should provide a no-op:

```tsx
requestDetailedIndex: () => {},
```

- [ ] **Step 2: Delete the idle preload path**

Remove:

- `idlePreload` state
- `requestIdleCallback` effect
- the timer fallback that flips `idlePreload`

The new trigger should become:

```tsx
const [detailedIndexRequested, setDetailedIndexRequested] = useState(preloadDetailedIndex);

const requestDetailedIndex = useCallback(() => {
  setDetailedIndexRequested(true);
}, []);

const shouldLoadDetailedIndex =
  detailedIndexRequested || requiresDetailedBrowseIndex(filters);
```

- [ ] **Step 3: Guard duplicate fetches and preserve the current successful merge path**

Keep the existing fetch body mostly intact, but harden the guard:

```tsx
useEffect(() => {
  if (!shouldLoadDetailedIndex || projectionClips || projectionStatus === "loading-requested") {
    return;
  }
  ...
}, [...]);
```

Use one of these two approaches:

1. Add a new internal status like `"loading-requested"`; or
2. Add an `inFlightRef` boolean that suppresses duplicate fetch starts.

Recommendation: use `inFlightRef` to minimize consumer churn.

```tsx
const inFlightRef = useRef(false);
...
if (inFlightRef.current) return;
inFlightRef.current = true;
setProjectionStatus("loading");
```

- [ ] **Step 4: Expose the request function in the provider value**

```tsx
<ClipDataContext.Provider
  value={{
    initialClips: clips,
    projectionClips,
    projectionStatus,
    initialTotalCount,
    totalClipCount,
    allTags,
    popularTags,
    requestDetailedIndex,
  }}
>
```

- [ ] **Step 5: Run the provider tests**

Run:

```bash
npx vitest run 'src/app/[lang]/browse/ClipDataProvider.test.tsx'
```

Expected:
- idle mount test PASS
- explicit request test PASS
- existing URL-filter activation test still PASS

- [ ] **Step 6: Commit**

```bash
git add 'src/app/[lang]/browse/ClipDataProvider.tsx'
git commit -m "feat(browse): make detailed index loading explicit and on-demand"
```

---

### Task 3: Wire Real UI Triggers to the Provider Request API

**Files:**
- Modify: `src/components/common/SearchBar.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.tsx`
- Modify: `src/components/filter/TagFilterPanel.tsx`

- [ ] **Step 1: Add an optional focus activation prop to SearchBar**

Extend `SearchBarProps`:

```tsx
interface SearchBarProps {
  ...
  onActivate?: () => void;
}
```

Call it inside `handleFocus` before opening suggestions:

```tsx
function handleFocus() {
  onActivate?.();
  setOpen(true);
  useUIStore.getState().setSearchFocused(true);
}
```

- [ ] **Step 2: Request the detailed index from desktop search focus**

In `src/components/layout/Navbar.tsx`:

```tsx
const { projectionClips, projectionStatus, allTags, popularTags, requestDetailedIndex } =
  useBrowseData();
```

Then pass:

```tsx
<SearchBar
  ...
  onActivate={requestDetailedIndex}
/>
```

- [ ] **Step 3: Request the detailed index when mobile search opens**

Extend `MobileSearchOverlayProps`:

```tsx
onRequestSearchReady?: () => void;
```

Request on open:

```tsx
useEffect(() => {
  if (open) {
    onRequestSearchReady?.();
  }
}, [open, onRequestSearchReady]);
```

In `Navbar.tsx` pass:

```tsx
<MobileSearchOverlay
  ...
  onRequestSearchReady={requestDetailedIndex}
/>
```

- [ ] **Step 4: Request the detailed index when the tag panel mounts**

In `src/components/filter/TagFilterPanel.tsx`:

```tsx
const { projectionStatus, requestDetailedIndex } = useBrowseData();

useEffect(() => {
  requestDetailedIndex();
}, [requestDetailedIndex]);
```

Keep the current loading state UI while `projectionStatus !== "ready"`.

- [ ] **Step 5: Run the surface tests**

Run:

```bash
npx vitest run \
  'src/components/common/SearchBar.test.tsx' \
  'src/components/layout/Navbar.test.tsx' \
  'src/components/layout/MobileSearchOverlay.test.tsx' \
  'src/components/filter/TagFilterPanel.test.tsx'
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add \
  'src/components/common/SearchBar.tsx' \
  'src/components/layout/Navbar.tsx' \
  'src/components/layout/MobileSearchOverlay.tsx' \
  'src/components/filter/TagFilterPanel.tsx'
git commit -m "feat(browse): request detailed index only from search and tag surfaces"
```

---

### Task 4: Remove Duplicate Lightweight Browse Bootstrap Reads

**Files:**
- Modify: `src/app/[lang]/browse/page.tsx`
- Modify: `src/lib/data.ts`
- Modify: `src/app/[lang]/browse/page.test.tsx`

- [ ] **Step 1: Make cards the only lightweight bootstrap source for browse**

In `src/app/[lang]/browse/page.tsx`, stop loading `loadBrowseSummary()` for the normal browse shell path.

Current pattern:

```tsx
loadBrowseCards(),
loadBrowseSummary(),
```

Target pattern:

```tsx
const [dict, categories, tagGroups, tagI18n, browseCards, browseFilterIndex] = use(
  Promise.all([
    getDictionary(lang as Locale),
    getCategories(),
    getTagGroups(),
    getTagI18n(),
    loadBrowseCards(),
    shouldLoadDetailedIndex ? loadBrowseFilterIndex() : Promise.resolve(null),
  ])
);
```

- [ ] **Step 2: Update BrowsePageShell to use cards as both initial items and lightweight lookup**

Refactor props:

```tsx
export function BrowsePageShell({
  ...
  browseCards,
  browseFilterIndex,
  ...
}: {
  ...
  browseCards: Awaited<ReturnType<typeof loadBrowseCards>>;
  browseFilterIndex: Awaited<ReturnType<typeof loadBrowseFilterIndex>> | null;
  ...
})
```

Use:

```tsx
const initialBrowseResults = listBrowseResults({
  cards: browseCards,
  summary: browseCards,
  projection: browseFilterIndex ?? browseCards,
  ...
});
```

and:

```tsx
totalClipCount={browseCards.length}
```

- [ ] **Step 3: Leave data.ts backward-compatible**

Do **not** delete `loadBrowseSummary()` yet. This task is runtime dedupe, not data contract cleanup. The only required data-layer change is removing now-unused imports if ESLint complains.

- [ ] **Step 4: Run the page tests**

Run:

```bash
npx vitest run 'src/app/[lang]/browse/page.test.tsx'
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add 'src/app/[lang]/browse/page.tsx' 'src/lib/data.ts' 'src/app/[lang]/browse/page.test.tsx'
git commit -m "perf(browse): bootstrap the browse page from cards only"
```

---

### Task 5: Verify the New First-Visit Contract End-to-End

**Files:**
- No source changes unless verification fails

- [ ] **Step 1: Run the full targeted test suite**

Run:

```bash
npx vitest run \
  'src/app/[lang]/browse/ClipDataProvider.test.tsx' \
  'src/app/[lang]/browse/page.test.tsx' \
  'src/components/common/SearchBar.test.tsx' \
  'src/components/layout/Navbar.test.tsx' \
  'src/components/layout/MobileSearchOverlay.test.tsx' \
  'src/components/filter/TagFilterPanel.test.tsx'
```

Expected: ALL PASS

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected:
- build passes
- browse page and clip routes still compile

- [ ] **Step 3: Smoke-check the network contract locally**

Run the dev server:

```bash
npm run dev
```

Verify manually in the browser:

1. Open `/ko/browse` with no query params.
2. Confirm first load does **not** request `/api/browse/filter-index`.
3. Click into the desktop search bar.
4. Confirm the search focus now triggers `/api/browse/cards` and `/api/browse/filter-index` once.
5. Reload and open the tag filter panel instead.
6. Confirm the tag panel triggers the same detailed index fetch and shows a loading state until ready.

- [ ] **Step 4: Record before/after payload evidence in the PR notes or task log**

Capture at minimum:

```text
Before:
- first browse visit fetched cards + filter-index automatically

After:
- first browse visit fetched lightweight cards only
- filter-index fetched only after search focus or tag panel open
```

- [ ] **Step 5: Commit verification-only cleanup if needed**

```bash
git status
```

Expected: clean working tree

---

## Rollout Notes

- This plan intentionally stops short of Pagefind. After this lands, the next scalability task should replace full-client search with a true search index.
- If mobile or desktop search feels too empty before activation, add a tiny follow-up payload such as `browse-search-hints.json` instead of reintroducing idle preload.
- Do not widen this task into `filter-index` chunking, RSC streaming refactors, or browse API pagination. Keep the change focused on "first visit should stay light".

## Success Criteria

- 브라우즈 첫 진입에서 detailed index 자동 preload가 사라진다.
- search/tag 진입 시에만 detailed index를 1회 요청한다.
- 브라우즈 bootstrap에서 `summary + cards` 중복 read를 제거한다.
- 기존 URL 기반 검색/태그/폴더 필터 진입은 계속 정상 동작한다.
- 테스트와 `npm run build`가 모두 통과한다.
