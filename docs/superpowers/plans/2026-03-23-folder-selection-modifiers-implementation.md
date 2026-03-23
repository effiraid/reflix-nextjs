# Folder Selection Modifiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make folder selection default to single-select, allow additive selection on `Cmd/Ctrl` click, and toggle the full folder tree expand/collapse state on `Cmd/Ctrl + Alt` click.

**Architecture:** Keep filter URL syncing in `LeftPanelContent`, but move folder-row click handling to include modifier metadata. Replace `FolderTree` node-local expansion state with controlled expansion state from the parent so the panel can toggle all nodes at once while preserving per-node toggles.

**Tech Stack:** Next.js App Router client components, React 19, Zustand, Vitest, Testing Library

---

### Task 1: Lock Desired Interaction With Failing Tests

**Files:**
- Modify: `src/app/[lang]/browse/LeftPanelContent.test.tsx`
- Modify: `src/components/filter/FolderTree.test.tsx`

- [ ] **Step 1: Write failing tests for single-select and modifier-select**

Add tests that assert a plain folder click replaces the selection, while `metaKey` or `ctrlKey` clicks toggle folders into or out of a multi-selection set.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/[lang]/browse/LeftPanelContent.test.tsx src/components/filter/FolderTree.test.tsx`

Expected: FAIL because the current click handler does not expose modifier keys and still uses plain toggle behavior.

### Task 2: Control Folder Tree Expansion From The Panel

**Files:**
- Modify: `src/app/[lang]/browse/LeftPanelContent.tsx`
- Modify: `src/components/filter/FolderTree.tsx`

- [ ] **Step 1: Add controlled folder click metadata**

Update the tree so row clicks report `folderId`, `metaKey`, `ctrlKey`, and `altKey`, then handle single-select vs multi-select in the panel.

- [ ] **Step 2: Replace node-local expansion with controlled expansion**

Lift expansion state to the panel, pass expanded node ids into the tree, and add `Cmd/Ctrl + Alt` behavior that toggles the whole tree between fully expanded and fully collapsed.

- [ ] **Step 3: Run targeted tests**

Run: `npx vitest run src/app/[lang]/browse/LeftPanelContent.test.tsx src/components/filter/FolderTree.test.tsx`

Expected: PASS

### Task 3: Verify No Regressions In Nearby UI Tests

**Files:**
- Verify: `src/components/layout/Navbar.test.tsx`

- [ ] **Step 1: Run a nearby UI test set**

Run: `npx vitest run src/app/[lang]/browse/LeftPanelContent.test.tsx src/components/filter/FolderTree.test.tsx src/components/layout/Navbar.test.tsx`

Expected: PASS
