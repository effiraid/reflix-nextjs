# Reflix Release Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unsafe whole-library export default with a release-batch workflow so local and production always publish the same selected clip set while the Eagle source path remains configurable.

**Architecture:** Treat Eagle/Desktop/NAS as the source library, `config/release-batch.json` as the active publish batch, and the generated `src/data/index.json` plus `public/data/clips`, `public/videos`, `public/previews`, and `public/thumbnails` as the published artifact set. The export script should default to the checked-in release batch, require an explicit double opt-in for full-library exports, support batch-scoped R2 uploads, and optionally prune stale local artifacts so the repository stays aligned with the active batch.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Node.js ESM, `node:test`, Vitest, FFmpeg, Cloudflare R2 via `@aws-sdk/client-s3`

---

## Current Decisions

- The local Eagle source continues to come from `EAGLE_LIBRARY_PATH`, not from a hard-coded NAS mount.
- The current local default path is `/Users/macbook/Desktop/라이브러리/레퍼런스 - 게임,연출.library`.
- The app keeps using generated artifacts only; it must not read Eagle or NAS paths at runtime.
- `config/release-batch.json` becomes the single checked-in definition of “what this deployment publishes”.
- Local dev and production are considered aligned only when they use the same generated batch artifacts.
- Full-library export remains possible, but only behind an explicit safety handshake.

## File Structure

```text
config/
└── release-batch.json                          ← active publish batch checked into the repo

scripts/
├── export.mjs                                  ← batch-first export entrypoint
├── export.test.mjs                             ← flag parsing + batch behavior coverage
└── lib/
    ├── eagle-library-path.mjs                  ← existing env-based source resolver
    ├── release-batch.mjs                       ← load and validate the active batch
    ├── release-batch.test.mjs                  ← batch config validation coverage
    ├── published-artifacts.mjs                 ← prune stale local artifacts outside the batch
    ├── published-artifacts.test.mjs            ← prune behavior coverage
    └── r2-uploader.mjs                         ← existing upload module reused by batch export

repo root/
├── .env.local.example                          ← local Desktop source path + hosted media examples
├── README.md                                   ← operator workflow for batch export/deploy
└── package.json                                ← scripts for batch export, dry-run, and explicit full export

generated artifacts/
├── src/data/index.json                         ← clip index for the active batch
├── public/data/clips/*.json                    ← per-clip JSON for the active batch
├── public/videos/*.mp4                         ← local/published videos for the active batch
├── public/previews/*.mp4                       ← local/published previews for the active batch
└── public/thumbnails/*.webp                    ← local/published thumbnails for the active batch
```

## Active MVP Batch

The first checked-in batch should contain these ten IDs:

```json
{
  "name": "mvp-10",
  "ids": [
    "L3TR52T22TPVR",
    "L3TR52T27B2VL",
    "L3TR52T2A751G",
    "L3TR52T2BJCOW",
    "L3TR52T2F47S1",
    "L3TR52T2K3FY9",
    "L3TR52T2RH4G6",
    "L3TR52T2S1A9X",
    "L3TR52T2VXUHO",
    "L3TR52T302BJZ"
  ]
}
```

---

### Task 1: Add a Checked-In Release Batch Definition

**Files:**
- Create: `config/release-batch.json`
- Create: `scripts/lib/release-batch.mjs`
- Create: `scripts/lib/release-batch.test.mjs`

- [ ] **Step 1: Write the failing batch loader tests**

Create `scripts/lib/release-batch.test.mjs` covering:
- valid JSON loads `name` and ordered `ids`
- duplicate IDs throw a clear error
- empty `ids` throws a clear error
- missing config file throws a clear error

- [ ] **Step 2: Run the batch loader tests to verify they fail**

Run: `node --test scripts/lib/release-batch.test.mjs`
Expected: FAIL because `scripts/lib/release-batch.mjs` does not exist yet.

- [ ] **Step 3: Implement the release batch loader**

