# Phase 2 Approval and Publish Design

## 문서 목적

이 문서는 Reflix Phase 2를 `자동 선정 + 최종 승인 1회` 구조로 전환하기 위한 설계를 정리한다.

목표는 아래 세 가지를 동시에 만족하는 것이다.

- 시스템이 Eagle 아이템 중 게시 후보를 자동으로 고른다.
- 사람은 Eagle 안에서 review 이후 최종 승인만 한다.
- 실제 게시 성공 여부는 시스템 기록과 Eagle 운영 태그가 함께 추적한다.

이 문서는 운영 절차 전체를 다시 설명하는 문서가 아니다. 기존 [Phase 2 운영 문서](./phase-2-release-workflow.md)가 “어떤 순서로 배포하는가”를 설명한다면, 이 문서는 “승인과 게시 상태를 어떤 구조로 자동화할 것인가”를 설명한다. review 단계 자체의 상세 설계는 [Phase 2 Review Design](./phase-2-review-design.md)에서 다룬다.

## 구현 결정

이 설계의 구현은 아래 결정으로 고정한다.

- [`config/release-batch.json`](/Users/macbook/reflix-nextjs/config/release-batch.json)은 authoritative active batch다.
- [`config/published-state.json`](/Users/macbook/reflix-nextjs/config/published-state.json)은 durable publish history다.
- 제안 산출물과 리포트는 모두 `.tmp/release-approval/<timestamp>/...` 아래에 생성한다.
- 운영 흐름은 `release:scan -> release:review -> Eagle review -> release:approve -> export:batch:dry -> export:batch -> release:mark-published / release:mark-failed`다.
- `release:approve`는 게시를 수행하지 않고, 승인된 제안을 active batch로 승격만 한다.
- 기본 `release:scan`은 active batch 범위만 스캔하고, 전체 eligible 라이브러리 후보를 보고 싶을 때만 명시적인 `--all` 또는 `release:scan:all`을 사용한다.
- `export:batch`는 stage 기반 resumable export다. 내부적으로 `discover -> process-media -> build-artifacts -> compute-related -> finalize`를 거치며, 필요할 때만 `upload`와 `prune`을 추가 실행한다.

## 문제 정의

현재 구조의 핵심은 사람이 직접 배치 범위를 기억해서 정리하려는 습관이다. 이 방식은 작은 MVP 배치에서는 안전하지만, 아이템 수가 늘어날수록 아래 문제가 생긴다.

- 사람이 매번 어떤 아이템을 배치에 넣을지 직접 기억하고 정리해야 한다.
- 이미 게시한 아이템과 아직 게시하지 않은 아이템을 수동으로 구분해야 한다.
- Eagle 안에서 승인 상태와 실제 게시 성공 상태를 한눈에 보기 어렵다.
- 배포 대상 선정과 실제 게시 결과를 같은 파일 하나로 설명하기 어렵다.

따라서 Phase 2는 아래 구조로 바뀌어야 한다.

- 시스템이 게시 후보를 자동 선정한다.
- 사람은 Eagle에서 승인 또는 보류만 한다.
- 실제 게시 성공 상태는 별도 시스템 기록으로 보장한다.

## 핵심 원칙

### 1. 승인 상태와 게시 상태는 다르다

`승인됨`은 사람이 “올려도 된다”고 판단한 상태다. `게시됨`은 실제 export / upload / deploy / 검증까지 성공한 상태다. export는 이제 명시적 run state와 checkpoint를 가지므로, 중간 실패 후 재개와 최종 성공 판정이 더 분리된다. 이 둘은 같은 뜻이 아니며, 같은 태그나 같은 파일로 합치면 안 된다.

### 2. Eagle은 사람이 상태를 확인하는 공간이다

사람은 Eagle에서 아이템을 보고 승인한다. 따라서 Eagle 안에서는 “이 아이템이 아직 검토 전인지, 승인됐는지, 게시에 성공했는지, 실패했는지”를 쉽게 구분할 수 있어야 한다.

### 3. 실제 게시 기록은 시스템 파일로 남긴다

