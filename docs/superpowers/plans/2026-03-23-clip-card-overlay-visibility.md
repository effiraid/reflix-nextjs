# Clip Card Overlay Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the star rating from `ClipCard` and keep the title plus duration visible without hover.

**Architecture:** Update the existing `ClipCard` overlay in place instead of introducing a new UI branch. Lock the behavior with a focused component test that proves the text is always rendered and the hover-only classes are gone.

**Tech Stack:** Next.js App Router, React 19, Vitest, Testing Library

---

### Task 1: ClipCard Overlay Behavior

**Files:**
- Modify: `src/components/clip/ClipCard.tsx`
- Create: `src/components/clip/ClipCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a `ClipCard` test that renders a clip fixture with `star > 0`, then asserts:
- title and duration text render
- star text does not render
- overlay class no longer includes `opacity-0` or `hover:opacity-100`

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx vitest run src/components/clip/ClipCard.test.tsx`

Expected: FAIL because the current component still renders star text and still uses hover-only overlay opacity classes.

- [ ] **Step 3: Write the minimal implementation**

In `src/components/clip/ClipCard.tsx`:
- remove the star-rating block
- keep the bottom gradient overlay always visible
- leave click selection and media-loading behavior unchanged

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `npx vitest run src/components/clip/ClipCard.test.tsx`

Expected: PASS

- [ ] **Step 5: Run a broader verification**

Run: `npm run lint` and `npx vitest run src/components/clip/ClipCard.test.tsx`

Expected: lint clean and targeted test pass
