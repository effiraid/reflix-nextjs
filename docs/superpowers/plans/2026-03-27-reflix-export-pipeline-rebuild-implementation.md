# Reflix Export Pipeline Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the export pipeline so large Reflix exports run with bounded concurrency, persist explicit checkpoints, safely resume after interruption, and recompute `relatedClips` incrementally with a full-rebuild fallback.

**Architecture:** Split the current monolithic `runExport()` flow into explicit stages: discover, media, artifacts, related, upload, finalize. Persist each run under `.tmp/export-runs/<run-id>/` with a run manifest, stage summaries, and per-item state files. Keep output-affecting work deterministic, reuse only verified stage outputs, and treat `relatedClips` as its own stage that updates only impacted clips unless safety checks force a full rebuild.

**Tech Stack:** Node.js ESM scripts, `node:test`, existing `ffmpeg`/R2 helpers, existing `scripts/lib/release-approval-state.mjs` atomic JSON helper, existing Eagle reader + index builders

**Spec:** `/Users/macbook/reflix-nextjs/docs/superpowers/specs/2026-03-27-reflix-export-pipeline-rebuild-design.md`

---

## Scope Guard

This plan includes:

- bounded local media concurrency
- bounded upload concurrency
- explicit run manifests and per-item checkpoints
- safe resume semantics
- partial `relatedClips` recomputation with full fallback
- Korean operator-facing progress output

This plan does **not** include:

- a separate remote job service
- CI-driven automatic publishing
- browse payload or deploy artifact redesign work

## File Structure

```text
scripts/
├── export.mjs                                              ← CLI entry, flag parsing, compatibility exports
└── lib/
    ├── bounded-pool.mjs                                    ← shared bounded-concurrency helper
    ├── bounded-pool.test.mjs
    ├── export-run-state.mjs                                ← run manifest, item state, resume lookup
    ├── export-run-state.test.mjs
    ├── export-media-stage.mjs                              ← resumable media generation stage
    ├── export-media-stage.test.mjs
    ├── export-artifact-stage.mjs                           ← clip JSON / index / browse artifact stage
    ├── export-artifact-stage.test.mjs
    ├── related-clips-stage.mjs                             ← impacted-clip discovery + related writeback
    ├── related-clips-stage.test.mjs
    ├── export-upload-stage.mjs                             ← resumable concurrent upload stage
    ├── export-upload-stage.test.mjs
    ├── export-pipeline.mjs                                 ← stage orchestrator
    ├── export-pipeline.test.mjs
    ├── index-builder.mjs                                   ← add pure merge helpers, keep public contracts
    ├── browse-artifacts.mjs                                ← keep pure browse artifact builders
    ├── similarity.mjs                                      ← add related fingerprint + subset recompute API
    ├── similarity.test.mjs
    └── r2-uploader.mjs                                     ← export single-entry existence check for stage use

.tmp/
└── export-runs/
    └── <run-id>/
        ├── manifest.json
        ├── summary.json
        ├── stages/
        │   ├── discover.json
        │   ├── process-media.json
        │   ├── build-artifacts.json
        │   ├── compute-related.json
        │   ├── upload.json
        │   └── finalize.json
        └── items/
            └── <clip-id>.json
```

## Run Data Contracts

### `manifest.json`

```json
{
  "schemaVersion": 1,
  "runId": "2026-03-27T14-20-00-000Z",
  "selectionSignature": "sha256:abc123",
  "startedAt": "2026-03-27T14:20:00.000Z",
  "status": "running",
  "flags": {
    "r2": true,
    "prune": false,
    "dryRun": false,
    "mediaConcurrency": 4,
    "uploadConcurrency": 6,
    "forceRelatedFullRebuild": false
  },
  "selection": {
    "source": "batch",
    "label": "config/release-batch.json (128 ids)",
    "ids": ["A1", "A2"]
  },
  "stages": {
    "discover": "completed",
    "process-media": "running",
    "build-artifacts": "pending",
    "compute-related": "pending",
    "upload": "pending",
    "finalize": "pending"
  }
}
```

### `items/<clip-id>.json`

