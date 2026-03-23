# Eagle Phase 2 Name/Tag/Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe two-stage Eagle cleanup tool that reviews name fixes for uncategorized mp4 items, then applies approved renames, name-derived tag sync, and rule-based multi-folder assignment.

**Architecture:** Extend the existing Eagle script tooling with one new phase2 library module, one CLI entrypoint, one folder-rule config, and one dedicated test file. The workflow is split into `review` and `apply` modes so risky name edits stay human-approved while tags and folders become deterministic post-approval. Folder writes will use only the folder IDs explicitly returned by the rule table; ancestor IDs are not auto-added.

**Tech Stack:** Node.js ESM scripts, `node:test`, Eagle `metadata.json` files, existing `scripts/lib/eagle-reader.mjs`, existing `src/data/categories.json`

**Spec:** `/Users/macbook/reflix-nextjs/docs/superpowers/specs/2026-03-23-eagle-phase2-name-tag-folder-design.md`

---

## Task Overview

| # | Task | 설명 |
|---|------|------|
| 1 | CLI and artifact contract | 명령 구조, JSON 포맷, package script 고정 |
| 2 | Review-stage core logic | 대상 수집, 이름 후보 추출, 검토 산출물 생성 |
| 3 | Apply-stage mutation logic | 승인 이름 반영, 태그 동기화, 폴더 계산 |
| 4 | Disk writes, backups, and CLI wiring | metadata.json 백업/쓰기, review/apply 실행 경로 연결 |
| 5 | Verification and operator runbook | 테스트, 실 라이브러리 dry run, 운영 명령 정리 |

## File Structure

```
scripts/
├── eagle-phase2.mjs                          ← review/apply CLI 진입점
├── config/
│   └── eagle-phase2-folder-rules.json        ← token → folderIds 규칙표
└── lib/
    ├── eagle-reader.mjs                      ← Eagle metadata reader, artifact-facing metadataPath 추가
    ├── eagle-phase2.mjs                      ← phase2 순수 로직 + 디스크 orchestration
    └── eagle-phase2.test.mjs                 ← phase2 단위/통합 테스트

docs/superpowers/plans/
└── 2026-03-23-eagle-phase2-name-tag-folder-implementation.md

.tmp/
├── eagle-phase2/<timestamp>/                 ← review/apply 산출물
└── eagle-phase2-backups/<timestamp>/         ← metadata.json 백업
```

## Fixed Data Contracts

### `scripts/config/eagle-phase2-folder-rules.json`

Use a stable object-based lookup so rule evaluation stays O(1) and easy to diff.

```json
{
  "ignoredTokens": ["게임", "연출", "전투", "레이아웃"],
  "rules": {
    "승리": {
      "folderIds": ["LE51CIF3FN5KM"],
      "note": "game-direction victory leaf"
    },
    "마법사": {
      "folderIds": ["L951YJXMX9H86"],
      "note": "maps caster clips into the magic weapon leaf"
    }
  }
}
```

### `name-review.json`

```json
{
  "libraryPath": "/abs/path/to/library",
  "generatedAt": "2026-03-23T15:00:00.000Z",
  "summary": {
    "targetCount": 874,
    "candidateCount": 8
  },
  "entries": [
    {
      "id": "ABC123",
      "currentName": "게임 스타세일러 여자 승리 (2)",
      "proposedName": "게임 스타세일러 여자 승리",
      "reason": "parenthesized sequence suffix",
      "confidence": 0.94,
      "approved": false
    }
  ]
}
```

### `target-snapshot.json`

```json
{
  "libraryPath": "/abs/path/to/library",
  "generatedAt": "2026-03-23T15:00:00.000Z",
  "summary": {
    "targetCount": 874
  },
  "entries": [
    {
      "id": "ABC123",
      "name": "게임 스타세일러 여자 승리 (2)",
      "tags": ["게임", "스타세일러", "여자", "승리", "(2)"],
      "folders": [],
      "metadataPath": "/abs/path/to/ABC123.info/metadata.json"
    }
  ]
}
```

### `folder-rule-report.json`

