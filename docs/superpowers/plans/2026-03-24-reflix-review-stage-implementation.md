# Reflix Review Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Phase 2 review stage where Reflix computes name/tag review suggestions for the current release batch, marks Eagle items with `reflix:review-requested`, and lets the operator approve only after reviewing metadata in Eagle.

**Architecture:** Extend the existing `release-approval` CLI with a new `review` command instead of creating a second parallel pipeline. The new review stage will reuse the current active batch, taxonomy, Eagle metadata, and existing clip JSON to generate deterministic review artifacts under `.tmp/release-review/`, then mutate Eagle status tags only to request human review. Approval, export, and publish remain separate downstream steps.

**Tech Stack:** Node.js ESM scripts, `node:test`, Eagle `metadata.json` files, existing `scripts/lib/eagle-reader.mjs`, existing `scripts/lib/eagle-metadata.mjs`, existing `scripts/lib/release-approval-state.mjs`, existing `scripts/lib/release-batch.mjs`

**Specs:**
- `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-review-design.md`
- `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-approval-and-publish-design.md`

---

## Scope Guard

This plan intentionally stops at:

- adding `release:review`
- generating deterministic review artifacts
- tagging Eagle review targets with `reflix:review-requested`
- cleaning up the `review-requested` tag during approve/publish transitions

This plan does **not**:

- auto-edit Eagle names or content tags
- analyze raw video frames
- replace the human Eagle review step
- change the core batch export or deploy flow beyond integrating the review state

## File Structure

```text
scripts/
├── release-approval.mjs                              ← CLI entrypoint, add `review` command
└── lib/
    ├── eagle-metadata.mjs                            ← shared tag mutation helper, reused for review tag lifecycle
    ├── eagle-metadata.test.mjs                       ← tag mutation coverage for review-requested cleanup
    ├── eagle-reader.mjs                              ← existing Eagle metadata reader
    ├── release-approval-state.mjs                    ← extend with review artifact path helpers
    ├── release-approval-state.test.mjs               ← review artifact contract coverage
    ├── release-approval.mjs                          ← wire `review` command and downstream cleanup rules
    ├── release-approval.test.mjs                     ← end-to-end CLI/business-logic coverage
    ├── release-review.mjs                            ← new review business logic and suggestion builder
    └── release-review.test.mjs                       ← review heuristics and artifact generation coverage

.tmp/
├── release-approval/
│   └── <timestamp>/...
└── release-review/
    └── <timestamp>/
        ├── review-report.md                          ← operator-facing review document
        └── review-suggestions.json                   ← structured review suggestions

src/data/
└── categories.json                                   ← taxonomy source used for review suggestions

public/data/clips/
└── <id>.json                                         ← current exported clip state used as comparison input

docs/
├── pipeline/
│   ├── phase-2-review-design.md                      ← approved review-stage design
│   ├── phase-2-release-workflow.md                   ← operator flow doc
│   └── phase-2-approval-and-publish-design.md        ← approval/publish state transitions
└── superpowers/plans/
    └── 2026-03-24-reflix-review-stage-implementation.md

package.json                                          ← add `release:review`
```

## Data Contracts

### `.tmp/release-review/<timestamp>/review-suggestions.json`

```json
{
  "version": 1,
  "generatedAt": "2026-03-24T12:00:00.000Z",
  "batchName": "mvp-10",
  "scope": "active-batch",
  "summary": {
    "total": 10,
    "review_needed": 8,
    "review_needed_changed": 1,
    "already_approved": 1,
    "held": 0
  },
  "items": [
    {
      "id": "L3TR52T22TPVR",
      "status": "review_needed",
      "currentName": "연출 아케인 힘듦 일어나기 비몽사몽 비틀비틀 아픔",
      "suggestedName": "연출 아케인 힘듦 일어나기 비몽사몽 비틀비틀 아픔",
      "nameDecision": "keep",
      "currentTags": ["아케인", "일어나기", "힘듦"],
      "suggestedTagsToAdd": ["고통", "비틀거림"],
      "suggestedTagsToRemove": [],
      "newTagCandidates": [],
      "currentFolders": ["L475K68YP1NH3", "MN34RZ0I1OSKP"],
      "reason": "이름에 있는 상태 표현 일부가 태그에 약하게 반영되어 있음",
      "confidence": "medium",
      "nextAction": "approve_after_review"
    }
  ]
}
```

### `.tmp/release-review/<timestamp>/review-report.md`

The report must include:

- generation timestamp
- batch name
- scan scope
- summary counts for `review_needed`, `review_needed_changed`, `already_approved`, `held`
- operator instructions:
  - review in Eagle
  - edit name and content tags manually if needed
  - add `reflix:approved` when ready
  - add `reflix:hold` to exclude
  - run `release:approve` afterward
- per-item sections containing:
  - current state
  - current name
  - suggested name
  - current tags
  - suggested adds/removals
  - new tag candidates
  - reason
  - confidence
  - next action

