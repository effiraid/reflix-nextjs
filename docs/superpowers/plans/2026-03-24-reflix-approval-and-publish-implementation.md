# Reflix Approval and Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Phase 2 approval system where Reflix auto-selects Eagle publish candidates, the operator approves them in Eagle exactly once, and successful publish results are written back to both Eagle status tags and a durable publish-state file.

**Architecture:** Add a dedicated release-approval workflow alongside the existing batch export pipeline. `scan` will compute auto-candidates and write `.tmp` artifacts for human review, `approve` will promote only Eagle-approved candidates into the active release batch, and `mark-published` / `mark-failed` will durably record publish outcomes in both Eagle metadata and a checked-in publish-state file. Reuse the existing export batch flow rather than re-implementing media generation.

**Tech Stack:** Node.js ESM scripts, `node:test`, Eagle `metadata.json` files, existing `scripts/lib/eagle-reader.mjs`, existing `scripts/export.mjs`, existing `scripts/lib/release-batch.mjs`

**Spec:** `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-approval-and-publish-design.md`

---

## Scope Guard

This plan intentionally stops at:

- auto candidate scan
- Eagle approval promotion into `config/release-batch.json`
- publish outcome marking back into Eagle and durable state

This plan does **not** automate Vercel production deployment itself. Existing `npm run export:batch` / `npm run export:batch:r2` remain the publish execution path for now.

## File Structure

```text
config/
├── release-batch.json                              ← active publish batch, already exists
└── published-state.json                            ← durable publish history across sessions

scripts/
├── release-approval.mjs                            ← scan / approve / mark-published / mark-failed CLI
├── export.mjs                                      ← existing batch-first export, reused by publish stage
└── lib/
    ├── eagle-reader.mjs                            ← existing Eagle metadata reader
    ├── eagle-metadata.mjs                          ← shared safe metadata mutation + tag update helper
    ├── eagle-metadata.test.mjs                     ← metadata write/tag mutation coverage
    ├── eagle-phase2.mjs                            ← modified to consume eagle-metadata helper
    ├── release-approval-state.mjs                  ← artifacts, published-state, signature helpers
    ├── release-approval-state.test.mjs             ← state contract coverage
    ├── release-approval.mjs                        ← scan/approve/mark business logic
    └── release-approval.test.mjs                   ← end-to-end workflow coverage with temp Eagle libs

.tmp/
└── release-approval/
    └── <timestamp>/
        ├── release-batch.proposed.json             ← auto-selected approval batch snapshot
        └── proposal-report.md                      ← operator-facing approval report

docs/
├── pipeline/
│   ├── phase-2-approval-and-publish-design.md      ← approved design
│   └── phase-2-release-workflow.md                 ← operator workflow doc
└── superpowers/plans/
    └── 2026-03-24-reflix-approval-and-publish-implementation.md
```

## Data Contracts

### `config/published-state.json`

```json
{
  "version": 1,
  "updatedAt": "2026-03-24T12:00:00.000Z",
  "entries": {
    "L3TR52T22TPVR": {
      "publishedAt": "2026-03-24T12:00:00.000Z",
      "batchName": "mvp-10",
      "eagleMtime": 1711272400000,
      "exportSignature": "sha256:abc123"
    }
  }
}
```

### `.tmp/release-approval/<timestamp>/release-batch.proposed.json`

```json
{
  "name": "proposal-2026-03-24T12-00-00.000Z",
  "ids": ["L3TR52T22TPVR", "L3TR52T27B2VL"]
}
```

### `.tmp/release-approval/<timestamp>/proposal-report.md`

The report must include:

- scan timestamp
- library path
- total eligible items
- auto-selected item count
- per-item reason (`new`, `changed`, `retry_failed_publish`, `held`, `blocked`)
- current Eagle status tags
- exact operator instruction:
  - review in Eagle
  - add `reflix:approved` to approve
  - add `reflix:hold` to exclude
  - run the approve command afterward

## Task 1: Extract Shared Eagle Metadata Mutation Helpers

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs`

- [ ] **Step 1: Write the failing metadata helper tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs` covering:
- writing metadata with a backup preserves untouched fields
- adding status tags does not duplicate existing tags
- removing status tags leaves non-status tags untouched
- backup files are created before metadata replacement