```json
{
  "libraryPath": "/abs/path/to/library",
  "generatedAt": "2026-03-23T15:00:00.000Z",
  "summary": {
    "targetCount": 874,
    "matchedAtLeastOneFolder": 652,
    "unmatchedItemCount": 222
  },
  "entries": [
    {
      "id": "ABC123",
      "tokens": ["게임", "스타세일러", "여자", "승리"],
      "matchedTokens": ["스타세일러", "승리"],
      "appliedFolderIds": ["AAA111", "BBB222"],
      "unresolvedTokens": ["게임", "여자"]
    }
  ]
}
```

### `apply-report.json`

```json
{
  "libraryPath": "/abs/path/to/library",
  "reviewFile": "/abs/path/to/name-review.json",
  "startedAt": "2026-03-23T15:10:00.000Z",
  "finishedAt": "2026-03-23T15:11:40.000Z",
  "summary": {
    "processed": 874,
    "renamed": 5,
    "tagSynced": 874,
    "folderAssigned": 652,
    "lossyTagSync": 0,
    "failed": 0,
    "stillWithoutFolders": 222
  },
  "entries": [
    {
      "id": "ABC123",
      "metadataPath": "/abs/path/to/ABC123.info/metadata.json",
      "backupPath": "/abs/path/to/.tmp/eagle-phase2-backups/<ts>/ABC123.metadata.json",
      "rename": {
        "before": "게임 스타세일러 여자 승리 (2)",
        "after": "게임 스타세일러 여자 승리",
        "applied": true
      },
      "tags": {
        "before": ["게임", "스타세일러", "여자", "승리", "(2)"],
        "after": ["게임", "스타세일러", "여자", "승리"],
        "excludedNumericTokens": ["(2)"],
        "lossy": false
      },
      "folders": {
        "before": [],
        "matchedTokens": ["스타세일러", "승리"],
        "appliedFolderIds": ["AAA111", "BBB222"],
        "unresolvedTokens": ["게임", "여자"]
      },
      "status": "success"
    }
  ]
}
```

## Task 1: CLI and Artifact Contract

**Files:**
- Create: `/Users/macbook/reflix-nextjs/scripts/config/eagle-phase2-folder-rules.json`
- Modify: `/Users/macbook/reflix-nextjs/package.json`
- Create: `/Users/macbook/reflix-nextjs/scripts/eagle-phase2.mjs`

- [ ] **Step 1: Write the failing CLI contract test**

Add a new test block in `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs` that asserts:
- `review` mode writes `name-review.json`
- `review` mode writes `target-snapshot.json`
- `review` mode writes `folder-rule-report.json`
- `apply` mode requires `--review-file`
- `--help` prints usage and exits without reading the library
- the default artifact directories are `.tmp/eagle-phase2/<timestamp>/` and `.tmp/eagle-phase2-backups/<timestamp>/`

```js
test("parsePhase2CliArgs requires a review file for apply mode", () => {
  assert.throws(() => parsePhase2CliArgs(["apply"]), /--review-file/);
});

test("parsePhase2CliArgs returns help mode without side effects", () => {
  const result = parsePhase2CliArgs(["--help"]);
  assert.equal(result.mode, "help");
});
```

- [ ] **Step 2: Run the single test to confirm failure**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "parsePhase2CliArgs"`

Expected: FAIL with missing import or missing function.

- [ ] **Step 3: Create the rule file and CLI parser**

Create `/Users/macbook/reflix-nextjs/scripts/config/eagle-phase2-folder-rules.json` with:
- `ignoredTokens`
- a non-empty `rules` object populated from the current taxonomy and known high-frequency target tokens

Minimum initial rule coverage:
- work/world tokens: `원신`, `명조`, `스타세일러`, `갓오브워`, `아케인`, `젠레스존제로`
- class/weapon tokens: `마법사`, `검`, `둔기`, `활`, `총`
- action/state tokens: `등장`, `승리`, `선택`, `점프`, `착지`, `시전`, `밀치기`

Rule-population method:
- read `/Users/macbook/reflix-nextjs/src/data/categories.json`
- map exact category labels and approved synonyms to folder IDs
- include only specific tokens with clear folder intent
- exclude generic tokens such as `게임`, `연출`, `전투`, `레이아웃`
- commit an initial rule set large enough that review-mode `folder-rule-report.json` resolves a non-trivial subset of the `874` targets

Create `/Users/macbook/reflix-nextjs/scripts/eagle-phase2.mjs` with a parser that supports:
- `review`
- `apply --review-file <path>`
- `--help`
- optional `--library <path>`
- optional `--timestamp <value>`

Help contract:
- `node scripts/eagle-phase2.mjs --help` prints usage
- exits with code `0`
- does not read the Eagle library
- does not create `.tmp/` artifacts

Add package scripts:

```json
{
  "scripts": {
    "eagle:phase2:review": "node scripts/eagle-phase2.mjs review",
    "eagle:phase2:apply": "node scripts/eagle-phase2.mjs apply"
  }
}
```

- [ ] **Step 4: Run the CLI contract test again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "parsePhase2CliArgs"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/macbook/reflix-nextjs add package.json scripts/eagle-phase2.mjs scripts/config/eagle-phase2-folder-rules.json scripts/lib/eagle-phase2.test.mjs
git -C /Users/macbook/reflix-nextjs commit -m "feat: scaffold eagle phase2 cli contract"
```