Create `scripts/lib/release-batch.mjs` exporting:

```js
export function resolveReleaseBatchPath({ batchPath, projectRoot }) {}
export function loadReleaseBatch(batchPath) {}
export function normalizeReleaseBatchIds(rawIds) {}
```

Implementation rules:
- accept only JSON files
- preserve ID order from the file
- reject duplicates and blank strings
- return `{ name, ids, path }`

- [ ] **Step 4: Check in the active batch file**

Create `config/release-batch.json` with the current MVP ten IDs shown above.

- [ ] **Step 5: Run the batch loader tests again**

Run: `node --test scripts/lib/release-batch.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add config/release-batch.json scripts/lib/release-batch.mjs scripts/lib/release-batch.test.mjs
git commit -m "feat: add release batch config loader"
```

---

### Task 2: Make Export Batch-First and Full Export Explicitly Dangerous

**Files:**
- Modify: `scripts/export.mjs`
- Modify: `scripts/export.test.mjs`

- [ ] **Step 1: Write the failing export flag tests**

Extend `scripts/export.test.mjs` to cover:
- default export mode uses `config/release-batch.json`
- `--batch path/to/file.json` overrides the default batch file
- `--ids A,B` overrides batch IDs
- `--full` without `--confirm-full-export` throws a safety error
- `--full --confirm-full-export` is the only valid full-library path

- [ ] **Step 2: Run the export tests to verify they fail**

Run: `node --test scripts/export.test.mjs`
Expected: FAIL because the new batch-first semantics are not implemented yet.

- [ ] **Step 3: Update flag parsing and export resolution**

In `scripts/export.mjs`:
- add `batchPath` from `--batch`
- add `confirmFullExport` from `--confirm-full-export`
- if `--ids` is present, use those IDs
- else if `--full` and `--confirm-full-export` are both present, read the entire library
- else load IDs from `config/release-batch.json` (or `--batch`)

Use a safety guard like:

```js
if (flags.full && !flags.confirmFullExport) {
  throw new Error("Full export requires --confirm-full-export");
}
```

- [ ] **Step 4: Surface the batch source in export output**

Update console output so every run prints one of:
- `Batch source: config/release-batch.json (10 ids)`
- `Batch source: --ids override (N ids)`
- `Batch source: full library`

- [ ] **Step 5: Run the export tests again**

Run: `node --test scripts/export.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/export.mjs scripts/export.test.mjs
git commit -m "feat: make export batch-first"
```

---

### Task 3: Add Safe Pruning for Local Published Artifacts

**Files:**
- Create: `scripts/lib/published-artifacts.mjs`
- Create: `scripts/lib/published-artifacts.test.mjs`
- Modify: `scripts/export.mjs`

- [ ] **Step 1: Write the failing prune tests**

Create `scripts/lib/published-artifacts.test.mjs` covering:
- files with kept IDs remain in place
- files outside the keep set are removed from:
  - `public/videos`
  - `public/previews`
  - `public/thumbnails`
  - `public/data/clips`
- dry-run mode reports removals without deleting files

- [ ] **Step 2: Run the prune tests to verify they fail**

Run: `node --test scripts/lib/published-artifacts.test.mjs`
Expected: FAIL because `scripts/lib/published-artifacts.mjs` does not exist yet.

- [ ] **Step 3: Implement the prune helper**

Create `scripts/lib/published-artifacts.mjs` exporting:

```js
export async function prunePublishedArtifacts({ keepIds, projectRoot, dryRun = false }) {}
```

Behavior:
- only delete generated artifact files, never directories
- derive IDs from filenames
- return a summary:

```js
{ removed: 0, planned: 0, entries: [] }
```

- [ ] **Step 4: Wire prune mode into the export script**

In `scripts/export.mjs`:
- add `--prune`
- after a successful batch export, call `prunePublishedArtifacts({ keepIds: clipIds, projectRoot, dryRun: flags.dryRun })`
- print separate counts for generated files and removed stale files

