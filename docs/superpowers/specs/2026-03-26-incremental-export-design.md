# Incremental Export Design

## Problem

현재 export 파이프라인은 교체(replacement) 방식으로 동작한다. `export:batch`를 실행하면 배치에 포함된 ID만으로 index.json을 덮어쓰고, `--prune` 플래그(기본 활성화)가 배치 외의 미디어 파일을 삭제한다. 이 때문에 10K 클립을 500-1000개씩 점진적으로 export할 수 없다 — 두 번째 배치에서 첫 번째 배치의 결과가 사라진다.

## Solution: Merge 모드

`writeOutputFiles()`가 기존 index.json을 읽고 새 배치 결과를 merge(upsert)한 후 저장하도록 변경한다.

```
배치 export 흐름 (변경 후)
═════════════════════════════════

[release-batch.json]
      │
      ▼
[Eagle Library 읽기] ── 배치 ID만
      │
      ▼
[FFmpeg 미디어 생성] ── skip-existing 유지
      │
      ▼
[buildClipIndex / buildFullClip]
      │
      ▼
[기존 index.json 읽기] ── 없으면 빈 배열
      │
      ▼
[Map<id, ClipIndex> 변환]
      │
      ▼
[새 배치 결과로 upsert] ── ID 같으면 덮어쓰기, 없으면 추가
      │
      ▼
[전체 clip JSON 로드] ── public/data/clips/{id}.json
      │
      ▼
[computeRelatedClips] ── merged 전체 대상
      │
      ▼
[개별 clip JSON 갱신] ── relatedClips 업데이트
      │
      ▼
[merged index.json 저장]
      │
      ▼
[--prune 명시 시만] ── keepIds = merged index 전체 ID
```

## 변경 사항

### 1. `writeOutputFiles()` merge 로직 추가 (`scripts/lib/index-builder.mjs`)

**현재:** `clipIndexEntries` 배열을 그대로 index.json에 저장.
**변경:** 기존 index.json을 읽고, `Map<id, entry>`로 변환 후, 새 배치 결과를 upsert.

```js
export function writeOutputFiles(clips, clipIndexEntries, outputDir) {
  const indexPath = path.join(outputDir, "src", "data", "index.json");

  // Read existing index if present
  let existingEntries = [];
  if (fs.existsSync(indexPath)) {
    const existing = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    existingEntries = existing.clips || [];
  }

  // Merge: existing + new (new overwrites existing by ID)
  const merged = new Map(existingEntries.map(e => [e.id, e]));
  for (const entry of clipIndexEntries) {
    merged.set(entry.id, entry);
  }
  const mergedEntries = Array.from(merged.values());

  // Write
  const indexData = {
    clips: mergedEntries,
    totalCount: mergedEntries.length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
}
```

개별 clip JSON은 이미 파일 단위로 덮어쓰므로 변경 불필요.

### 2. `--prune` 기본 제거 (`package.json`)

**현재:**
```json
"export:batch":    "node scripts/export.mjs --prune",
"export:batch:r2": "node scripts/export.mjs --prune --r2"
```

**변경:**
```json
"export:batch":     "node scripts/export.mjs",
"export:batch:r2":  "node scripts/export.mjs --r2",
"export:prune":     "node scripts/export.mjs --prune",
"export:prune:dry": "node scripts/export.mjs --prune --dry-run"
```

`export:batch`와 `export:batch:r2` 모두에서 `--prune`을 제거한다. 별도 `export:prune` (실행)과 `export:prune:dry` (미리보기) 명령을 추가한다.

**참고:** `export:prune`은 내부적으로 Eagle library를 읽고 배치를 처리한 뒤 prune을 실행한다. prune만 단독 실행하는 경로는 현재 아키텍처에 없으며, 이 제약은 의도적이다 — prune은 항상 최신 배치 처리 결과와 함께 실행되어야 정확한 keepIds를 보장한다.

### 3. prune의 keepIds 변경 (`scripts/export.mjs`)

**현재:** `keepIds: clipIds` (현재 배치 ID만)
**변경:** `keepIds: mergedClipIds` (merged index 전체 ID)

#### 실행 경로 (non-dry-run)

`runExport()`에서 `writeOutputFiles()` 호출 후, merged index의 전체 ID를 prune에 전달:

```js
// After writeOutputFiles — merged index를 다시 읽어서 전체 ID 추출
const indexPath = path.join(projectRoot, "src", "data", "index.json");
const mergedIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
const mergedClipIds = mergedIndex.clips.map(c => c.id);

if (flags.prune) {
  // 기존 failed guard 유지 (보수적 선택 — merge 모드에서도 동일)
  if (generationSummary.failed > 0) {
    console.warn("\n⚠️  Skipping prune because some items failed during export.");
  } else {
    pruneSummary = await prunePublishedArtifacts({
      keepIds: mergedClipIds,  // ← 변경: 배치 ID가 아닌 전체 merged ID
      projectRoot,
    });
  }
}
```