## Task 2: Review-Stage Core Logic

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-reader.mjs`
- Create: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs`

- [ ] **Step 1: Write failing tests for target filtering, tokenization, and candidate extraction**

Add tests for:
- collecting only `ext === "mp4"` items with empty `folders`
- preserving `33원정대`, `2d`, `pov`, `pv`, `오브`, `손`, `발`
- flagging `(2)` and repeated words as review candidates
- flagging series-consistency outliers inside a shared prefix group
- flagging rare-token near-matches against more common sibling tokens
- emitting `name-review.json` with `approved: false`
- emitting `target-snapshot.json` with current name, tags, folders, and metadataPath
- emitting `folder-rule-report.json` with matched/unresolved token breakdown

```js
test("collectPhase2Targets keeps only uncategorized mp4 items", () => {
  const targets = collectPhase2Targets([
    { id: "A", ext: "mp4", folders: [], isDeleted: false },
    { id: "B", ext: "jpg", folders: [], isDeleted: false },
    { id: "C", ext: "mp4", folders: ["X"], isDeleted: false },
  ]);
  assert.deepEqual(targets.map((item) => item.id), ["A"]);
});

test("buildNameReviewEntries emits parenthesized suffix candidates", () => {
  const entries = buildNameReviewEntries([
    { id: "A", name: "게임 스타세일러 여자 승리 (2)" }
  ]);
  assert.equal(entries[0].proposedName, "게임 스타세일러 여자 승리");
  assert.equal(entries[0].approved, false);
});

test("buildNameReviewEntries flags rare token near-match outliers", () => {
  const entries = buildNameReviewEntries([
    { id: "A", name: "게임 스타세일러 마법사 승리" },
    { id: "B", name: "게임 스타세일러 마법사 승리" },
    { id: "C", name: "게임 스타세일러 마볍사 승리" }
  ]);
  assert.equal(entries.some((entry) => entry.id === "C"), true);
});
```

- [ ] **Step 2: Run the review-stage tests to verify failure**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "collectPhase2Targets|buildNameReviewEntries"`

Expected: FAIL with missing functions.

- [ ] **Step 3: Extend the Eagle reader with metadata paths**

Update `/Users/macbook/reflix-nextjs/scripts/lib/eagle-reader.mjs` so each item includes:

```js
{
  metadataPath
}
```

Do not change the existing thumbnail pilot behavior.

- [ ] **Step 4: Implement the review-stage pure functions**

In `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs`, add:
- `collectPhase2Targets(items)`
- `tokenizeName(name)`
- `normalizeReviewProposal(name)`
- `buildNameReviewEntries(items, options)`
- `createNameReviewArtifact({ libraryPath, entries, targetCount, outputDir })`

Implementation rules:
- candidates come only from the spec’s suspicious-name heuristics
- no Eagle writes in review mode
- `name-review.json` must match the contract above exactly
- `target-snapshot.json` and `folder-rule-report.json` must be written in the same output directory
- `name-review.md` must be deterministic: sort by descending confidence, then `id`, and render columns `id | currentName | proposedName | reason | confidence | approved`

Heuristic thresholds to implement:
- series-consistency: within the same two-token prefix group, flag a token variant when a near-match sibling appears at least `3` times more often and Levenshtein distance is `<= 2`
- rare-token outlier: flag a token with frequency `1` when another token with frequency `>= 3` exists at Levenshtein distance `1` for token length `<= 4`, or `<= 2` for token length `>= 5`
- keep the explicit allowlist from the spec out of typo proposals

- [ ] **Step 5: Run the review-stage tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "collectPhase2Targets|buildNameReviewEntries"`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/macbook/reflix-nextjs add scripts/lib/eagle-reader.mjs scripts/lib/eagle-phase2.mjs scripts/lib/eagle-phase2.test.mjs
git -C /Users/macbook/reflix-nextjs commit -m "feat: add eagle phase2 review logic"
```

## Task 3: Apply-Stage Mutation Logic

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs`
- Read: `/Users/macbook/reflix-nextjs/src/data/categories.json`

