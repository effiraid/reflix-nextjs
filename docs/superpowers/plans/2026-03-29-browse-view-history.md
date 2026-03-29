# 최근 기록 (View History) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 클립 조회 기록을 localStorage에 저장하고, 좌측 패널 "최근 기록" 버튼 클릭 시 최근 본 클립들을 MasonryGrid로 표시한다.

**Architecture:** `recentSearches.ts`와 동일한 localStorage 패턴으로 `viewHistory.ts` 모듈을 만든다. `uiStore.browseMode`에 `"history"` 모드를 추가하고, `BrowseClient`에서 클립 선택 시 기록을 저장한다. "최근 기록" 버튼은 `browseMode("history")`로 전환하며, 기존 MasonryGrid를 재사용하여 기록된 클립을 역순으로 렌더링한다.

**Tech Stack:** TypeScript, localStorage, Zustand, Vitest

**Design decisions:**
- SubToolbar(썸네일 크기, 셔플 등)는 history 모드에서 의도적으로 숨김 — tags/boards 모드와 동일한 패턴
- `browseMode`는 URL에 싱크하지 않음 — tags/boards 모드와 동일하게 새로고침 시 grid로 복귀
- 키보드 그리드 네비게이션은 history 모드에서 미지원 — tags/boards와 동일 패턴, 추후 필요 시 추가

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/viewHistory.ts` | localStorage CRUD — 조회 기록 저장/조회/삭제 |
| Create | `src/lib/viewHistory.test.ts` | viewHistory 유닛 테스트 |
| Modify | `src/stores/uiStore.ts:27` | `browseMode` 타입에 `"history"` 추가 |
| Modify | `src/app/[lang]/browse/LeftPanelContent.tsx:214-221` | "최근 기록" 버튼 → `browseMode("history")` 전환 + 건수 표시 |
| Modify | `src/app/[lang]/browse/BrowseClient.tsx` | 클립 선택 시 기록 저장 + history 모드 렌더링 |
| Modify | `src/components/layout/RightPanel.tsx:11` | history 모드에서도 우측 패널 표시 |
| Modify | `src/app/[lang]/dictionaries/ko.json` | `historyEmpty`, `clearHistory` 키 추가 |
| Modify | `src/app/[lang]/dictionaries/en.json` | 동일 키 영어 추가 |

---

### Task 1: viewHistory localStorage 모듈

**Files:**
- Create: `src/lib/viewHistory.ts`
- Create: `src/lib/viewHistory.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/lib/viewHistory.test.ts`:
```typescript
import { afterEach, describe, expect, it } from "vitest";
import {
  getViewHistory,
  addViewHistory,
  removeViewHistory,
  clearViewHistory,
} from "./viewHistory";