```js
test("applyStatusTagMutation adds and removes only requested tags", () => {
  const result = applyStatusTagMutation(
    ["연출", "아케인", "reflix:approved"],
    {
      addTags: ["reflix:published"],
      removeTags: ["reflix:approved", "reflix:publish-failed"],
    }
  );

  assert.deepEqual(result, ["연출", "아케인", "reflix:published"]);
});
```

- [ ] **Step 2: Run the metadata helper tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs`

Expected: FAIL because `eagle-metadata.mjs` does not exist yet.

- [ ] **Step 3: Implement the shared metadata helper**

Create `/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.mjs` exporting:

```js
export function applyStatusTagMutation(currentTags, { addTags = [], removeTags = [] }) {}
export function writeMetadataWithBackup(entry, metadataPatch, backupDir) {}
```

Implementation rules:
- preserve tag order for untouched tags
- never duplicate tags
- write a backup file before replacing `metadata.json`
- use atomic temp-file replacement like the existing Phase 2 helper
- patch only the requested keys (`name`, `tags`, `folders`, or future fields)

- [ ] **Step 4: Reuse the helper in the existing Eagle Phase 2 code**

Replace the local `writeMetadataWithBackup()` implementation in `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs` with an import from `eagle-metadata.mjs`.

- [ ] **Step 5: Run the helper tests and a targeted regression test**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "apply"`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/eagle-metadata.mjs scripts/lib/eagle-metadata.test.mjs scripts/lib/eagle-phase2.mjs
git commit -m "refactor: extract shared eagle metadata helper"
```

---

## Task 2: Add Approval Artifact and Published-State Contracts

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/config/release-batch.json` (read-only during tests)

- [ ] **Step 1: Write the failing state contract tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs` covering:
- approval artifact paths resolve under `.tmp/release-approval/<timestamp>/`
- `published-state.json` defaults to an empty v1 structure when missing
- `savePublishedState()` writes atomically
- `computeExportSignature()` ignores Reflix operation tags
- `computeExportSignature()` changes when name, content tags, folders, annotation, star, or dimensions change

```js
test("computeExportSignature ignores reflix operation tags", () => {
  const base = {
    id: "ITEM1",
    name: "연출 아케인 힘듦",
    tags: ["연출", "아케인", "reflix:approved"],
    folders: ["F1"],
    annotation: "",
    star: 3,
    duration: 3.2,
    width: 1280,
    height: 720,
    mtime: 123,
  };

  assert.equal(
    computeExportSignature(base),
    computeExportSignature({ ...base, tags: ["연출", "아케인", "reflix:published"] })
  );
});
```

- [ ] **Step 2: Run the state contract tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs`

Expected: FAIL because `release-approval-state.mjs` does not exist yet.

- [ ] **Step 3: Implement approval state helpers**

Create `/Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.mjs` exporting:

```js
export function buildReleaseApprovalArtifacts({ timestamp, projectRoot }) {}
export function loadPublishedState({ projectRoot }) {}
export function savePublishedState({ projectRoot, state }) {}
export function computeExportSignature(item) {}
export function buildProposalBatch({ timestamp, ids }) {}
```

Implementation rules:
- `published-state.json` lives in `config/`, not `.tmp`
- proposal artifacts live in `.tmp/release-approval/<timestamp>/`
- ignore `reflix:*` tags when building the signature
- sort remaining content tags before hashing
- use a stable JSON payload before hashing so signatures are deterministic

- [ ] **Step 4: Run the state tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/release-approval-state.mjs scripts/lib/release-approval-state.test.mjs
git commit -m "feat: add release approval state contracts"
```

---

## Task 3: Implement `scan` Candidate Selection and Proposal Report

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/package.json`

- [ ] **Step 1: Write the failing scan tests**

Add scan-focused tests in `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs` covering:
- new item with no publish history becomes `new`
- published item with changed signature becomes `changed`
- item with `reflix:publish-failed` becomes `retry_failed_publish`
- item with `reflix:hold` is excluded
- scan writes both `release-batch.proposed.json` and `proposal-report.md`