- [ ] **Step 1: Write failing tests for name apply, tag sync, and folder resolution**

Add tests for:
- applying approved renames only
- excluding numeric tokens and parenthesized numeric tokens from tags
- keeping `33원정대`, `2d`, `pov`, `pv`, `오브`, `손`, `발`
- resolving folders from rule file without auto-adding ancestor IDs
- tracking unresolved tokens and `lossyTagSync`

```js
test("syncTagsFromName excludes numeric-only tokens", () => {
  const result = syncTagsFromName("게임 스타세일러 스킬 2 (2)");
  assert.deepEqual(result.tags, ["게임", "스타세일러", "스킬"]);
  assert.deepEqual(result.excludedNumericTokens, ["2", "(2)"]);
});

test("resolveFolderIds returns only explicit rule ids", () => {
  const result = resolveFolderIds(["원신", "승리"], {
    ignoredTokens: ["게임"],
    rules: {
      "원신": { folderIds: ["AAA"] },
      "승리": { folderIds: ["BBB", "CCC"] }
    }
  });
  assert.deepEqual(result.folderIds, ["AAA", "BBB", "CCC"]);
});
```

- [ ] **Step 2: Run the apply-stage tests to verify failure**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "syncTagsFromName|resolveFolderIds|applyApprovedRenames"`

Expected: FAIL with missing functions.

- [ ] **Step 3: Implement pure mutation helpers**

In `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs`, add:
- `loadApprovedNameReview(reviewFilePath)`
- `applyApprovedRenames(item, approvedEntries)`
- `syncTagsFromName(name, options)`
- `resolveFolderIds(tokens, rulesConfig)`
- `buildApplyMutation(item, approvedEntries, rulesConfig)`

Important details:
- only `approved === true` entries may rename items
- folder writes use the exact `folderIds` from the rule config
- no ancestor folder inference
- preserve ordering by first token occurrence, then dedupe

- [ ] **Step 4: Run the apply-stage tests again**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "syncTagsFromName|resolveFolderIds|applyApprovedRenames"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/macbook/reflix-nextjs add scripts/lib/eagle-phase2.mjs scripts/lib/eagle-phase2.test.mjs
git -C /Users/macbook/reflix-nextjs commit -m "feat: add eagle phase2 apply logic"
```

## Task 4: Disk Writes, Backups, and CLI Wiring

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/eagle-phase2.mjs`
- Modify: `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs`

- [ ] **Step 1: Write failing integration tests for review/apply filesystem behavior**

Cover:
- `review` writes `name-review.md` and `name-review.json`
- `review` writes `target-snapshot.json` and `folder-rule-report.json`
- `apply` backs up each `metadata.json` before write
- item write failure restores the original file
- `apply-report.json` includes summary counts and per-item status
- repeated write failures abort the run after a fixed threshold and leave prior backups intact

```js
test("runPhase2Apply backs up metadata before mutation", async () => {
  const result = await runPhase2Apply({...});
  assert.equal(fs.existsSync(result.entries[0].backupPath), true);
  assert.equal(result.entries[0].status, "success");
});
```

- [ ] **Step 2: Run the integration tests to verify failure**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs --test-name-pattern "runPhase2Review|runPhase2Apply"`

Expected: FAIL with missing orchestration functions.

- [ ] **Step 3: Implement review/apply orchestration**

In `/Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.mjs`, add:
- `runPhase2Review(options)`
- `runPhase2Apply(options)`
- `writeMetadataWithBackup(entry, mutation, backupDir)`
- `writeApplyReport(outputPath, report)`

Abort policy:
- maintain a consecutive failure counter during apply
- restore the current item immediately on every failure
- abort the entire run after `3` consecutive item failures
- write `apply-report.json` even on abort
- keep all created backups so manual rollback remains possible
- before apply work starts, verify the loaded `name-review.json` `libraryPath` matches the target library path and abort early if it does not