Eagle 태그만으로는 실제 게시 성공 여부를 완전히 보장할 수 없다. 사람이 태그를 바꿀 수도 있고, 게시 도중 실패가 생길 수도 있다. 따라서 실제 게시 성공 여부와 마지막 게시 스냅샷은 별도 기록 파일로 남겨야 한다.

### 4. 자동 선정은 Phase 1 품질 상태를 전제로 한다

자동 선정은 Phase 1을 통과한 아이템만 대상으로 한다. 이름, 태그, 태그 그룹, 폴더, 썸네일이 정리되지 않은 아이템은 게시 후보가 될 수 없다.

### 5. 게시 범위는 항상 active batch로만 실행한다

시스템이 후보를 자동으로 계산하더라도, 실제 export는 항상 명시적인 active batch를 기준으로 실행해야 한다. 즉 자동 선정 결과와 실제 게시 입력은 분리되어야 한다.

## 역할 분리

### Eagle의 역할

Eagle은 사람이 실제 아이템을 보고 검토하는 공간이다.

- 사람이 아이템을 눈으로 확인한다.
- 사람이 승인 또는 보류를 태그로 표현한다.
- 게시 성공 또는 실패 상태도 Eagle 태그로 쉽게 구분한다.

즉 Eagle은 “운영자가 보는 상태판” 역할을 한다.

### 시스템 상태 파일의 역할

시스템 상태 파일은 기계가 게시 이력을 정확하게 판단하기 위한 기록이다.

- 마지막으로 언제 게시됐는지 기록한다.
- 게시 당시 어떤 이름/태그/폴더/mtime 상태였는지 기록한다.
- 다음 스캔에서 어떤 항목이 신규인지, 변경됐는지, 실패 재시도인지 계산한다.

즉 시스템 상태 파일은 “기계가 믿는 실제 게시 이력” 역할을 한다.

## 운영 태그 설계

승인/게시 단계에서 중심이 되는 운영 태그는 아래 네 개다.

- `reflix:approved`
- `reflix:published`
- `reflix:publish-failed`
- `reflix:hold`

일반 검색 태그와 운영 태그가 섞이지 않도록 반드시 `reflix:` prefix를 유지한다.

`reflix:review-requested`와 review 산출물 구조는 [Phase 2 Review Design](./phase-2-review-design.md)에서 별도로 정의한다.

### 태그 의미

#### `reflix:approved`

사람이 Eagle에서 보고 “이번에 게시해도 된다”고 승인한 상태다. 아직 실제 게시 성공은 의미하지 않는다.

#### `reflix:published`

실제 게시가 성공적으로 끝난 상태다. export, 필요한 업로드, production 반영, 검증까지 성공한 뒤에만 붙인다.

#### `reflix:publish-failed`

게시를 시도했지만 실패해 재검토가 필요한 상태다. 이후 재시도 후보를 쉽게 찾기 위해 유지한다.

#### `reflix:hold`

사람이 의도적으로 이번 배치에서 제외한 상태다. 자동 후보로 잡히더라도 최종 batch에는 포함되지 않는다.

### 태그 우선순위 원칙

- `reflix:hold`가 있으면 이번 배치에서는 제외한다.
- `reflix:approved`는 게시 전 승인 상태다.
- 게시 성공 후에는 `reflix:approved`보다 `reflix:published`가 더 높은 상태다.
- 게시 실패 후에는 `reflix:publish-failed`로 문제를 드러낸다.
- `reflix:review-requested`는 사람이 Eagle에서 아직 검토하지 않은 항목이라는 뜻이다.
- review suggestion은 deterministic metadata-based hint이며, Eagle의 이름과 content tag는 사람이 직접 편집한다.

## 파일 구조

### Active batch

- [`/Users/macbook/reflix-nextjs/config/release-batch.json`](/Users/macbook/reflix-nextjs/config/release-batch.json)

현재 실제 export가 읽는 authoritative active batch 파일이다. 로컬 생성, prune, 업로드, deploy는 이 파일 기준으로만 실행된다.

### Proposed batch

- `.tmp/release-approval/<timestamp>/release-batch.proposed.json`

시스템이 자동 선정한 승인 대기 배치다. 아직 실제 게시 입력은 아니며, 개별 실행마다 `.tmp/release-approval/<timestamp>/` 아래에 생성된다.

