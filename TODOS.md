# TODOS

## Export Pipeline: 증분 모드 지원

**What:** `npm run export:batch`에 증분(incremental) export 모드를 추가하여, 기존에 export된 클립을 유지하면서 새 배치만 추가/업데이트하는 기능.

**Why:** 현재 `--prune` 플래그가 기본 활성화되어 있어, batch export 시 이전에 export된 파일을 삭제합니다. 10K 클립을 1,000개씩 나눠 export하면 두 번째 배치에서 첫 번째 배치의 파일이 삭제됩니다. 이것은 10K 클립 도달의 전제 조건(증분 배치 처리)과 모순됩니다.

**Pros:**
- 10K 클립까지 점진적 확장 가능
- 배치 크기에 제약 없이 export 가능
- 기존 데이터 보존

**Cons:**
- export 스크립트의 prune 로직 수정 필요
- index.json을 merge하는 로직 필요 (기존 index + 새 배치 merge)
- 삭제된 클립 정리를 위한 별도 prune 명령 필요

**Context:**
- `scripts/export.mjs:330` — `writeOutputFiles`가 전체 index를 덮어씀
- `scripts/export.mjs:337` — `prunePublishedArtifacts`가 keepIds에 없는 파일 삭제
- `package.json:12` — `export:batch` 스크립트 정의
- 해결 방법: `--append` 플래그를 추가하여, 기존 index.json을 읽고 새 배치를 merge한 후 작성. prune은 `--prune` 명시 시에만 실행.

**Depends on / blocked by:** 없음. 10K 스케일링 작업 전에 해결 필요.

**Source:** Codex eng review outside voice (2026-03-26)
