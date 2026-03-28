# Folder Tree Filter Store Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent unrelated filter-store updates from re-rendering every folder row while keeping folder selection behavior exactly the same.

**Architecture:** Keep the fix tightly scoped to the folder tree. Add a regression test that proves unrelated store changes like search typing do not cause subtree commits, then replace the whole-store `useFilterStore()` subscription inside `FolderNode` with a shallow selector that reads only `selectedFolders` and `excludedFolders`.

**Tech Stack:** Next.js App Router, React 19, Zustand 5, Vitest, Testing Library

---

### Task 1: Add a failing regression test for unrelated store updates

**Files:**
- Modify: `src/components/filter/FolderTree.test.tsx`
- Reference: `src/stores/filterStore.ts`

- [ ] **Step 1: Add store reset and Profiler imports to the test file**

```tsx
import { Profiler } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FolderTree } from "./FolderTree";
import { useFilterStore } from "@/stores/filterStore";
import type { CategoryTree } from "@/lib/types";
```

- [ ] **Step 2: Reset the filter store before each test so commit counts are deterministic**

```tsx
beforeEach(() => {
  useFilterStore.setState({
    selectedFolders: [],
    excludedFolders: [],
    selectedTags: [],
    excludedTags: [],
    searchQuery: "",
    sortBy: "newest",
    category: null,
    contentMode: null,
  });
});
```

- [ ] **Step 3: Write the failing regression test**

```tsx
it("does not re-render folder nodes when unrelated filter state changes", () => {
  const commits: string[] = [];

  render(
    <Profiler id="FolderTree" onRender={(_, phase) => commits.push(phase)}>
      <FolderTree
        categories={categories}
        folderClipIds={folderClipIds}
        lang="ko"
        expandedFolderIds={["movement"]}
        onFolderClick={vi.fn()}
        onFolderExpandToggle={vi.fn()}
      />
    </Profiler>
  );

  expect(commits).toEqual(["mount"]);

  act(() => {
    useFilterStore.setState({ searchQuery: "dash" });
  });

  expect(commits).toEqual(["mount"]);
});
```

- [ ] **Step 4: Run the focused test to verify it fails before the implementation**

Run: `npx vitest run src/components/filter/FolderTree.test.tsx -t "does not re-render folder nodes when unrelated filter state changes"`

Expected: FAIL because the current `FolderNode` subscribes to the full filter store and records an extra `"update"` commit when `searchQuery` changes.

- [ ] **Step 5: Commit the red test**

```bash
git add src/components/filter/FolderTree.test.tsx
git commit -m "test: add folder tree rerender regression"
```

### Task 2: Narrow the `FolderNode` subscription to only the state it uses

**Files:**
- Modify: `src/components/filter/FolderTree.tsx`
- Test: `src/components/filter/FolderTree.test.tsx`

- [ ] **Step 1: Import `useShallow` alongside the existing React imports**

```tsx
import { memo, useMemo, type ComponentType } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CategoryNode, CategoryTree, Locale } from "@/lib/types";
import { useFilterStore } from "@/stores/filterStore";
```

- [ ] **Step 2: Replace the whole-store subscription inside `FolderNode`**

```tsx
const { selectedFolders, excludedFolders } = useFilterStore(
  useShallow((state) => ({
    selectedFolders: state.selectedFolders,
    excludedFolders: state.excludedFolders,
  }))
);
```

- [ ] **Step 3: Keep the existing selection logic exactly as-is so behavior does not change**

```tsx
const isSelected = allIds.some((fid) => selectedFolders.includes(fid));
const isExcluded = allIds.some((fid) => excludedFolders.includes(fid));
```

- [ ] **Step 4: Run the folder tree tests and verify the new regression now passes**

Run: `npx vitest run src/components/filter/FolderTree.test.tsx`

Expected: PASS, including the new Profiler-based regression test and the existing modifier-key click coverage.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/components/filter/FolderTree.tsx src/components/filter/FolderTree.test.tsx
git commit -m "perf: narrow folder tree store subscriptions"
```

### Task 3: Verify integration with the left browse panel

**Files:**
- Reference: `src/app/[lang]/browse/LeftPanelContent.tsx`
- Test: `src/app/[lang]/browse/LeftPanelContent.test.tsx`

- [ ] **Step 1: Run the left panel integration tests**

Run: `npx vitest run src/app/[lang]/browse/LeftPanelContent.test.tsx`

Expected: PASS, proving the folder tree still expands, scrolls, and updates selection correctly through the real left-panel wrapper.

- [ ] **Step 2: Do a quick behavior checklist before calling the work done**

```md
- Clicking a folder still toggles selection through `onFolderClick`.
- Parent folders still auto-expand from `LeftPanelContent`.
- Modifier keys still pass through unchanged.
- Folder counts still render from `folderClipIds`.
- Search typing no longer forces subtree updates in `FolderTree`.
```

- [ ] **Step 3: Commit the verification checkpoint**

```bash
git add src/components/filter/FolderTree.tsx src/components/filter/FolderTree.test.tsx
git commit -m "test: verify folder tree selector optimization"
```
