# Incremental Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export 파이프라인을 교체(replacement) 방식에서 증분(merge) 방식으로 전환하여, 10K 클립을 배치 단위로 점진적 export 가능하게 한다.

**Architecture:** `writeOutputFiles()`가 기존 index.json을 읽고 새 배치를 upsert 방식으로 merge한 후 저장. `--prune`을 기본에서 제거하고, prune 시 merged index 전체 ID를 keepIds로 사용. related clips는 merged 전체 대상으로 재계산.

**Tech Stack:** Node.js ESM, fs (sync), node:test

**Spec:** `docs/superpowers/specs/2026-03-26-incremental-export-design.md`

---

### Task 1: `writeOutputFiles()` merge 로직 — 테스트

**Files:**
- Modify: `scripts/lib/index-builder.test.mjs`
- Reference: `scripts/lib/index-builder.mjs:113-136`

- [ ] **Step 1: Write failing tests for merge behavior**

```js
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

test("writeOutputFiles merges new entries into existing index", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-test-"));
  fs.mkdirSync(path.join(tmpDir, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "public", "data", "clips"), { recursive: true });

  // Seed existing index with 2 entries
  const existingIndex = {
    clips: [
      { id: "A", name: "Clip A", tags: ["old"], folders: [], star: 0, category: "uncategorized", width: 640, height: 360, duration: 1, previewUrl: "/previews/A.mp4", thumbnailUrl: "/thumbnails/A.webp", lqipBase64: "" },
      { id: "B", name: "Clip B", tags: ["old"], folders: [], star: 0, category: "uncategorized", width: 640, height: 360, duration: 1, previewUrl: "/previews/B.mp4", thumbnailUrl: "/thumbnails/B.webp", lqipBase64: "" },
    ],
    totalCount: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
  fs.writeFileSync(
    path.join(tmpDir, "src", "data", "index.json"),
    JSON.stringify(existingIndex)
  );

  // New batch: update B, add C
  const newClips = [
    { id: "B", relatedClips: [] },
    { id: "C", relatedClips: [] },
  ];
  const newIndexEntries = [
    { id: "B", name: "Clip B Updated", tags: ["new"], folders: [], star: 3, category: "uncategorized", width: 640, height: 360, duration: 1, previewUrl: "/previews/B.mp4", thumbnailUrl: "/thumbnails/B.webp", lqipBase64: "" },
    { id: "C", name: "Clip C", tags: ["new"], folders: [], star: 0, category: "uncategorized", width: 640, height: 360, duration: 2, previewUrl: "/previews/C.mp4", thumbnailUrl: "/thumbnails/C.webp", lqipBase64: "" },
  ];

  writeOutputFiles(newClips, newIndexEntries, tmpDir);

  const result = JSON.parse(fs.readFileSync(path.join(tmpDir, "src", "data", "index.json"), "utf-8"));
  assert.equal(result.totalCount, 3); // A + B(updated) + C
  assert.equal(result.clips.length, 3);

  const clipB = result.clips.find(c => c.id === "B");
  assert.equal(clipB.name, "Clip B Updated"); // upserted
  assert.equal(clipB.star, 3);

  const clipA = result.clips.find(c => c.id === "A");
  assert.equal(clipA.name, "Clip A"); // preserved

  fs.rmSync(tmpDir, { recursive: true });
});

test("writeOutputFiles works when no existing index exists", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-test-"));
  fs.mkdirSync(path.join(tmpDir, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "public", "data", "clips"), { recursive: true });

  const clips = [{ id: "X", relatedClips: [] }];
  const indexEntries = [
    { id: "X", name: "Clip X", tags: [], folders: [], star: 0, category: "uncategorized", width: 640, height: 360, duration: 1, previewUrl: "/previews/X.mp4", thumbnailUrl: "/thumbnails/X.webp", lqipBase64: "" },
  ];

  writeOutputFiles(clips, indexEntries, tmpDir);

  const result = JSON.parse(fs.readFileSync(path.join(tmpDir, "src", "data", "index.json"), "utf-8"));
  assert.equal(result.totalCount, 1);
  assert.equal(result.clips[0].id, "X");

  fs.rmSync(tmpDir, { recursive: true });
});

test("writeOutputFiles throws on corrupt existing index", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-test-"));
  fs.mkdirSync(path.join(tmpDir, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "public", "data", "clips"), { recursive: true });

  fs.writeFileSync(path.join(tmpDir, "src", "data", "index.json"), "NOT_JSON{{{");

  assert.throws(() => {
    writeOutputFiles([], [], tmpDir);
  });

  fs.rmSync(tmpDir, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/lib/index-builder.test.mjs`