In `/Users/macbook/reflix-nextjs/scripts/eagle-phase2.mjs`, wire:
- default library path to the Desktop game/direction library
- `EAGLE_LIBRARY_PATH` override
- console summary for review/apply

Console contract:

```txt
📂 Eagle Library: /abs/path
📝 Mode: review
🧾 name-review.json: /abs/path/.tmp/eagle-phase2/<ts>/name-review.json
```

and

```txt
📂 Eagle Library: /abs/path
✍️ Mode: apply
🧾 apply-report.json: /abs/path/.tmp/eagle-phase2/<ts>/apply-report.json
```

- [ ] **Step 4: Run the full phase2 test file**

Run: `node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/macbook/reflix-nextjs add scripts/eagle-phase2.mjs scripts/lib/eagle-phase2.mjs scripts/lib/eagle-phase2.test.mjs
git -C /Users/macbook/reflix-nextjs commit -m "feat: wire eagle phase2 review and apply flow"
```

## Task 5: Verification and Operator Runbook

**Files:**
- Modify: `/Users/macbook/reflix-nextjs/AGENTS.md`
- Modify: `/Users/macbook/reflix-nextjs/package.json`
- Read: `/Users/macbook/reflix-nextjs/docs/superpowers/specs/2026-03-23-eagle-phase2-name-tag-folder-design.md`

- [ ] **Step 1: Add the operator shortcut instructions**

Append to `/Users/macbook/reflix-nextjs/AGENTS.md` a short `Eagle Phase 2 Ops` section:

```md
## Eagle Phase 2 Ops

- Use `npm run eagle:phase2:review` to generate name review artifacts for uncategorized mp4 items.
- Review and edit the generated `name-review.json`, marking approved entries with `"approved": true`.
- Use `npm run eagle:phase2:apply -- --review-file <absolute-path>` to apply approved renames, tag sync, and folder assignment.
- Tags exclude numeric-only tokens such as `2`, `3`, `(2)`.
- Folder writes use only folder IDs explicitly listed in `scripts/config/eagle-phase2-folder-rules.json`.
```

- [ ] **Step 2: Verify package scripts and tests**

Run:

```bash
node --test /Users/macbook/reflix-nextjs/scripts/lib/eagle-phase2.test.mjs
npm --prefix /Users/macbook/reflix-nextjs run eagle:phase2:review -- --help
```

Expected:
- tests PASS
- CLI prints usage or mode help without modifying the library

- [ ] **Step 3: Run a real review pass on the Desktop library**

Run:

```bash
EAGLE_LIBRARY_PATH="/Users/macbook/Desktop/라이브러리/레퍼런스 - 게임,연출.library" \
node /Users/macbook/reflix-nextjs/scripts/eagle-phase2.mjs review
```

Expected:
- `.tmp/eagle-phase2/<timestamp>/name-review.md`
- `.tmp/eagle-phase2/<timestamp>/name-review.json`
- `.tmp/eagle-phase2/<timestamp>/target-snapshot.json`
- `.tmp/eagle-phase2/<timestamp>/folder-rule-report.json`

No `metadata.json` files should change.

- [ ] **Step 4: Sanity-check the review artifact**

Inspect:
- candidate count is non-zero and plausible
- obvious `(2)` items appear
- `approved` defaults to `false`

Command:

```bash
node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));console.log(j.summary, j.entries.slice(0,5));" /absolute/path/to/name-review.json
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/macbook/reflix-nextjs add AGENTS.md package.json scripts/eagle-phase2.mjs scripts/lib/eagle-phase2.mjs scripts/lib/eagle-phase2.test.mjs scripts/config/eagle-phase2-folder-rules.json
git -C /Users/macbook/reflix-nextjs commit -m "docs: add eagle phase2 operator workflow"
```

## Notes for Implementers

- Reuse the style of `/Users/macbook/reflix-nextjs/scripts/lib/eagle-thumbnail-pilot.mjs` and `/Users/macbook/reflix-nextjs/scripts/lib/eagle-thumbnail-pilot.test.mjs`.
- Do not touch web runtime files. This plan is script-only.
- Keep review-stage functions pure until the orchestration task.
- Do not auto-approve name fixes.
- Do not auto-add ancestor folder IDs. If a parent folder should be written, include it directly in `eagle-phase2-folder-rules.json`.