describe("viewHistory", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(getViewHistory()).toEqual([]);
  });

  it("adds a clip id to history", () => {
    addViewHistory("clip-1");
    expect(getViewHistory()).toEqual(["clip-1"]);
  });

  it("puts newest first", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    expect(getViewHistory()).toEqual(["clip-2", "clip-1"]);
  });

  it("deduplicates (moves to front)", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    addViewHistory("clip-1");
    expect(getViewHistory()).toEqual(["clip-1", "clip-2"]);
  });

  it("limits to 50 items", () => {
    for (let i = 0; i < 55; i++) {
      addViewHistory(`clip-${i}`);
    }
    expect(getViewHistory()).toHaveLength(50);
    expect(getViewHistory()[0]).toBe("clip-54");
  });

  it("ignores empty strings", () => {
    addViewHistory("");
    expect(getViewHistory()).toEqual([]);
  });

  it("removes a specific clip from history", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    removeViewHistory("clip-1");
    expect(getViewHistory()).toEqual(["clip-2"]);
  });

  it("clears all history", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    clearViewHistory();
    expect(getViewHistory()).toEqual([]);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("reflix:view-history", "not-json");
    expect(getViewHistory()).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/viewHistory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`src/lib/viewHistory.ts`:
```typescript
const STORAGE_KEY = "reflix:view-history";
const MAX_ITEMS = 50;

export function getViewHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addViewHistory(clipId: string): void {
  if (!clipId) return;
  const history = getViewHistory().filter((id) => id !== clipId);
  history.unshift(clipId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
}

export function removeViewHistory(clipId: string): void {
  const history = getViewHistory().filter((id) => id !== clipId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearViewHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/viewHistory.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/viewHistory.ts src/lib/viewHistory.test.ts
git commit -m "feat: add viewHistory localStorage module"
```

---

### Task 2: uiStore browseMode에 "history" 추가

**Files:**
- Modify: `src/stores/uiStore.ts:27`

- [ ] **Step 1: browseMode 타입 확장**

`src/stores/uiStore.ts` 27번째 줄 — `browseMode` 타입을 수정:

```typescript
// Before
browseMode: "grid" | "tags" | "boards";

// After
browseMode: "grid" | "tags" | "boards" | "history";
```

동일한 변경을 `setBrowseMode` 파라미터 타입에도 적용 (47번째 줄):

```typescript
// Before
setBrowseMode: (mode: "grid" | "tags" | "boards") => void;

// After
setBrowseMode: (mode: "grid" | "tags" | "boards" | "history") => void;
```

- [ ] **Step 2: 기존 테스트 통과 확인**

Run: `npx vitest run`
Expected: 기존 테스트 모두 PASS (타입만 확장했으므로 동작 변경 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/stores/uiStore.ts
git commit -m "feat: add history to browseMode union type"
```

---

### Task 3: i18n 사전 업데이트

**Files:**
- Modify: `src/app/[lang]/dictionaries/ko.json`
- Modify: `src/app/[lang]/dictionaries/en.json`

- [ ] **Step 1: ko.json에 키 추가**

`browse` 섹션의 `"myBoards": "내 보드"` 뒤, `}` 닫기 전에 추가:

```json
"historyEmpty": "아직 본 클립이 없어요",
"clearHistory": "기록 삭제"
```

- [ ] **Step 2: en.json에 키 추가**

동일 위치:

```json
"historyEmpty": "No clips viewed yet",
"clearHistory": "Clear History"
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/[lang]/dictionaries/ko.json src/app/[lang]/dictionaries/en.json
git commit -m "feat: add view history i18n strings"
```

---

### Task 4: LeftPanelContent "최근 기록" 버튼 연결

**Files:**
- Modify: `src/app/[lang]/browse/LeftPanelContent.tsx:214-221`

- [ ] **Step 1: import 추가**

파일 상단에 추가:
```typescript
import { getViewHistory } from "@/lib/viewHistory";
import { useClipStore } from "@/stores/clipStore";
```

- [ ] **Step 2: 기록 건수 state 추가**

`LeftPanelContent` 컴포넌트 내부, 기존 state 선언부 근처에:
```typescript
const selectedClipId = useClipStore((s) => s.selectedClipId);
const [historyCount, setHistoryCount] = useState(0);

useEffect(() => {
  setHistoryCount(getViewHistory().length);
}, [browseMode, selectedClipId]);
```

`selectedClipId`를 dependency에 포함하여 클립 선택할 때마다 건수가 갱신된다.

- [ ] **Step 3: 버튼 onClick 및 활성 상태 수정**

214-221번째 줄의 "최근 기록" 버튼을 교체:

```tsx
<button
  type="button"
  onClick={() => setBrowseMode("history")}
  className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-surface-hover transition-colors ${
    browseMode === "history" ? "bg-accent/10 text-accent" : "text-muted"
  }`}
>
  <span className="flex items-center gap-2">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    {dict.browse.recentlyUsed}
  </span>
  {historyCount > 0 ? (
    <span className="text-muted text-xs">{historyCount}</span>
  ) : null}
</button>
```

- [ ] **Step 4: 기존 테스트 통과 확인**

Run: `npx vitest run src/app/[lang]/browse/LeftPanelContent.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/[lang]/browse/LeftPanelContent.tsx
git commit -m "feat: wire up view history button in left panel"
```

---

### Task 5: BrowseClient에서 기록 저장 + history 모드 렌더링

**Files:**
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`

- [ ] **Step 1: import 추가**

```typescript
import { addViewHistory, getViewHistory, clearViewHistory } from "@/lib/viewHistory";
```

- [ ] **Step 2: 클립 선택 시 기록 저장**

`BrowseClient` 컴포넌트 내부, `useFilterSync()` 호출 뒤에 추가:

```typescript
// Record clip selection to view history
const prevSelectedRef = useRef<string | null>(null);
useEffect(() => {
  if (selectedClipId && selectedClipId !== prevSelectedRef.current) {
    addViewHistory(selectedClipId);
  }
  prevSelectedRef.current = selectedClipId;
}, [selectedClipId]);
```

- [ ] **Step 3: history 모드 렌더링 블록 추가**

`BrowseClient`의 `browseMode === "boards"` 블록 뒤 (614번째 줄 뒤)에 추가. `selectedClipId`를 prop으로 전달하여 HistoryView가 새 선택 시 목록을 갱신한다:

```tsx
if (browseMode === "history") {
  return (
    <>
      {splashOverlay}
      <HistoryView
        initialClips={initialClips}
        projectionClips={projectionClips}
        projectionStatus={projectionStatus}
        selectedClipId={selectedClipId}
        lang={lang}
        tagI18n={tagI18n}
        dict={dict}
        onOpenQuickView={openQuickViewForClip}
      />
      {quickViewOpen && selectedClip ? (
        <QuickViewModal
          clip={selectedClip}
          categories={categories}
          lang={lang}
          tagI18n={tagI18n}
          dict={dict}
          onClose={handleCloseQuickView}
        />
      ) : null}
      <KeyboardHelpOverlay dict={dict} />
      <ToastContainer />
    </>
  );
}
```

- [ ] **Step 4: HistoryView 컴포넌트를 같은 파일 하단에 추가**

```tsx
function HistoryView({
  initialClips,
  projectionClips,
  projectionStatus,
  selectedClipId,
  lang,
  tagI18n,
  dict,
  onOpenQuickView,
}: {
  initialClips: BrowseClipRecord[];
  projectionClips: BrowseClipRecord[] | null;
  projectionStatus: string;
  selectedClipId: string | null;
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Dictionary;
  onOpenQuickView: (clipId: string) => void;
}) {
  const [historyIds, setHistoryIds] = useState<string[]>([]);

  // Re-read history when clip selection changes (new entry added)
  useEffect(() => {
    setHistoryIds(getViewHistory());
  }, [selectedClipId]);

  const clips = useMemo(() => {
    const sourceClips = projectionClips && projectionStatus === "ready"
      ? projectionClips
      : initialClips;
    const clipMap = new Map(sourceClips.map((c) => [c.id, c]));
    // Merge initial media fields into projection records
    if (projectionClips && projectionStatus === "ready") {
      const summaryById = new Map(initialClips.map((c) => [c.id, c]));
      for (const [id, clip] of clipMap) {
        const summary = summaryById.get(id);
        if (summary) {
          clipMap.set(id, { ...summary, ...clip });
        }
      }
    }
    return historyIds
      .map((id) => clipMap.get(id))
      .filter((c): c is BrowseClipRecord => c != null);
  }, [historyIds, initialClips, projectionClips, projectionStatus]);

  if (historyIds.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted">
        {dict.browse.historyEmpty}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="text-xs text-muted">
          {lang === "ko"
            ? `${clips.length}개 클립`
            : `${clips.length} clips`}
        </p>
        <button
          type="button"
          onClick={() => {
            clearViewHistory();
            setHistoryIds([]);
          }}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {dict.browse.clearHistory}
        </button>
      </div>
      <MasonryGrid
        clips={clips}
        lang={lang}
        tagI18n={tagI18n}
        lockedClipIds={new Set<string>()}
        onOpenQuickView={onOpenQuickView}
      />
    </>
  );
}
```

- [ ] **Step 5: 빌드 확인**

Run: `npx vitest run`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/[lang]/browse/BrowseClient.tsx
git commit -m "feat: record view history and render history browse mode"
```

---

### Task 6: RightPanel history 모드에서 표시

**Files:**
- Modify: `src/components/layout/RightPanel.tsx:11`

- [ ] **Step 1: RightPanel visibility 조건 수정**

```typescript
// Before
const isVisible = rightPanelOpen && browseMode === "grid";

// After
const isVisible = rightPanelOpen && (browseMode === "grid" || browseMode === "history");
```

이렇게 하면 history 모드에서도 클립 선택 시 우측 패널에 상세 정보가 표시된다.

- [ ] **Step 2: 빌드 확인**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/components/layout/RightPanel.tsx
git commit -m "feat: show right panel in history browse mode"
```

---

### Task 7: 수동 QA

- [ ] **Step 1: 개발 서버 시작**

Run: `npm run dev`

- [ ] **Step 2: 기본 동작 확인**

1. `http://localhost:3000/ko/browse` 접속
2. 아무 클립 3-4개 클릭 (우측 패널에 상세 표시 확인)
3. 좌측 패널 "최근 기록" 버튼 클릭
4. 방금 본 클립들이 역순(최신 먼저)으로 MasonryGrid에 표시되는지 확인
5. 좌측 패널 건수 표시가 정확한지 확인

- [ ] **Step 3: 퀵뷰 동작 확인**

1. history 모드에서 클립 더블클릭 → 퀵뷰 열림 확인
2. 퀵뷰 닫기 후 history 그리드 유지 확인

- [ ] **Step 4: history 모드에서 새 클립 선택 시 목록 갱신 확인**

1. history 모드에서 클립 클릭
2. 해당 클립이 기록 목록 맨 앞으로 이동하는지 확인

- [ ] **Step 5: 기록 삭제 확인**

1. "기록 삭제" 버튼 클릭
2. 빈 상태 ("아직 본 클립이 없어요") 표시 확인
3. 건수가 0으로 업데이트 확인

- [ ] **Step 6: 모드 전환 확인**

1. "둘러보기" 클릭 → grid 모드 정상 복귀
2. "모든 태그" 클릭 → tags 모드 정상 동작
3. 다시 "최근 기록" → 이전 기록 유지 확인 (localStorage 영속)

- [ ] **Step 7: 콘솔 에러 확인**

브라우저 콘솔에 errors 0 / warnings 0 확인