### Proposal report

- `.tmp/release-approval/<timestamp>/proposal-report.md`

사람이 읽는 승인 리포트다. 왜 이 아이템들이 후보로 잡혔는지 설명하고, Eagle에서 무엇을 확인해야 하는지 안내한다.

### Published state

- [`/Users/macbook/reflix-nextjs/config/published-state.json`](/Users/macbook/reflix-nextjs/config/published-state.json)

실제 게시 성공 이력을 기록하는 시스템 파일이다.

이 파일은 최소한 아래 정보를 유지한다.

- `id`
- `publishedAt`
- `batchName`
- `eagleMtime`
- `exportSignature`

## 자동 선정 규칙

자동 선정은 “승인할 가치가 있는 아이템 후보”를 계산하는 단계다. 아직 active batch를 바꾸지 않는다.

### 자동 후보 기본 조건

아래 조건을 모두 만족해야 자동 후보가 될 수 있다.

- Phase 1 종료 조건을 만족한다.
- `reflix:hold`가 없다.
- blocking 성격의 Phase 1 문제가 없다.
- Eagle item ID가 안정적으로 존재한다.

### 승인 가능 후보 조건

아래 조건을 만족하면 사람이 Eagle에서 승인 대상으로 볼 수 있다.

- 아직 게시 이력이 없는 신규 아이템
- 이미 게시됐지만 게시 이후 변경이 감지된 아이템
- 이전 게시가 실패해서 재시도해야 하는 아이템

### 자동 제외 조건

아래 경우는 자동 후보에서 제외한다.

- `reflix:hold`가 붙은 경우
- Phase 1 미완료 항목
- 중복 의심이나 수동 검토 필요 같은 blocking 상태가 남은 경우
- 게시와 무관한 운영 규칙이 아직 정리되지 않은 경우

## 변경 감지 규칙

이미 게시된 아이템도 변경되면 다시 게시 후보가 될 수 있다. 단, 단순한 파일 touched 수준이 아니라 실제 배포 결과가 바뀌는 경우만 재게시 후보로 잡아야 한다.

### 추천 방식

혼합형 비교를 사용한다.

1. `mtime`으로 1차 필터링
2. `exportSignature`로 실제 배포 영향 비교

### 재게시 후보로 보는 변경

아래 값이 바뀌면 재게시 후보가 될 수 있다.

- 이름
- 일반 콘텐츠 태그
- 폴더
- annotation
- star
- duration
- width / height
- 원본 media 파일 상태
- 원본 thumbnail 상태

### 재게시 판단에서 제외하는 것

운영 태그는 재게시 판단 기준에 포함하지 않는다.

- `reflix:approved`
- `reflix:published`
- `reflix:publish-failed`
- `reflix:hold`

즉 운영 태그 변경만으로는 재게시 후보가 되지 않는다. 재게시 판단은 콘텐츠와 배포 메타데이터 기준으로만 한다.

## 승인 절차

승인은 Eagle 안에서 한다. 별도의 승인 UI를 새로 만들지 않는다.

### 추천 승인 흐름

1. 시스템이 `release:scan`으로 자동 후보를 계산한다.
2. 시스템이 `release:review`로 review 요청과 suggestion artifact를 만든다.
3. 사람은 Eagle에서 이름/태그를 검토하고, 승인할 아이템에 `reflix:approved`, 제외할 아이템에 `reflix:hold`를 붙인다.
4. `release:approve`가 실행되면 `approved && !hold` 조건을 만족하는 아이템만 `config/release-batch.json`으로 승격된다.

### 승인 상태 해석 규칙

- `reflix:approved` 있고 `reflix:hold` 없으면 승인된 것으로 본다.
- `reflix:approved`와 `reflix:hold`가 동시에 있으면 `hold`가 우선한다.
- 승인 태그가 없으면 이번 배치에 포함하지 않는다.

## 게시 절차

게시 절차는 승인 절차와 분리한다.

### 단계 분리 원칙