Expected: FAIL — `writeOutputFiles` doesn't merge yet

- [ ] **Step 3: Commit failing tests**

```bash
git add scripts/lib/index-builder.test.mjs
git commit -m "test: add merge behavior tests for writeOutputFiles"
```

---

### Task 2: `writeOutputFiles()` merge 로직 — 구현

**Files:**
- Modify: `scripts/lib/index-builder.mjs:113-136`

- [ ] **Step 1: Implement merge logic**

`writeOutputFiles` 함수를 수정하여 기존 index.json을 읽고 merge:

```js
export function writeOutputFiles(clips, clipIndexEntries, outputDir) {
  fs.mkdirSync(path.join(outputDir, "src", "data", "clips"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "public", "data", "clips"), { recursive: true });

  // Write individual clip JSONs
  for (const clip of clips) {
    const clipPath = path.join(outputDir, "public", "data", "clips", `${clip.id}.json`);
    fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2));
  }

  // Merge with existing index
  const indexPath = path.join(outputDir, "src", "data", "index.json");
  let existingEntries = [];
  if (fs.existsSync(indexPath)) {
    const existing = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    existingEntries = existing.clips || [];
  }

  const merged = new Map(existingEntries.map(e => [e.id, e]));
  for (const entry of clipIndexEntries) {
    merged.set(entry.id, entry);
  }
  const mergedEntries = Array.from(merged.values());

  const indexData = {
    clips: mergedEntries,
    totalCount: mergedEntries.length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));

  console.log(`Wrote ${clips.length} clip JSONs + index.json (${mergedEntries.length} entries)`);
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `node --test scripts/lib/index-builder.test.mjs`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/index-builder.mjs
git commit -m "feat(export): merge new batch into existing index instead of replacing"
```

---

### Task 3: prune keepIds 변경 + related clips 전체 재계산

**Files:**
- Modify: `scripts/export.mjs:296-342` (main export loop 이후)

- [ ] **Step 1: Modify runExport() — related clips 재계산을 merge 후로 이동**

`export.mjs`에서 `computeRelatedClips` 호출을 `writeOutputFiles` 이후로 이동하고, merged 전체 대상으로 재계산. prune의 keepIds도 merged ID 사용.

기존 코드 (323-341줄):
```js
console.log("\n🔗 Computing related clips...");
const relatedMap = computeRelatedClips(clips);
for (const clip of clips) {
  clip.relatedClips = relatedMap.get(clip.id) || [];
}

console.log("\n💾 Writing output files...");
writeOutputFiles(clips, clipIndexEntries, projectRoot);

let pruneSummary = null;
if (flags.prune) {
  if (generationSummary.failed > 0) {
    console.warn("\n⚠️  Skipping prune because some items failed during export.");
  } else {
    pruneSummary = await prunePublishedArtifacts({
      keepIds: clipIds,
      projectRoot,
    });
  }
}
```

변경 후:
```js
// Step 1: Write output files (merge with existing index)
console.log("\n💾 Writing output files...");
writeOutputFiles(clips, clipIndexEntries, projectRoot);

// Step 2-4: Recompute related clips for ALL merged clips
const indexPath = path.join(projectRoot, "src", "data", "index.json");
const mergedIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

console.log("\n🔗 Computing related clips for all clips...");
const allClips = [];
for (const entry of mergedIndex.clips) {
  const clipPath = path.join(projectRoot, "public", "data", "clips", `${entry.id}.json`);
  if (fs.existsSync(clipPath)) {
    allClips.push(JSON.parse(fs.readFileSync(clipPath, "utf-8")));
  } else {
    console.warn(`  ⚠️ Missing clip JSON for ${entry.id}, skipping related computation`);
  }
}

const relatedMap = computeRelatedClips(allClips);
for (const clip of allClips) {
  clip.relatedClips = relatedMap.get(clip.id) || [];
  const clipPath = path.join(projectRoot, "public", "data", "clips", `${clip.id}.json`);
  fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2));
}

// Prune using merged index IDs (not just batch IDs)
const mergedClipIds = mergedIndex.clips.map(c => c.id);
let pruneSummary = null;
if (flags.prune) {
  if (generationSummary.failed > 0) {
    console.warn("\n⚠️  Skipping prune because some items failed during export.");
  } else {
    pruneSummary = await prunePublishedArtifacts({
      keepIds: mergedClipIds,
      projectRoot,
    });
  }
}
```