#### dry-run 경로

dry-run에서도 동일하게 기존 index.json을 읽어 합집합을 구성해야 한다. dry-run은 파일을 쓰지 않으므로, merge를 메모리에서만 수행:

```js
// dry-run 경로 (export.mjs 258-277줄 영역)
if (flags.dryRun) {
  logDryRunItems(items);

  if (flags.prune) {
    // dry-run에서도 merged keepIds 사용
    const existingIndex = fs.existsSync(indexPath)
      ? JSON.parse(fs.readFileSync(indexPath, "utf-8"))
      : { clips: [] };
    const existingIds = existingIndex.clips.map(c => c.id);
    const batchIds = items.map(item => item.id);
    const mergedKeepIds = [...new Set([...existingIds, ...batchIds])];

    const pruneSummary = await prunePublishedArtifacts({
      keepIds: mergedKeepIds,
      projectRoot,
      dryRun: true,
    });
    console.log(`\n🧹 Planned stale local removals: ${pruneSummary.planned}`);
  }
  ...
}
```

### 4. Related clips 전체 재계산 (`scripts/export.mjs`)

#### 실행 순서 (중요)

이 코드는 반드시 `writeOutputFiles()` 호출 **이후**에 실행해야 한다. `writeOutputFiles()`가 새 배치의 개별 clip JSON을 `public/data/clips/{id}.json`에 먼저 써야 이 단계에서 읽을 수 있다.

```
실행 순서:
  Step 1: writeOutputFiles() — merged index + 개별 clip JSON 쓰기
  Step 2: 전체 clip JSON 로드 (기존 + 신규 모두 읽기 가능)
  Step 3: computeRelatedClips() — merged 전체 대상
  Step 4: 개별 clip JSON 재쓰기 (relatedClips 필드만 갱신)
```

개별 clip JSON이 두 번 쓰이는 것은 의도적이다 — Step 1에서 기본 데이터를 쓰고, Step 4에서 relatedClips만 갱신한다.

```js
// Step 2-4: writeOutputFiles() 호출 이후에 실행
const mergedIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
const allClips = [];
for (const entry of mergedIndex.clips) {
  const clipPath = path.join(projectRoot, "public", "data", "clips", `${entry.id}.json`);
  if (fs.existsSync(clipPath)) {
    allClips.push(JSON.parse(fs.readFileSync(clipPath, "utf-8")));
  }
}

const relatedMap = computeRelatedClips(allClips);
for (const clip of allClips) {
  clip.relatedClips = relatedMap.get(clip.id) || [];
  const clipPath = path.join(projectRoot, "public", "data", "clips", `${clip.id}.json`);
  fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2));
}
```

### 5. 변경 감지는 기존 구조로 충분

`materializeClipAssets()`는 이미 파일 존재 여부로 skip합니다 (187-213줄). 메타데이터 변경(태그, 이름)은 `buildClipIndex()`/`buildFullClip()`에서 Eagle의 최신 값을 사용하므로 자동으로 반영됩니다. 미디어 재생성이 필요한 경우(영상 교체 등)는 기존 미디어 파일을 수동 삭제 후 재export하면 됩니다.

## 변경하지 않는 것

- `published-state.json` — 현재 구조 유지. export 후 기록하는 로직 변경 없음.
- `release-batch.json` — 여전히 현재 배치의 ID 목록을 관리.
- `materializeClipAssets()` — skip-existing 로직 유지.
- `resolveRequestedClipIds()` — 배치 해석 로직 변경 없음.
- R2 업로드 로직 — 변경 없음.

## 영향받는 파일

| 파일 | 변경 |
|------|------|
| `scripts/lib/index-builder.mjs` | `writeOutputFiles()` merge 로직 추가 |
| `scripts/export.mjs` | prune keepIds를 merged ID로 변경, related clips 전체 재계산 |
| `package.json` | `export:batch`에서 `--prune` 제거, `export:prune` 추가 |

## 테스트

### Happy path
- `writeOutputFiles` merge: 기존 index 3개 + 새 배치 2개 (1개 겹침) → 결과 4개
- `writeOutputFiles` merge: 기존 index 없음 → 현재와 동일하게 동작
- prune: merged index 기준으로 keepIds 확인 (기존+신규 모두 보존)
- related clips: merged 전체 대상으로 재계산 확인

### Edge cases
- 기존 index.json이 corrupt/invalid JSON → 에러 throw (새로 생성하려면 수동으로 파일 삭제)
- merged index에는 있지만 `public/data/clips/{id}.json`이 없는 clip → related 계산에서 skip, 경고 로그 출력
- dry-run에서 prune 시 merged keepIds가 실행 경로와 동일한 결과를 보여주는지 검증