```js
test("runReleaseScan excludes held items and reports changed items", async () => {
  const result = await runReleaseScan({
    items: [
      makeItem("KEEP1", { tags: ["연출", "reflix:approved"] }),
      makeItem("HOLD1", { tags: ["연출", "reflix:hold"] }),
      makeItem("CHANGED1", { tags: ["연출"], mtime: 200 }),
    ],
    publishedState: {
      version: 1,
      updatedAt: "2026-03-24T00:00:00.000Z",
      entries: {
        CHANGED1: {
          publishedAt: "2026-03-23T00:00:00.000Z",
          batchName: "old-batch",
          eagleMtime: 100,
          exportSignature: "sha256:stale"
        }
      }
    }
  });

  assert.deepEqual(result.selectedIds, ["KEEP1", "CHANGED1"]);
  assert.equal(result.summary.heldCount, 1);
});
```

- [ ] **Step 2: Run the scan tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "scan"`

Expected: FAIL because the release-approval module does not exist yet.

- [ ] **Step 3: Implement scan logic and CLI entrypoint**

Create `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs` and `/Users/macbook/reflix-nextjs/scripts/release-approval.mjs`.

Required exports:

```js
export function parseReleaseApprovalCliArgs(argv = process.argv.slice(2)) {}
export async function runReleaseScan(parsed) {}
```

`scan` behavior:
- read Eagle items from `EAGLE_LIBRARY_PATH` or `--library`
- treat only Phase 1-ready mp4 items as eligible
- exclude `reflix:hold`
- mark reasons as `new`, `changed`, or `retry_failed_publish`
- write `.tmp/release-approval/<timestamp>/release-batch.proposed.json`
- write `.tmp/release-approval/<timestamp>/proposal-report.md`

Package scripts to add:

```json
{
  "scripts": {
    "release:scan": "node scripts/release-approval.mjs scan"
  }
}
```

- [ ] **Step 4: Run the scan tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "scan"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/release-approval.mjs scripts/lib/release-approval.mjs scripts/lib/release-approval.test.mjs package.json
git commit -m "feat: add release approval scan workflow"
```

---

## Task 4: Implement `approve` Promotion from Eagle Tags into the Active Batch

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/package.json`

- [ ] **Step 1: Write the failing approve tests**

Extend `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs` to cover:
- only `reflix:approved && !reflix:hold` items from the proposal are promoted
- proposal order is preserved in the resulting batch
- empty approved result throws a clear error and does not overwrite `config/release-batch.json`
- approve writes a fresh proposed batch snapshot before promoting

```js
test("runReleaseApprove promotes only approved items in proposal order", async () => {
  const result = await runReleaseApprove({
    proposalIds: ["A", "B", "C"],
    items: [
      makeItem("A", { tags: ["reflix:approved"] }),
      makeItem("B", { tags: ["reflix:approved", "reflix:hold"] }),
      makeItem("C", { tags: [] }),
    ],
    projectRoot: fixtureRoot,
    timestamp: "2026-03-24T12-00-00.000Z",
  });

  assert.deepEqual(result.approvedIds, ["A"]);
});
```

- [ ] **Step 2: Run the approve tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "approve"`

Expected: FAIL because approve mode is not implemented yet.

- [ ] **Step 3: Implement approve mode**

Add to `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`:

```js
export async function runReleaseApprove(parsed) {}
```

Behavior:
- load the latest or explicit proposed batch
- reload current Eagle metadata
- keep only IDs whose items have `reflix:approved` and not `reflix:hold`
- write the approved subset back to `.tmp/release-approval/<timestamp>/release-batch.proposed.json`
- atomically overwrite `/Users/macbook/reflix-nextjs/config/release-batch.json`

Add package script:

```json
{
  "scripts": {
    "release:approve": "node scripts/release-approval.mjs approve"
  }
}
```

- [ ] **Step 4: Run the approve tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "approve"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/release-approval.mjs scripts/lib/release-approval.test.mjs scripts/release-approval.mjs package.json config/release-batch.json
git commit -m "feat: promote eagle-approved items into the active release batch"
```

---

## Task 5: Implement Publish Outcome Marking and Durable Publish History

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/release-approval.mjs`
- Modify: `/Users/macbook/reflix-nextjs/package.json`
- Create: `/Users/macbook/reflix-nextjs/config/published-state.json` (initial empty file)

- [ ] **Step 1: Write the failing publish outcome tests**