- [ ] **Step 5: Run prune and export tests**

Run:
- `node --test scripts/lib/published-artifacts.test.mjs`
- `node --test scripts/export.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/published-artifacts.mjs scripts/lib/published-artifacts.test.mjs scripts/export.mjs
git commit -m "feat: add batch prune workflow"
```

---

### Task 4: Align Operator Commands and Environment Defaults

**Files:**
- Modify: `.env.local.example`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Write the failing command/docs expectations**

Add a focused script-level assertion in `scripts/export.test.mjs` or a new small docs/config test that checks:
- `.env.local.example` points to the Desktop Eagle library path
- `package.json` exposes batch-first scripts

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test scripts/export.test.mjs`
Expected: FAIL until the new scripts and env defaults exist.

- [ ] **Step 3: Update package scripts**

In `package.json`, add:

```json
{
  "scripts": {
    "export:batch": "node scripts/export.mjs --prune",
    "export:batch:dry": "node scripts/export.mjs --dry-run",
    "export:batch:r2": "node scripts/export.mjs --prune --r2",
    "export:full": "node scripts/export.mjs --full --confirm-full-export"
  }
}
```

- [ ] **Step 4: Update env and operator docs**

In `.env.local.example`:
- keep `NEXT_PUBLIC_MEDIA_URL` unset by default
- set `EAGLE_LIBRARY_PATH="/Users/macbook/Desktop/라이브러리/레퍼런스 - 게임,연출.library"`
- keep hosted media examples pointing at the current domain

In `README.md`:
- describe `config/release-batch.json` as the active deploy batch
- explain that local and production align when they are built from the same batch
- document `npm run export:batch`, `npm run export:batch:dry`, and `npm run export:batch:r2`
- document that future NAS migration is an `EAGLE_LIBRARY_PATH` change only

- [ ] **Step 5: Run the focused test again**

Run: `node --test scripts/export.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .env.local.example README.md package.json scripts/export.test.mjs
git commit -m "docs: document release batch workflow"
```

---

### Task 5: Verify Local and Production Parity on the Active Batch

**Files:**
- Modify: `src/data/index.json`
- Modify: `public/data/clips/*.json`
- Modify: `public/videos/*.mp4`
- Modify: `public/previews/*.mp4`
- Modify: `public/thumbnails/*.webp`

- [ ] **Step 1: Run a dry-run on the active batch**

Run: `node scripts/export.mjs --dry-run`
Expected: output shows `Batch source: config/release-batch.json (10 ids)` and lists only the active batch.

- [ ] **Step 2: Materialize and prune the active batch locally**

Run: `node scripts/export.mjs --prune`
Expected:
- `Processed items: 10`
- `Index entries: 10`
- only ten files remain in each generated artifact directory

- [ ] **Step 3: Verify generated artifact counts**

Run:

```bash
find public/videos -maxdepth 1 -type f | wc -l
find public/previews -maxdepth 1 -type f | wc -l
find public/thumbnails -maxdepth 1 -type f | wc -l
find public/data/clips -maxdepth 1 -type f | wc -l
```

Expected: `10` for all four commands.

- [ ] **Step 4: Verify app data points at the same ten IDs**

Run:

```bash
node --input-type=module - <<'EOF'
import data from './src/data/index.json' with { type: 'json' };
console.log(data.totalCount);
console.log(data.clips.map((clip) => clip.id).join('\n'));
EOF
```

Expected:
- first line is `10`
- printed IDs match `config/release-batch.json`

- [ ] **Step 5: Verify the app still builds on the active batch**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Optional hosted-media preflight for the same batch**

Run: `node scripts/export.mjs --dry-run --r2`
Expected: planned uploads only for the active ten IDs.

- [ ] **Step 7: Commit**

```bash
git add src/data/index.json public/data/clips public/videos public/previews public/thumbnails
git commit -m "chore: publish active release batch"
```