```json
{
  "id": "A1",
  "sourceSnapshot": {
    "eagleMtime": 1711272000000,
    "mediaPath": "/library/images/A1.info/A1.mp4",
    "thumbnailPath": "/library/images/A1.info/A1_thumbnail.png"
  },
  "media": {
    "status": "completed",
    "width": 1280,
    "height": 720,
    "lqipBase64": "data:image/jpeg;base64,...",
    "outputs": {
      "video": { "path": "/repo/public/videos/A1.mp4", "size": 1200 },
      "preview": { "path": "/repo/public/previews/A1.mp4", "size": 800 },
      "thumbnail": { "path": "/repo/public/thumbnails/A1.webp", "size": 100 }
    }
  },
  "artifacts": {
    "status": "completed",
    "clipJsonPath": "/repo/public/data/clips/A1.json",
    "relatedInput": {
      "previous": { "tags": ["공격"], "folders": ["F1"], "category": "combat" },
      "next": { "tags": ["공격", "검"], "folders": ["F1"], "category": "combat" }
    }
  },
  "upload": {
    "status": "pending",
    "entries": []
  },
  "lastError": null
}
```

## Task 1: Add Run State and Safe Resume Contracts

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-run-state.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-run-state.test.mjs`

- [ ] **Step 1: Write the failing run-state tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-run-state.test.mjs` covering:
- run paths resolve under `.tmp/export-runs/<run-id>/`
- a missing run directory yields `null`
- the newest incomplete matching run is selected for resume
- item state writes are atomic
- output verification rejects missing or zero-byte files

```js
test("findLatestResumableRun returns the newest incomplete run with the same selection signature", () => {
  const run = findLatestResumableRun({
    projectRoot,
    selectionSignature: "sha256:match",
  });

  assert.equal(run?.runId, "2026-03-27T10-10-00-000Z");
});
```

- [ ] **Step 2: Run the run-state tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-run-state.test.mjs`

Expected: FAIL because `export-run-state.mjs` does not exist yet.

- [ ] **Step 3: Implement the run-state module**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-run-state.mjs` with these exports:

```js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { writeAtomicJson } from "./release-approval-state.mjs";

export const EXPORT_RUN_SCHEMA_VERSION = 1;

export function buildSelectionSignature(selection, flags) {
  const payload = JSON.stringify({
    source: selection.source,
    ids: selection.ids ?? [],
    r2: Boolean(flags.r2),
    prune: Boolean(flags.prune),
  });

  return `sha256:${crypto.createHash("sha256").update(payload).digest("hex")}`;
}

export function resolveRunPaths(projectRoot, runId) {
  const runDir = path.join(projectRoot, ".tmp", "export-runs", runId);
  return {
    runDir,
    manifestPath: path.join(runDir, "manifest.json"),
    summaryPath: path.join(runDir, "summary.json"),
    stagesDir: path.join(runDir, "stages"),
    itemsDir: path.join(runDir, "items"),
  };
}

export function verifyOutputFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (stat.size <= 0) return null;
  return { path: filePath, size: stat.size };
}
```

Also implement:
- `createRunManifest()`
- `saveRunManifest()`
- `saveStageSummary()`
- `loadRunManifest()`
- `findLatestResumableRun()`
- `loadItemState()`
- `saveItemState()`

Implementation rules:
- use `writeAtomicJson()` for every JSON checkpoint write
- only resume manifests with `status !== "completed"`
- sort candidate run IDs lexicographically descending and choose the first matching manifest

- [ ] **Step 4: Run the run-state tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-run-state.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/export-run-state.mjs scripts/lib/export-run-state.test.mjs
git commit -m "feat: add export run state contracts"
```

---

## Task 2: Add a Shared Bounded-Concurrency Helper

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/bounded-pool.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/bounded-pool.test.mjs`

- [ ] **Step 1: Write the failing pool tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/bounded-pool.test.mjs` covering:
- results preserve input order
- active workers never exceed the concurrency limit
- concurrency lower than 1 is rejected

```js
test("mapWithConcurrency never exceeds the configured worker limit", async () => {
  let active = 0;
  let maxActive = 0;

  await mapWithConcurrency([1, 2, 3, 4], async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return value * 2;
  }, { concurrency: 2 });

  assert.equal(maxActive, 2);
});
```

- [ ] **Step 2: Run the pool tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/bounded-pool.test.mjs`