Extend `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs` to cover:
- `mark-published` adds `reflix:published`, removes `reflix:approved` and `reflix:publish-failed`
- `mark-failed` adds `reflix:publish-failed`, removes `reflix:published`
- `mark-published` updates `config/published-state.json` with `publishedAt`, `batchName`, `eagleMtime`, and `exportSignature`
- `mark-failed` does not overwrite a successful publish-state entry as if it were successful

```js
test("runMarkPublished writes durable publish state and updates Eagle tags", async () => {
  const result = await runReleaseMarkPublished({
    batch: { name: "mvp-10", ids: ["A"] },
    items: [makeItem("A", { tags: ["연출", "reflix:approved"], mtime: 123 })],
    projectRoot: fixtureRoot,
    timestamp: "2026-03-24T12-00-00.000Z",
  });

  assert.deepEqual(result.updatedIds, ["A"]);
});
```

- [ ] **Step 2: Run the publish outcome tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "mark"`

Expected: FAIL because mark modes are not implemented yet.

- [ ] **Step 3: Implement `mark-published` and `mark-failed`**

Add to `/Users/macbook/reflix-nextjs/scripts/lib/release-approval.mjs`:

```js
export async function runReleaseMarkPublished(parsed) {}
export async function runReleaseMarkFailed(parsed) {}
```

Behavior:
- default to the active batch from `config/release-batch.json`
- mutate Eagle tags through `eagle-metadata.mjs`
- `mark-published`
  - add `reflix:published`
  - remove `reflix:approved`
  - remove `reflix:publish-failed`
  - update `config/published-state.json`
- `mark-failed`
  - add `reflix:publish-failed`
  - remove `reflix:published`
  - keep or remove `reflix:approved` based on explicit policy; choose one and document it in code comments

Add package scripts:

```json
{
  "scripts": {
    "release:mark-published": "node scripts/release-approval.mjs mark-published",
    "release:mark-failed": "node scripts/release-approval.mjs mark-failed"
  }
}
```

- [ ] **Step 4: Create the initial durable state file**

Create `/Users/macbook/reflix-nextjs/config/published-state.json`:

```json
{
  "version": 1,
  "updatedAt": "",
  "entries": {}
}
```

- [ ] **Step 5: Run the mark tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs --test-name-pattern "mark"`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/release-approval.mjs scripts/lib/release-approval.test.mjs scripts/release-approval.mjs package.json config/published-state.json
git commit -m "feat: persist publish outcomes and eagle status tags"
```

---

## Task 6: Document the Operator Flow and Verify the End-to-End CLI Path

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/README.md`
- Modify: `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-release-workflow.md`
- Modify: `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-approval-and-publish-design.md`

- [ ] **Step 1: Write the failing documentation/config expectations**

Add one focused test block in `/Users/macbook/reflix-nextjs/scripts/export.test.mjs` or a new small release-approval config test asserting:
- `package.json` exposes `release:scan`, `release:approve`, `release:mark-published`, `release:mark-failed`
- `config/published-state.json` exists and has version `1`

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/export.test.mjs`

Expected: FAIL until the new scripts and state file are documented and committed.

- [ ] **Step 3: Update docs**

In `/Users/macbook/reflix-nextjs/README.md`, document:
- `npm run release:scan`
- Eagle review step with `reflix:approved` / `reflix:hold`
- `npm run release:approve`
- `npm run export:batch`
- `npm run release:mark-published`
- `npm run release:mark-failed`

In `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-release-workflow.md`, revise the operator flow to point to the new commands rather than a purely manual batch definition.

In `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-approval-and-publish-design.md`, add any implementation decisions that differed from the original draft, especially:
- `published-state.json` living in `config/`
- proposed artifacts living in `.tmp/`

- [ ] **Step 4: Run the focused test again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/export.test.mjs`

Expected: PASS

- [ ] **Step 5: Run end-to-end verification**

Run:

```bash
node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval-state.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/release-approval.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/export.test.mjs
npm run export:batch:dry
npm run build
```

Expected:
- all tests PASS
- `export:batch:dry` still prints the active batch source
- build PASS

- [ ] **Step 6: Commit**

```bash
git add README.md docs/pipeline/phase-2-release-workflow.md docs/pipeline/phase-2-approval-and-publish-design.md scripts/export.test.mjs package.json config/published-state.json
git commit -m "docs: document release approval workflow"
```