- [ ] **Step 2: Fix dry-run path — use merged keepIds**

`export.mjs` dry-run 경로 (258-277줄 영역)에서도 merged keepIds를 사용:

```js
if (flags.dryRun) {
  logDryRunItems(items);
  const uploadSummary = flags.r2 ? await logDryRunUploads(items, projectRoot) : null;

  const indexPath = path.join(projectRoot, "src", "data", "index.json");
  let pruneSummary = null;
  if (flags.prune) {
    // Use merged keepIds for accurate dry-run preview
    const existingIndex = fs.existsSync(indexPath)
      ? JSON.parse(fs.readFileSync(indexPath, "utf-8"))
      : { clips: [] };
    const existingIds = existingIndex.clips.map(c => c.id);
    const batchIds = items.map(item => item.id);
    const mergedKeepIds = [...new Set([...existingIds, ...batchIds])];

    pruneSummary = await prunePublishedArtifacts({
      keepIds: mergedKeepIds,
      projectRoot,
      dryRun: true,
    });
    console.log(`\n🧹 Planned stale local removals: ${pruneSummary.planned}`);
  }

  console.log(`\nTotal: ${items.length} items would be processed`);
  return { dryRun: true, items: items.length, uploadSummary, pruneSummary };
}
```

- [ ] **Step 3: Run existing export tests**

Run: `node --test scripts/export.test.mjs`
Expected: PASS (existing tests should still pass)

- [ ] **Step 4: Commit**

```bash
git add scripts/export.mjs
git commit -m "feat(export): use merged index for related clips and prune keepIds"
```

---

### Task 4: `package.json` 스크립트 변경

**Files:**
- Modify: `package.json:12-14`

- [ ] **Step 1: Update npm scripts**

```json
"export:batch": "node scripts/export.mjs",
"export:batch:dry": "node scripts/export.mjs --dry-run",
"export:batch:r2": "node scripts/export.mjs --r2",
"export:prune": "node scripts/export.mjs --prune",
"export:prune:dry": "node scripts/export.mjs --prune --dry-run",
```

기존 `export:full`, `export:local`, `export:r2` 스크립트는 변경 없이 유지한다.

**참고:** related clips 재계산으로 갱신된 기존 클립 JSON은 R2에 자동 업로드되지 않는다. R2에 반영하려면 해당 ID를 배치에 포함하여 `export:batch:r2`를 실행해야 한다.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore(export): remove --prune from default batch, add separate prune commands"
```

---

### Task 5: CLAUDE.md 업데이트

**Files:**
- Modify: `CLAUDE.md` (Commands 섹션)

- [ ] **Step 1: Update export commands documentation**

Commands 섹션의 export 관련 주석 업데이트:

```bash
# Export pipeline (Eagle → local JSON/media → optional R2 upload)
npm run export:batch           # Export active release batch, merge into existing index
npm run export:batch:dry       # Preview without writing
npm run export:batch:r2        # Export + upload to R2
npm run export:prune           # Remove stale local artifacts not in merged index
npm run export:prune:dry       # Preview prune without deleting
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update export commands for incremental merge mode"
```

---

### Task 6: TODOS.md 정리

**Files:**
- Modify: `TODOS.md`

- [ ] **Step 1: Remove the incremental export TODO (now implemented)**

증분 export 이슈가 해결되었으므로 TODOS.md에서 해당 항목을 삭제.

- [ ] **Step 2: Commit**

```bash
git add TODOS.md
git commit -m "chore: remove completed incremental export TODO"
```