Expected: FAIL because `bounded-pool.mjs` does not exist yet.

- [ ] **Step 3: Implement the bounded pool**

Create `/Users/macbook/reflix-nextjs/scripts/lib/bounded-pool.mjs`:

```js
export async function mapWithConcurrency(items, worker, { concurrency = 4 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrency must be a positive integer");
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  async function consume() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => consume())
  );

  return results;
}
```

- [ ] **Step 4: Run the pool tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/bounded-pool.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/bounded-pool.mjs scripts/lib/bounded-pool.test.mjs
git commit -m "feat: add bounded concurrency helper"
```

---

## Task 3: Build the Resumable Media Stage

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-media-stage.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-media-stage.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/media-processor.mjs`

- [ ] **Step 1: Write the failing media-stage tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-media-stage.test.mjs` covering:
- completed item state is reused only when all files verify
- invalid or zero-byte outputs trigger rebuild
- stage stores width, height, and `lqipBase64`
- one item failure does not stop other items

```js
test("runMediaStage reuses verified outputs and rebuilds invalid preview files", async () => {
  const summary = await runMediaStage(items, {
    projectRoot,
    runId: "run-1",
    concurrency: 2,
    getVideoResolutionImpl: async () => ({ width: 1280, height: 720 }),
    generateLQIPImpl: async () => "data:image/jpeg;base64,abc",
    processVideoImpl: async () => true,
    generatePreviewImpl: async () => true,
    processThumbnailImpl: async () => true,
  });

  assert.equal(summary.reused, 1);
  assert.equal(summary.rebuilt, 1);
});
```

- [ ] **Step 2: Run the media-stage tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-media-stage.test.mjs`

Expected: FAIL because `export-media-stage.mjs` does not exist yet.

- [ ] **Step 3: Make `generateLQIP()` injectable and temp-safe**

Modify `/Users/macbook/reflix-nextjs/scripts/lib/media-processor.mjs` so `generateLQIP()` accepts an optional temp root for predictable tests:

```js
export async function generateLQIP(inputPath, { tmpRoot = "/tmp" } = {}) {
  const tmpPath = path.join(tmpRoot, `lqip_${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`);
  try {
    await exec("ffmpeg", [
      "-y", "-i", inputPath,
      "-vf", "select=eq(n\\,0),scale=32:-1",
      "-frames:v", "1",
      "-q:v", "50",
      tmpPath,
    ]);
    const buffer = fs.readFileSync(tmpPath);
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}
```

- [ ] **Step 4: Implement the media stage**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-media-stage.mjs` exporting:

```js
import path from "node:path";
import { mapWithConcurrency } from "./bounded-pool.mjs";
import { loadItemState, saveItemState, verifyOutputFile } from "./export-run-state.mjs";
import {
  generateLQIP,
  generatePreview,
  processThumbnail,
  processVideo,
  getVideoResolution,
} from "./media-processor.mjs";

export function resolveMediaOutputPaths(projectRoot, clipId) {
  return {
    video: path.join(projectRoot, "public", "videos", `${clipId}.mp4`),
    preview: path.join(projectRoot, "public", "previews", `${clipId}.mp4`),
    thumbnail: path.join(projectRoot, "public", "thumbnails", `${clipId}.webp`),
  };
}
```

Implement `runMediaStage(items, options)` with rules:
- create `public/videos`, `public/previews`, `public/thumbnails` up front
- reuse an item only when checkpoint exists **and** `verifyOutputFile()` passes for every media output
- persist `width`, `height`, `lqipBase64`, and verified output metadata into the item state
- return a summary with `completed`, `failed`, `reused`, `rebuilt`

- [ ] **Step 5: Run the stage tests and targeted media regression**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-media-stage.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/media-processor.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/export-media-stage.mjs scripts/lib/export-media-stage.test.mjs scripts/lib/media-processor.mjs
git commit -m "feat: add resumable export media stage"
```

---

## Task 4: Build the Artifact Stage and Persist Related Inputs

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-artifact-stage.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-artifact-stage.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/index-builder.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/browse-artifacts.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/similarity.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/similarity.test.mjs`

- [ ] **Step 1: Write the failing artifact-stage tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-artifact-stage.test.mjs` covering:
- stage uses media checkpoint values rather than recalculating media work
- clip JSON, index, and browse artifacts are written atomically
- item state stores previous and next related inputs for changed clips

```js
test("runArtifactStage stores previous and next related inputs for related diffing", async () => {
  const summary = await runArtifactStage(items, {
    projectRoot,
    runId: "run-1",
  });

  const itemState = loadItemState({ projectRoot, runId: "run-1", clipId: "A1" });
  assert.deepEqual(itemState.artifacts.relatedInput.previous?.tags, ["공격"]);
  assert.deepEqual(itemState.artifacts.relatedInput.next.tags, ["공격", "검"]);
  assert.equal(summary.writtenClips, 1);
});
```

- [ ] **Step 2: Run the artifact-stage tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-artifact-stage.test.mjs`

Expected: FAIL because `export-artifact-stage.mjs` does not exist yet.

- [ ] **Step 3: Add pure merge and related-input helpers**

Modify `/Users/macbook/reflix-nextjs/scripts/lib/index-builder.mjs` to export a pure merge helper:

```js
export function mergeClipIndexEntries(existingEntries, nextEntries) {
  const merged = new Map(existingEntries.map((entry) => [entry.id, entry]));
  for (const entry of nextEntries) {
    merged.set(entry.id, entry);
  }
  return Array.from(merged.values());
}
```

Modify `/Users/macbook/reflix-nextjs/scripts/lib/similarity.mjs` to export:

```js
export function buildRelatedInput(clip) {
  return {
    tags: Array.isArray(clip?.tags) ? [...clip.tags].sort() : [],
    folders: Array.isArray(clip?.folders) ? [...clip.folders].sort() : [],
    category: String(clip?.category ?? "uncategorized"),
  };
}
```

Add one matching assertion to `/Users/macbook/reflix-nextjs/scripts/lib/similarity.test.mjs`.

- [ ] **Step 4: Implement the artifact stage**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-artifact-stage.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { writeAtomicJson } from "./release-approval-state.mjs";
import { loadItemState, saveItemState } from "./export-run-state.mjs";
import { buildClipIndex, buildFullClip, mergeClipIndexEntries } from "./index-builder.mjs";
import { buildBrowseArtifacts } from "./browse-artifacts.mjs";
import { buildRelatedInput } from "./similarity.mjs";
```

Implementation rules:
- read the previous clip JSON before overwriting it and store `relatedInput.previous`
- use media checkpoint `width`, `height`, and `lqipBase64` as the source of truth
- atomically write each clip JSON, merged `src/data/index.json`, and browse `summary.json` / `projection.json`
- persist `relatedInput.next` into each current-run item state

- [ ] **Step 5: Run the stage tests and targeted artifact regressions**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-artifact-stage.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/index-builder.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/browse-artifacts.test.mjs`
- `npm exec vitest run /Users/macbook/reflix-nextjs/scripts/lib/similarity.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/export-artifact-stage.mjs scripts/lib/export-artifact-stage.test.mjs scripts/lib/index-builder.mjs scripts/lib/browse-artifacts.mjs scripts/lib/similarity.mjs scripts/lib/similarity.test.mjs
git commit -m "feat: add export artifact stage"
```

---

## Task 5: Add Partial `relatedClips` Recompute with Full Fallback

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/related-clips-stage.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/related-clips-stage.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/similarity.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/similarity.test.mjs`

- [ ] **Step 1: Write the failing related-stage tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/related-clips-stage.test.mjs` covering:
- impacted IDs include the changed clip plus clips sharing old or new tags/folders
- partial mode rewrites only impacted clip JSON files
- missing related input triggers full rebuild fallback

```js
test("collectImpactedClipIds includes neighbors from previous and next relation inputs", () => {
  const impacted = collectImpactedClipIds({
    allClips,
    changedItems: [
      {
        id: "A",
        previous: { tags: ["검"], folders: ["F1"], category: "combat" },
        next: { tags: ["검", "가드"], folders: ["F2"], category: "combat" },
      },
    ],
  });

  assert.deepEqual([...impacted].sort(), ["A", "B", "C", "D"]);
});
```

- [ ] **Step 2: Run the related-stage tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/related-clips-stage.test.mjs`

Expected: FAIL because `related-clips-stage.mjs` does not exist yet.

- [ ] **Step 3: Add subset recompute support to the similarity engine**

Modify `/Users/macbook/reflix-nextjs/scripts/lib/similarity.mjs`:

```js
export function computeRelatedClipsForSubset(clips, targetIds, topN = 5) {
  const targetIdSet = new Set(targetIds);
  const full = computeRelatedClips(clips, topN);
  return new Map([...full.entries()].filter(([id]) => targetIdSet.has(id)));
}
```

Add matching expectations to `/Users/macbook/reflix-nextjs/scripts/lib/similarity.test.mjs`.

- [ ] **Step 4: Implement the related stage**

Create `/Users/macbook/reflix-nextjs/scripts/lib/related-clips-stage.mjs` with:

```js
import fs from "node:fs";
import path from "node:path";
import { writeAtomicJson } from "./release-approval-state.mjs";
import { loadItemState, saveItemState } from "./export-run-state.mjs";
import { computeRelatedClips, computeRelatedClipsForSubset } from "./similarity.mjs";
```

Implementation rules:
- load merged index + current clip JSON corpus from `public/data/clips`
- compare `relatedInput.previous` vs `relatedInput.next` for current-run items to find directly changed IDs
- expand the impacted set using both previous and next tags/folders
- if any current-run item is missing `relatedInput`, set `mode: "full"` and recompute all clips
- in partial mode, write only impacted clip JSON files atomically
- mark current-run item states as `related.status = "completed"`

- [ ] **Step 5: Run the related-stage tests and similarity regression**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/related-clips-stage.test.mjs`
- `npm exec vitest run /Users/macbook/reflix-nextjs/scripts/lib/similarity.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/related-clips-stage.mjs scripts/lib/related-clips-stage.test.mjs scripts/lib/similarity.mjs scripts/lib/similarity.test.mjs
git commit -m "feat: add incremental related clips stage"
```

---

## Task 6: Build the Resumable Concurrent Upload Stage

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-upload-stage.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-upload-stage.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/r2-uploader.mjs`

- [ ] **Step 1: Write the failing upload-stage tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-upload-stage.test.mjs` covering:
- upload stage writes per-file status (`uploaded`, `skipped`, `failed`)
- failed uploads are retried on resume while successful uploads are reused
- concurrency limit is respected

```js
test("runUploadStage retries failed files on resume without reuploading completed entries", async () => {
  const first = await runUploadStage(clipIds, {
    projectRoot,
    runId: "run-1",
    env: validEnv,
    client,
    concurrency: 2,
  });

  const second = await runUploadStage(clipIds, {
    projectRoot,
    runId: "run-1",
    env: validEnv,
    client: healedClient,
    concurrency: 2,
  });

  assert.equal(first.failed, 1);
  assert.equal(second.reused, 2);
  assert.equal(second.uploaded, 1);
});
```

- [ ] **Step 2: Run the upload-stage tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-upload-stage.test.mjs`

Expected: FAIL because `export-upload-stage.mjs` does not exist yet.

- [ ] **Step 3: Export single-entry R2 existence checks**

Modify `/Users/macbook/reflix-nextjs/scripts/lib/r2-uploader.mjs` to export the current `objectExists()` helper as `checkR2ObjectExists()`:

```js
export async function checkR2ObjectExists(client, bucketName, key) {
  const { HeadObjectCommand } = require("@aws-sdk/client-s3");
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    return true;
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}
```

- [ ] **Step 4: Implement the upload stage**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-upload-stage.mjs`:

```js
import path from "node:path";
import { mapWithConcurrency } from "./bounded-pool.mjs";
import { loadItemState, saveItemState, verifyOutputFile } from "./export-run-state.mjs";
import {
  createR2ClientFromEnv,
  uploadFile,
  toR2ObjectKey,
  getContentTypeForKey,
  checkR2ObjectExists,
} from "./r2-uploader.mjs";
```

Implementation rules:
- each current-run clip produces three upload candidates: video, preview, thumbnail
- reuse only entries whose checkpoint status is `uploaded` or `skipped` **and** whose local file still verifies
- keep retry-with-backoff inside the upload stage, not in the orchestrator
- save per-file upload entries into each item state after every file finishes

- [ ] **Step 5: Run the upload-stage tests and R2 uploader regression**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-upload-stage.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/r2-uploader.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/export-upload-stage.mjs scripts/lib/export-upload-stage.test.mjs scripts/lib/r2-uploader.mjs
git commit -m "feat: add resumable export upload stage"
```

---

## Task 7: Wire the Stage Orchestrator and CLI

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-pipeline.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/export-pipeline.test.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/export.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/export.test.mjs`

- [ ] **Step 1: Write the failing orchestrator tests**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-pipeline.test.mjs` covering:
- first run creates a new manifest and runs stages in order
- compatible interrupted runs resume automatically
- `--fresh-run` bypasses resume
- stage failure marks the run as failed and prevents finalize success

```js
test("runExportPipeline resumes the newest matching incomplete run unless fresh-run is requested", async () => {
  const resumed = await runExportPipeline(flags, { projectRoot, eagleLibraryPath, env });
  assert.equal(resumed.runId, "2026-03-27T10-10-00-000Z");

  const fresh = await runExportPipeline({ ...flags, freshRun: true }, { projectRoot, eagleLibraryPath, env });
  assert.notEqual(fresh.runId, resumed.runId);
});
```

- [ ] **Step 2: Run the orchestrator tests to verify they fail**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-pipeline.test.mjs`

Expected: FAIL because `export-pipeline.mjs` does not exist yet.

- [ ] **Step 3: Extend CLI flags for resume and concurrency**

Modify `/Users/macbook/reflix-nextjs/scripts/export.mjs` `parseFlags()` result to include:

```js
{
  mediaConcurrency: Number.isNaN(parsedMediaConcurrency) ? 4 : parsedMediaConcurrency,
  uploadConcurrency: Number.isNaN(parsedUploadConcurrency) ? 6 : parsedUploadConcurrency,
  freshRun: args.includes("--fresh-run"),
  resumeRun: resumeRunIdx !== -1 && args[resumeRunIdx + 1] ? args[resumeRunIdx + 1] : null,
  forceRelatedFullRebuild: args.includes("--force-related-full-rebuild"),
}
```

Also add one flag assertion in `/Users/macbook/reflix-nextjs/scripts/export.test.mjs`.

- [ ] **Step 4: Implement the stage orchestrator**

Create `/Users/macbook/reflix-nextjs/scripts/lib/export-pipeline.mjs`:

```js
import path from "node:path";
import { resolveEagleLibraryPath } from "./eagle-library-path.mjs";
import { readEagleLibrary } from "./eagle-reader.mjs";
import { loadCategoryMap } from "./index-builder.mjs";
import { prunePublishedArtifacts } from "./published-artifacts.mjs";
import {
  buildSelectionSignature,
  createRunManifest,
  findLatestResumableRun,
  saveRunManifest,
  saveStageSummary,
} from "./export-run-state.mjs";
import { runMediaStage } from "./export-media-stage.mjs";
import { runArtifactStage } from "./export-artifact-stage.mjs";
import { runRelatedStage } from "./related-clips-stage.mjs";
import { runUploadStage } from "./export-upload-stage.mjs";
```

Implement `runExportPipeline(flags, options)` with this exact order:
1. resolve selection + items
2. create or resume run manifest
3. `discover`
4. `process-media`
5. `build-artifacts`
6. `compute-related`
7. optional `upload`
8. optional `prune` only when no item/stage failures remain
9. `finalize`

Operator logging rules:
- emit Korean messages only
- mention reuse explicitly, for example `재개 모드: 검증된 결과를 재사용합니다`
- print per-stage counts after each stage summary write

- [ ] **Step 5: Slim the CLI entry point**

Modify `/Users/macbook/reflix-nextjs/scripts/export.mjs` so it becomes a thin entry point:

```js
import { runExportPipeline } from "./lib/export-pipeline.mjs";

export async function runExport(flags, options = {}) {
  return runExportPipeline(flags, options);
}
```

Keep these compatibility exports in `export.mjs` because existing tests and scripts depend on them:
- `parseFlags`
- `resolveRequestedClipIds`
- `buildMergedKeepIds`
- `resolveEagleLibraryPath`

- [ ] **Step 6: Run the orchestrator and export regression tests**

Run:
- `node --test /Users/macbook/reflix-nextjs/scripts/lib/export-pipeline.test.mjs`
- `node --test /Users/macbook/reflix-nextjs/scripts/export.test.mjs`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/export-pipeline.mjs scripts/lib/export-pipeline.test.mjs scripts/export.mjs scripts/export.test.mjs
git commit -m "feat: orchestrate export stages with safe resume"
```

---

## Task 8: Update Docs and Run the Full Regression Slice

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/README.md`
- Modify: `/Users/macbook/reflix-nextjs/docs/pipeline/reflix-pipeline-overview.md`
- Modify: `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-approval-and-publish-design.md`

- [ ] **Step 1: Update README export workflow docs**

Add explicit operator guidance for:
- run workspace location: `.tmp/export-runs/<run-id>/`
- automatic resume behavior
- `--fresh-run`
- `--resume-run <run-id>`
- `--media-concurrency`
- `--upload-concurrency`
- `--force-related-full-rebuild`

Use concrete Korean examples:

```md
- 다시 같은 export를 실행하면, 아직 끝나지 않은 동일 대상 run이 있으면 자동으로 재개한다.
- 이전 run을 무시하고 처음부터 새로 시작하려면 `node scripts/export.mjs --fresh-run`을 사용한다.
- 특정 run을 직접 재개하려면 `node scripts/export.mjs --resume-run <run-id>`를 사용한다.
```

- [ ] **Step 2: Update pipeline design docs to match the new operator model**

In `/Users/macbook/reflix-nextjs/docs/pipeline/reflix-pipeline-overview.md` and `/Users/macbook/reflix-nextjs/docs/pipeline/phase-2-approval-and-publish-design.md`, replace the old “single sequential export step” description with:

```md
- export는 `discover → process-media → build-artifacts → compute-related → upload → finalize` 단계로 실행된다.
- 중간 실패 후 재실행 시 검증된 단계 산출물만 재사용한다.
- 운영자가 보는 진행 메시지와 요약은 한글로 출력된다.
```

- [ ] **Step 3: Run the full regression slice**

Run:

```bash
node --test /Users/macbook/reflix-nextjs/scripts/lib/export-run-state.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/bounded-pool.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/export-media-stage.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/export-artifact-stage.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/related-clips-stage.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/export-upload-stage.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/export-pipeline.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/export.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/media-processor.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/index-builder.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/browse-artifacts.test.mjs
node --test /Users/macbook/reflix-nextjs/scripts/lib/r2-uploader.test.mjs
npm exec vitest run /Users/macbook/reflix-nextjs/scripts/lib/similarity.test.mjs
```

Expected: PASS

- [ ] **Step 4: Manual smoke checks**

Run:

```bash
node /Users/macbook/reflix-nextjs/scripts/export.mjs --dry-run
node /Users/macbook/reflix-nextjs/scripts/export.mjs --dry-run --r2 --media-concurrency 2 --upload-concurrency 2
```

Expected:
- dry-run prints Korean stage planning output
- no files are written
- the command reports whether it would create a new run or resume an existing one

- [ ] **Step 5: Commit**

```bash
git add README.md docs/pipeline/reflix-pipeline-overview.md docs/pipeline/phase-2-approval-and-publish-design.md
git commit -m "docs: document resumable export pipeline"
```

---

## Self-Review Checklist

- Spec coverage:
  - concurrency: Tasks 2, 3, 6, 7
  - checkpoints/resume: Tasks 1, 3, 4, 6, 7
  - partial related recompute: Tasks 4 and 5
  - Korean operator output: Tasks 7 and 8
  - deterministic finalize/prune behavior: Tasks 7 and 8

- Placeholder scan:
  - no unfinished placeholders or cross-task shorthand remain
  - every task includes exact file paths, concrete commands, and a commit step

- Type consistency:
  - stage names are consistently `discover`, `process-media`, `build-artifacts`, `compute-related`, `upload`, `finalize`
  - run/item state uses `status`, `relatedInput.previous`, and `relatedInput.next` consistently