## Task 1: Add Review Artifact Contracts and CLI Surface

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/package.json`

- [ ] **Step 1: Write the failing state/CLI tests**

Add tests covering:
- `buildReleaseReviewArtifacts()` resolves under `.tmp/release-review/<timestamp>/`
- CLI parser accepts `review`
- `scripts/release-approval.mjs` accepts `review` as a valid command branch without invoking unsupported-command failure

```js
test("buildReleaseReviewArtifacts writes under .tmp/release-review", () => {
  const artifacts = buildReleaseReviewArtifacts({
    timestamp: "2026-03-24T12:00:00.000Z",
    projectRoot: "/repo",
  });

  assert.equal(
    artifacts.reviewReportPath,
    "/repo/.tmp/release-review/2026-03-24T12:00:00.000Z/review-report.md"
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "review|parse"`

Expected: FAIL because the review artifact helper and command do not exist yet.

- [ ] **Step 3: Implement review artifact helpers and CLI parsing**

Add to `/Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.mjs`:

```js
export function buildReleaseReviewArtifacts({ timestamp, projectRoot }) {}
```

Update `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs` and `/Users/macbook/reflix-nextjs/scripts/release-approval.mjs` so:
- `review` is a supported command
- the CLI command branch exists and is reserved for `runReleaseReview()` integration in Task 3

Add to `/Users/macbook/reflix-nextjs/package.json`:

```json
"release:review": "node scripts/release-approval.mjs review"
```

- [ ] **Step 4: Re-run tests**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "review|parse"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/release-approval-state.mjs scripts/lib/release-approval-state.test.mjs scripts/lib/release-approval.mjs scripts/release-approval.mjs package.json
git commit -m "feat: add release review command surface"
```

---

## Task 2: Implement Review Suggestion Heuristics

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/release-review.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/release-review.test.mjs`
- Read: `/Users/macbook/reflix-nextjs/src/data/categories.json`
- Read: `/Users/macbook/reflix-nextjs/public/data/clips/<id>.json` via fixture/temp setup in tests

- [ ] **Step 1: Write the failing heuristic tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/release-review.test.mjs` covering:
- review status classification: `review_needed`, `review_needed_changed`, `already_approved`, `held`
- review suggestions ignore `reflix:*` tags
- review suggestions ignore numeric tokens such as `2`, `(2)`, `03`
- name decision is `keep` when there is no better deterministic suggestion
- tag add/remove suggestions are stable and de-duplicated
- new tag candidates only appear when taxonomy reuse is not possible
- review report rendering orders items as `review_needed_changed`, `review_needed`, `held`, `already_approved`
- review report includes required operator instructions and summary fields

```js
test("numeric tokens are excluded from suggested content tags", () => {
  const item = {
    id: "ITEM1",
    name: "연출 아케인 힘듦 (2) 비틀비틀",
    tags: ["아케인", "2", "(2)", "reflix:approved"],
    folders: ["L475K68YP1NH3"],
    annotation: "",
  };

  const suggestion = buildReviewSuggestion({ item, exportedClip: null, taxonomy: {} });

  assert.deepEqual(suggestion.suggestedTagsToAdd.includes("2"), false);
  assert.deepEqual(suggestion.suggestedTagsToAdd.includes("(2)"), false);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-review.test.mjs`

Expected: FAIL because `release-review.mjs` does not exist yet.

- [ ] **Step 3: Implement deterministic review heuristics**

Create `/Users/macbook/reflix-nextjs/scripts/lib/release-review.mjs` exporting focused helpers such as:

```js
export function classifyReviewItemStatus({ item, publishedEntry, exportedClip }) {}
export function buildReviewSuggestion({ item, exportedClip, taxonomy }) {}
export function buildReviewSummary(items) {}
export function renderReviewReport({ summary, suggestions, timestamp, batchName, scope }) {}
```

Implementation rules:
- only use Eagle metadata, taxonomy, and exported clip JSON
- do not inspect raw media frames
- ignore `reflix:*` tags in all content-tag suggestions
- ignore numeric-only tokens and parenthesized numeric tokens
- prefer existing taxonomy terms before proposing `newTagCandidates`
- provide `confidence` as `high`, `medium`, or `low`
- set `nextAction` to one of:
  - `approve_after_review`
  - `review_existing_changes`
  - `hold_for_manual_decision`

- [ ] **Step 4: Re-run the heuristic tests**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-review.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/release-review.mjs scripts/lib/release-review.test.mjs
git commit -m "feat: add deterministic release review suggestions"
```

---

## Task 3: Implement `runReleaseReview` and Eagle Review-Requested Tagging

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs`

- [ ] **Step 1: Write the failing workflow tests**

Extend `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs` to cover:
- `runReleaseReview()` reads the active batch by default
- held items are excluded from review tagging
- unapproved items receive `reflix:review-requested`
- already approved items are reported as `already_approved`
- changed approved items are classified as `review_needed_changed`
- review artifacts are written under `.tmp/release-review/<timestamp>/`
- CLI `review` prints review summary, review report path, and review suggestions path
- stale `reflix:review-requested` is removed when an item is now `already_approved`
- stale `reflix:review-requested` is removed when an item is now `held`

```js
test("runReleaseReview tags review-needed items with reflix:review-requested", async () => {
  const result = await runReleaseReview(parsed);
  const item = readUpdatedItem("L3TR52T22TPVR");

  assert.equal(result.summary.reviewNeededCount, 1);
  assert.ok(item.tags.includes("reflix:review-requested"));
});
```

- [ ] **Step 2: Run the workflow tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "review"`

Expected: FAIL because `runReleaseReview()` is not implemented yet.

- [ ] **Step 3: Implement `runReleaseReview()`**

Add to `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`:

```js
export async function runReleaseReview(parsed) {}
```

Implementation rules:
- default scope is the active batch only
- load Eagle items from the batch ids
- read exported clip JSON when present
- compute per-item review suggestions using `release-review.mjs`
- write `review-report.md` and `review-suggestions.json`
- add `reflix:review-requested` only to items that actually need review
- remove stale `reflix:review-requested` from items that no longer need review because they are `already_approved` or `held`
- never auto-edit names or content tags

- [ ] **Step 4: Extend tag mutation coverage**

Update `/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs` so tag helpers explicitly cover:
- adding `reflix:review-requested`
- removing `reflix:review-requested` while preserving content tags

- [ ] **Step 5: Re-run targeted tests**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "review"`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/release-approval.mjs scripts/lib/eagle-metadata.mjs scripts/lib/eagle-metadata.test.mjs scripts/lib/release-approval.test.mjs
git commit -m "feat: add release review workflow"
```

---

## Task 4: Integrate Review State with Approve and Publish Transitions

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs`

- [ ] **Step 1: Write the failing transition tests**

Add tests covering:
- `release:approve` promotes only `reflix:approved && !reflix:hold`
- `release:approve` removes `reflix:review-requested` from approved items if it is still present
- `mark-published` removes `reflix:review-requested`, `reflix:approved`, and `reflix:publish-failed`
- `mark-failed` removes `reflix:review-requested` and leaves `reflix:publish-failed`

```js
test("mark-published strips review-requested from successful items", async () => {
  await runReleaseMarkPublished(parsed);
  const item = readUpdatedItem("L3TR52T22TPVR");

  assert.equal(item.tags.includes("reflix:review-requested"), false);
  assert.equal(item.tags.includes("reflix:published"), true);
});
```

- [ ] **Step 2: Run the failing transition tests**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "approve|published|failed"`

Expected: FAIL because the new tag lifecycle is not handled yet.

- [ ] **Step 3: Implement lifecycle cleanup**

Update `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs` so:
- `runReleaseApprove()` strips `reflix:review-requested` from approved items during promotion
- `runReleaseMarkPublished()` strips `reflix:review-requested`
- `runReleaseMarkFailed()` strips `reflix:review-requested`
- rollback behavior still restores metadata when any batch mutation fails

- [ ] **Step 4: Re-run the transition tests**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "approve|published|failed"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/release-approval.mjs scripts/lib/release-approval.test.mjs
git commit -m "feat: integrate review state into release transitions"
```

---

## Task 5: Operator Docs, Scripts, and End-to-End Verification

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/README.md`
- Modify: `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-release-workflow.md`
- Modify: `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-approval-and-publish-design.md`
- Modify: `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-review-design.md`

- [ ] **Step 1: Write documentation updates**

Document the operator flow exactly as:

1. `npm run release:scan`
2. `npm run release:review`
3. review items in Eagle
4. add `reflix:approved` or `reflix:hold`
5. `npm run release:approve`
6. `npm run export:batch:dry`
7. `npm run export:batch`
8. `npm run release:mark-published` or `npm run release:mark-failed`

Call out:
- what `reflix:review-requested` means
- that review suggestions are deterministic metadata-based hints
- that Eagle names/content tags are still edited manually

- [ ] **Step 2: Run all targeted tests**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-review.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs`

Expected: PASS

- [ ] **Step 3: Run workflow smoke checks**

Run:
- `npm run release:scan`
- `npm run release:review`
- `npm run export:batch:dry`
- `npm run build`

Expected:
- review artifacts are printed under `.tmp/release-review/<timestamp>/`
- active batch remains unchanged until `release:approve`
- build still passes

- [ ] **Step 4: Commit**

```bash
git add README.md docs/pipeline/phase-2-release-workflow.md docs/pipeline/phase-2-approval-and-publish-design.md docs/pipeline/phase-2-review-design.md
git commit -m "docs: add release review workflow"
```

## Final Verification Checklist

- [ ] `npm run release:scan` only scans the active batch by default
- [ ] `npm run release:review` writes both review artifacts and only tags review-needed Eagle items
- [ ] `review-suggestions.json` excludes `reflix:*` tags and numeric tokens from content-tag suggestions
- [ ] `review-report.md` gives the exact Eagle operator actions
- [ ] `release:approve` still gates on manual Eagle approval and cleans up `reflix:review-requested`
- [ ] `release:mark-published` / `release:mark-failed` keep Eagle tags and durable publish-state consistent
- [ ] `npm run export:batch:dry` still respects `config/release-batch.json`
- [ ] `npm run build` passes