- `scan`은 후보 계산과 proposal artifact 생성을 한다.
- `review`는 review-requested 태그와 metadata-based suggestion artifact를 만든다.
- `approve`는 approved proposal만 active batch로 승격한다.
- `export:batch:dry`는 export 전에 active batch를 검증하고, 새 run 생성 또는 기존 run 재개 여부를 보여준다.
- `export:batch`는 active batch 기준 stage-based export를 수행한다.
- `export:prune` 또는 `--prune`은 실패가 없는 경우에만 stale local artifact 정리를 수행한다.
- `mark-published`는 게시 성공 결과를 Eagle 태그와 `config/published-state.json`에 반영한다.
- `mark-failed`는 실패 결과를 Eagle 태그에 반영하되, 기존 `config/published-state.json`은 유지한다.

### 추천 명령 흐름

1. `release:scan`
   - 자동 후보 계산
   - `.tmp/release-approval/<timestamp>/proposal-report.md` 생성
   - `.tmp/release-approval/<timestamp>/release-batch.proposed.json` 생성
2. `release:review`
   - review 요청과 suggestion artifact 생성
   - `reflix:review-requested` 태그 반영
3. Eagle에서 사람 검토
   - 이름과 content tag를 직접 편집
   - 승인할 아이템에 `reflix:approved`, 제외할 아이템에 `reflix:hold`
4. `release:approve`
   - 승인된 후보만 `config/release-batch.json`으로 승격
5. `export:batch:dry`
   - active batch 사전 검증
6. `export:batch`
   - active batch 기준 export
   - local prune
7. 성공 시 `release:mark-published`
8. 실패 시 `release:mark-failed`

## 게시 성공 후 상태 반영 규칙

### 게시 성공

게시가 성공하면 아래를 수행한다.

- Eagle에 `reflix:published` 추가
- Eagle에서 `reflix:publish-failed` 제거
- Eagle에서 `reflix:approved` 제거
- `config/published-state.json` 갱신

이후 Eagle 안에서는 “이 아이템은 이미 성공적으로 게시됨”을 바로 확인할 수 있어야 한다.

### 게시 실패

게시가 실패하면 아래를 수행한다.

- Eagle에 `reflix:publish-failed` 추가
- Eagle에서 `reflix:published` 제거 또는 유지하지 않음
- `config/published-state.json`은 성공 기준으로 갱신하지 않음

즉 실패는 Eagle에서 눈에 띄게 드러나야 하고, 시스템 기록도 성공 상태로 오염되면 안 된다.

## Proposal report 설계

`.tmp/release-approval/<timestamp>/proposal-report.md`는 사람이 “왜 이 아이템들이 후보인가”를 이해할 수 있게 설명해야 한다.

### 최소 포함 항목

- 스캔 시각
- 후보 총개수
- 신규 후보 수
- 변경 후보 수
- 실패 재시도 수
- hold 상태 수
- blocking 상태 수
- 아이템별 선정 이유
- 아이템별 현재 운영 태그
- 사람이 다음에 해야 할 행동

### 아이템별 reason 예시

- `new`
- `changed`
- `retry_failed_publish`
- `held`
- `blocked`

이 리포트는 Eagle 확인을 대체하는 것이 아니라, Eagle 검토를 더 빠르게 만드는 설명서 역할을 한다.

## 최종 구조 요약

이 설계의 최종 흐름은 아래와 같다.

```text
Phase 1 완료 아이템
→ 자동 후보 스캔
→ proposal-report / proposed batch 생성
→ Eagle에서 사람 승인
→ active batch 승격
→ export / prune
→ mark-published / mark-failed
→ 게시 성공 여부 기록
→ Eagle 운영 태그 갱신
```

즉 사람은 batch를 직접 작성하지 않는다. 시스템이 후보를 만들고, 사람은 Eagle에서 승인만 한다. 실제 게시 성공 여부는 `config/published-state.json`과 Eagle 운영 태그가 함께 추적한다.

## 관련 문서

- [Reflix Pipeline Overview](./reflix-pipeline-overview.md)
- [Phase 1: Eagle Library Workflow](./phase-1-eagle-library-workflow.md)
- [Phase 2: Reflix Release Workflow](./phase-2-release-workflow.md)
- [Release Batch Implementation Plan](/Users/macbook/reflix-nextjs/docs/superpowers/plans/2026-03-24-reflix-release-batch-implementation.md)
