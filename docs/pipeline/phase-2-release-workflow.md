# Phase 2: Reflix Release Workflow

## 문서 목적

이 문서는 Reflix 파이프라인의 Phase 2 운영 절차를 정리한다. 목표는 두 가지다.

- Phase 1에서 정리된 Eagle 아이템을 어떤 기준으로 Reflix 앱에 반영하는지 설명한다.
- 지금은 작은 배치로 검증하고, 나중에는 더 큰 배치로 안전하게 확대하는 기준을 만든다.

즉 이 문서는 “무엇을 배포할지 결정하는 방식”과 “어떻게 배포 검증하는지”를 함께 다루는 운영 기준서다.

현재 운영의 기준 파일은 [`config/release-batch.json`](/Users/macbook/reflix-nextjs/config/release-batch.json)과 [`config/published-state.json`](/Users/macbook/reflix-nextjs/config/published-state.json)이다. 운영 흐름은 `release:scan -> release:review -> Eagle review -> release:approve -> 필요 시 AI 메타데이터 backfill -> export:batch:dry -> export:batch -> release:mark-published / release:mark-failed` 순서로 진행한다. 기본 `release:scan`은 active batch 범위만 스캔하고, 전체 eligible 라이브러리 스캔은 명시적인 `release:scan:all`로만 연다.

이름/태그 검토 단계는 [Phase 2 Review Design](./phase-2-review-design.md) 문서를 함께 보고, 자동 선정, Eagle 승인 태그, proposed batch, published state를 사용하는 상세 구조는 [Phase 2 Approval and Publish Design](./phase-2-approval-and-publish-design.md) 문서를 함께 본다.

## Phase 2 범위

Phase 2는 Phase 1을 통과한 `배포 후보` 아이템을 실제 Reflix 앱 데이터와 미디어 파일로 만들고, `reflix.dev`에 반영하는 단계다.

이 문서는 원본 mp4 정리, Eagle 내부 이름/태그/폴더/썸네일 작업은 다루지 않는다. 그 범위는 Phase 1이다.

## 시작 조건

Phase 2는 아래 조건이 만족되면 시작한다.

- Phase 1을 통과한 `배포 후보 (publish_candidate)` 아이템이 있다.
- 이번에 실제로 올릴 아이템 집합을 정할 수 있다.
- 로컬에서 export와 검증을 실행할 준비가 되어 있다.

## 종료 조건

아래 조건을 모두 만족하면 해당 배치는 Phase 2를 통과한 것으로 본다.

- 이번 배치에 포함할 아이템 집합이 명시적으로 정해져 있다.
- 배치 안의 모든 아이템이 Eagle metadata 기준으로 `aiTags` 필드를 가진다.
- 앱용 데이터와 미디어 파일이 같은 배치 기준으로 생성되어 있다.
- 로컬에서 browse / detail / search 흐름이 확인되었다.
- production에 반영한 경우, 같은 배치가 실제 서비스에 보인다.
- 배치를 확대할지 유지할지 판단할 수 있는 검증 결과가 남아 있다.

## 핵심 원칙

### 1. Eagle 전체와 현재 배포 범위는 다를 수 있다

Eagle 라이브러리 전체가 곧 배포 범위가 아니다. 지금 서비스에 반영할 집합은 항상 별도로 정한다.

### 2. 배포 범위는 `release batch`로 관리한다

이번에 올릴 clip 집합은 명시적인 배치로 관리한다. 지금은 10개일 수 있고, 검증이 끝나면 100개, 1000개로 늘릴 수 있다.

### 3. 로컬과 production은 같은 배치를 기준으로 검증한다

“로컬에서 보이는 10개”와 “production에서 보이는 10개”가 같아야 한다. 이 기준이 무너지면 검증이 의미가 없다.

### 4. 최근 변경 항목은 우선순위일 뿐, 최종 기준은 배치다

최근 생성/수정된 Eagle 아이템은 우선 검토 대상이 될 수 있다. 하지만 최종적으로 무엇이 배포되는지는 `release batch`가 결정한다.

### 5. 대량 배포는 작은 검증 배치를 통과한 뒤에만 한다

처음부터 전체 라이브러리를 올리지 않는다. 작은 배치로 흐름이 안정적인지 확인한 뒤 같은 파이프라인으로 확장한다.

### 6. AI 태깅은 Phase 1에서 끝내고 Phase 2는 이를 소비한다

Phase 2는 AI 태깅의 주 실행 단계가 아니다. 배치 안에 `aiTags` 필드가 빠진 항목이 있으면 먼저 Phase 1의 AI 메타데이터 보강 단계로 되돌리고, export는 Eagle metadata에 이미 기록된 값을 그대로 읽는다.

## 공통 상태

각 배치 또는 배치 안의 아이템은 아래 메인 상태 중 하나를 가진다.

- `배치 후보 (batch_candidate)`
- `배치 확정 (batch_locked)`
- `로컬 생성 완료 (local_artifacts_ready)`
- `로컬 검증 완료 (local_verified)`
- `원격 업로드 완료 (remote_uploaded)`
- `배포 완료 (deployed)`
- `게시 완료 (published)`
- `보류 (on_hold)`

이 메인 상태는 “현재 이 배치가 Phase 2에서 어디까지 왔는가”를 뜻한다.

## 공통 플래그

문제가 있으면 아래 플래그를 붙여 추적한다.

- `배치 범위 확인 필요 (batch_scope_needs_review)`
- `원격 미디어 누락 (remote_media_missing)`
- `로컬/프로덕션 불일치 (local_production_mismatch)`
- `배포 검증 필요 (deployment_verification_required)`
- `수동 검토 필요 (manual_review_required)`

## Phase 2의 기본 구조

Phase 2는 아래 순서로 진행한다.

1. 배포 후보 점검
2. release batch 결정
3. export 입력 확정
4. 앱용 데이터/미디어 생성
5. 로컬 결과 정리
6. 로컬 검증
7. 필요 시 원격 미디어 업로드
8. production 반영
9. production 검증
10. 다음 배치 확대 여부 판단

---

## 1. 배포 후보 점검

### 단계 목적

기본 `release:scan`이 현재 active batch 범위에서 후보를 계산하고 proposal artifact를 만든다. `release:review`는 deterministic metadata-based hints를 만든 뒤 `reflix:review-requested`를 붙인다. Eagle에서는 사람이 이름과 content tag를 직접 수정하고, `reflix:approved` / `reflix:hold`를 반영한다. 전체 eligible 라이브러리 후보를 보고 싶을 때만 `release:scan:all`을 쓴다.

### 현재 상태

사람이 직접 초기 후보 목록을 구성하지 않는다. 기본 `release:scan`은 현재 active batch를 기준으로 후보와 proposed batch를 만들고, `release:review`는 검토용 힌트를 만든다. 사람은 Eagle에서 그 제안을 보고 이름과 content tag를 직접 다듬는다. 더 큰 확장 배치를 검토할 때만 `release:scan:all`로 전체 eligible 후보를 계산한다.

### 목표 상태

최근 변경 아이템과 이미 배포된 범위를 자동으로 비교해, 배포 후보 큐를 안정적으로 만들 수 있다.

### 입력

- `release:scan`이 생성한 proposal artifact
- `배포 후보 (publish_candidate)` 상태의 Eagle 아이템
- 최근 생성/수정된 Eagle 아이템

### 작업

- 최근 생성/수정된 항목을 우선 확인한다.
- 실제로 이번에 서비스에 반영할 가치가 있는지 본다.
- 아직 Phase 1이 덜 끝난 항목은 제외한다.

### 판정 기준

- 이번 배치 후보로 볼 수 있는 아이템 목록이 나온다.
- 아직 품질이 덜 정리된 항목은 후보에서 빠진다.

### 자주 생기는 문제

- 최근 수정됐지만 배포할 만큼 정리되지 않은 항목
- 오래된 항목인데도 이번에 같이 올려야 하는 경우
- 배포 후보와 보류 항목이 섞여 있는 경우

### 결과물

- 배포 후보 목록

### 다음 단계로 넘기는 조건

- `배치 후보 (batch_candidate)` 상태로 묶을 수 있어야 한다.

### 관련 코드/문서/경로

- [Reflix 전체 파이프라인 개요](./reflix-pipeline-overview.md)
- [Phase 1 상세 문서](./phase-1-eagle-library-workflow.md)

---

## 2. release batch 결정

### 단계 목적

기본 `release:scan`으로 active batch 범위의 후보를 계산하고, `release:review`로 `reflix:review-requested`와 review hints를 만든 뒤, Eagle에서 `reflix:approved` / `reflix:hold`를 반영한 후 `release:approve`로 active batch를 확정한다.

### 현재 상태

기본 `release:scan`이 `.tmp/release-approval/<timestamp>/` 아래에 proposal report와 proposed batch를 만든다. `release:review`는 review 요청과 metadata-based suggestion artifact를 만든다. 사람은 Eagle에서 이름과 content tag를 직접 편집하고, 승인 태그만 조정한다. batch 자체는 `config/release-batch.json`이 authoritative source다. 전체 eligible 라이브러리를 대상으로 한 확장 스캔은 `release:scan:all`일 때만 허용한다.

### 목표 상태

배치 정의를 기억으로 관리하지 않고, `config/release-batch.json` 하나만 보면 이번 배포 범위를 정확히 알 수 있게 만든다.

### 입력

- `release:scan` 결과
- Eagle 승인 태그
- 기존 active batch

### 작업

- proposal report를 보고 Eagle에서 `reflix:approved` / `reflix:hold`를 반영한다.
- `release:approve`를 실행해 proposed batch를 active batch로 승격한다.
- `config/release-batch.json`을 이번 배포의 유일한 실행 입력으로 유지한다.

### 판정 기준

- “이번 배치에 무엇이 포함되는지”가 명확하다.
- 로컬과 production이 같은 집합을 보게 할 수 있다.
- 사람이 batch를 직접 새로 정의하지 않는다.

### 자주 생기는 문제

- 검증용 후보와 실제 배포 범위가 섞이는 경우
- 배치에 넣을지 말지 애매한 아이템이 남는 경우
- 명시된 배치 없이 사람이 기억으로만 운영하려는 경우

### 결과물

- 이번 active release batch 정의

### 다음 단계로 넘기는 조건

- 메인 상태가 `배치 확정 (batch_locked)` 이어야 한다.
- 필요한 경우 `배치 범위 확인 필요 (batch_scope_needs_review)` 플래그를 남긴다.

### 관련 코드/문서/경로

- [Release batch 구현 계획](/Users/macbook/reflix-nextjs/docs/superpowers/plans/2026-03-24-reflix-release-batch-implementation.md)
- 현재 기준 설정 파일: [`config/release-batch.json`](/Users/macbook/reflix-nextjs/config/release-batch.json)

---

## 매칭 완료 기준

이 문서에서 말하는 “매칭 완료”는 단순히 아이템을 골랐다는 뜻이 아니다. 아래 조건을 모두 만족해야 “Eagle 아이템이 Reflix clip으로 정상 매칭되었다”고 본다.

- Eagle item ID와 Reflix clip ID가 같다.
- 해당 clip의 개별 JSON이 존재한다.
- 해당 clip의 `video`, `preview`, `thumbnail` 파일이 존재한다.
- browse / detail / search 흐름에서 실제로 노출되거나 접근 가능하다.
- 최신 Eagle 기준의 이름/태그와 Reflix에 반영된 결과가 크게 어긋나지 않는다.

즉 “10개를 선정했다”와 “10개가 매칭 완료되었다”는 다른 말이다. 선정은 후보를 고르는 단계이고, 매칭 완료는 실제 데이터/미디어/UI 반영까지 확인된 상태를 뜻한다.

작은 배치 검증에서는 이 기준을 먼저 통과시킨 뒤에만 다음 배치로 확대한다.

---

## 3. export 입력 확정

### 단계 목적

어떤 Eagle 소스를 어떤 배치 기준으로 export할지 확정한다.

### 현재 상태

로컬 Eagle 경로는 `EAGLE_LIBRARY_PATH`로 정하고, export는 배치 기준으로 안전하게 돌리는 방향으로 설계 중이다.

### 목표 상태

기본 실행은 항상 현재 배치만 처리하고, 전체 라이브러리는 별도 확인 없이는 실행되지 않게 만든다.

### 입력

- release batch
- Eagle library 경로
- batch 아이템의 `aiTags` 준비 상태

### 작업

- 로컬 Eagle source path를 확인한다.
- 이번 실행이 배치 export인지, 전체 export인지 구분한다.
- batch 안에 `aiTags` 필드가 아예 없는 항목이 있는지 확인한다.
- 누락 항목이 있으면 export를 진행하지 않고 Phase 1의 AI 메타데이터 보강 단계로 되돌린다.
- 전체 export는 예외적인 상황으로 취급한다.

### 판정 기준

- export 대상 범위를 실행 전에 설명할 수 있다.
- “왜 이 아이템들이 처리되는지”가 배치 기준으로 설명된다.
- `aiTags` 누락 항목 없이 export를 시작할 수 있다.

### 자주 생기는 문제

- 배치 export라고 생각했는데 실제로는 전체 라이브러리를 처리하는 경우
- 소스 경로가 예상과 다른 라이브러리를 가리키는 경우
- 배치에 `aiTags`가 아예 없는 항목이 섞여 있는데도 그대로 export를 진행하는 경우

### 결과물

- 실행 전 확정된 export 범위

### 다음 단계로 넘기는 조건

- 실행 범위가 명확해야 한다.
- 위험한 전체 실행은 별도 확인이 있어야 한다.
- batch 안의 모든 아이템에서 `aiTags` 필드가 객체 또는 `null`로 존재해야 한다.

### 관련 코드/문서/경로

- [Export 스크립트](/Users/macbook/reflix-nextjs/scripts/export.mjs)
- [Eagle 라이브러리 경로 해석](/Users/macbook/reflix-nextjs/scripts/lib/eagle-library-path.mjs)
- [Release batch 구현 계획](/Users/macbook/reflix-nextjs/docs/superpowers/plans/2026-03-24-reflix-release-batch-implementation.md)

---

## 4. 앱용 데이터와 미디어 생성

### 단계 목적

배치에 포함된 아이템을 Reflix 앱이 실제로 읽을 수 있는 데이터와 미디어 파일로 만든다.

### 현재 상태

`scripts/export.mjs`가 clip JSON, index, video, preview, thumbnail을 생성하고, Eagle metadata의 `aiTags`를 앱용 JSON으로 복사한다.

### 목표 상태

현재 배치만 대상으로 안전하게 생성하고, 생성 결과가 항상 같은 규약을 따르며 Eagle metadata의 AI 메타데이터가 손실 없이 반영된다.

### 입력

- 확정된 release batch
- Eagle library source

### 작업

- clip index 생성
- 개별 clip JSON 생성
- Eagle metadata의 `aiTags`를 index와 개별 clip JSON에 반영
- `videos`, `previews`, `thumbnails` 생성
- 필요한 경우 업로드 대상 목록 계산

### 판정 기준

- 데이터와 미디어가 같은 배치 기준으로 만들어졌다.
- `aiTags` 상태가 Eagle metadata와 export 산출물 사이에서 일치한다.
- clip 수와 media 수가 크게 어긋나지 않는다.
- 경로 규약이 유지된다.

### 자주 생기는 문제

- JSON은 10개인데 미디어는 8개만 있는 경우
- 예전 생성물이 남아 현재 배치를 헷갈리게 하는 경우
- 특정 파일 생성 실패가 뒤늦게 발견되는 경우
- Eagle metadata에는 `aiTags`가 있는데 export 산출물에 빠지는 경우

### 결과물

- [src/data/index.json](/Users/macbook/reflix-nextjs/src/data/index.json)
- [public/data/clips](/Users/macbook/reflix-nextjs/public/data/clips)
- [public/videos](/Users/macbook/reflix-nextjs/public/videos)
- [public/previews](/Users/macbook/reflix-nextjs/public/previews)
- [public/thumbnails](/Users/macbook/reflix-nextjs/public/thumbnails)

### 다음 단계로 넘기는 조건

- 메인 상태가 `로컬 생성 완료 (local_artifacts_ready)` 이어야 한다.

### 관련 코드/문서/경로

- [Export 스크립트](/Users/macbook/reflix-nextjs/scripts/export.mjs)
- [미디어 전략 문서](/Users/macbook/reflix-nextjs/docs/media-strategy.md)

---

## 5. 로컬 결과 정리

### 단계 목적

현재 배치 밖의 오래된 생성물을 정리해, 로컬에서 보는 결과가 이번 배치와 정확히 같도록 맞춘다.

### 현재 상태

필요에 따라 로컬 산출물을 수동으로 정리하고 있다.

### 목표 상태

배치 기준으로 stale artifact를 자동 정리해, 로컬과 배치 정의가 항상 일치하게 만든다.

### 입력

- 로컬 생성 완료된 데이터/미디어
- 현재 release batch

### 작업

- 현재 배치에 없는 예전 JSON/미디어를 정리한다.
- 로컬 결과물이 배치 수와 맞는지 확인한다.

### 판정 기준

- 이번 배치에 속한 파일만 남아 있다.
- index, clip JSON, media 파일 수가 일치한다.

### 자주 생기는 문제

- 예전 실험 파일이 남아 브라우저에서 헷갈리는 경우
- 로컬은 10개처럼 보이는데 실제 미디어 폴더는 훨씬 많은 경우

### 결과물

- 배치 기준으로 정리된 로컬 산출물

### 다음 단계로 넘기는 조건

- 메인 상태가 `로컬 생성 완료 (local_artifacts_ready)` 를 유지하면서, 실제 결과가 배치 정의와 일치해야 한다.

### 관련 코드/문서/경로

- [Release batch 구현 계획](/Users/macbook/reflix-nextjs/docs/superpowers/plans/2026-03-24-reflix-release-batch-implementation.md)

---

## 6. 로컬 검증

### 단계 목적

생성된 배치가 실제 앱에서 정상적으로 보이는지 로컬에서 먼저 확인한다.

### 현재 상태

browse, quick view, detail, search를 사람 손으로 점검한다.

### 목표 상태

배치 검증 체크리스트와 기본 자동 검증을 같이 운영한다.

### 입력

- 배치 기준으로 정리된 로컬 산출물

### 작업

- browse에서 카드가 보이는지 확인한다.
- quick view가 정상 열리는지 확인한다.
- detail에서 영상 재생이 가능한지 확인한다.
- search에서 대상 clip이 노출되는지 확인한다.

### 판정 기준

- 같은 배치의 clip이 browse/detail/검색 결과(`browse?q=...`)에서 일관되게 보인다.
- 썸네일/프리뷰/원본 영상 경로가 깨지지 않는다.
- 배치 수와 UI 노출 결과가 크게 어긋나지 않는다.

### 자주 생기는 문제

- index는 있지만 clip JSON이 누락된 경우
- detail은 열리는데 media가 없는 경우
- search는 나오지만 browse와 결과가 다른 경우

### 결과물

- 로컬 검증 결과

### 다음 단계로 넘기는 조건

- 메인 상태가 `로컬 검증 완료 (local_verified)` 이어야 한다.
- 실패한 경우 `local_production_mismatch` 이전에 로컬 문제부터 먼저 정리한다.

### 관련 코드/문서/경로

- [Browse 페이지](/Users/macbook/reflix-nextjs/src/app/[lang]/browse/page.tsx)
- [Clip detail 페이지](/Users/macbook/reflix-nextjs/src/app/[lang]/clip/[id]/page.tsx)
- [Browse 페이지](/Users/macbook/reflix-nextjs/src/app/[lang]/browse/page.tsx)
- [SearchBar](/Users/macbook/reflix-nextjs/src/components/common/SearchBar.tsx)

---

## 7. 원격 미디어 업로드

### 단계 목적

production이 hosted media를 사용하는 경우, 현재 배치에 해당하는 media 파일만 원격 저장소에 올린다.

### 현재 상태

Cloudflare R2 업로드 경로가 존재하지만, 배치 단위 제어와 범위 안전장치를 강화하는 작업이 별도 계획으로 정리되어 있다.

### 목표 상태

현재 release batch만 원격으로 업로드하고, 전체 라이브러리 업로드는 별도 확인 없이는 실행되지 않게 만든다.

### 입력

- 현재 release batch
- 로컬에서 생성된 media 파일

### 작업

- 이번 배치의 `videos`, `previews`, `thumbnails`만 업로드한다.
- 업로드가 필요한 환경인지 먼저 확인한다.
- production이 same-origin 방식이면 이 단계를 생략한다.

### 판정 기준

- 필요한 환경에서만 원격 업로드가 수행된다.
- 이번 배치 밖의 아이템은 업로드되지 않는다.

### 자주 생기는 문제

- 테스트 배치와 전체 업로드가 섞이는 경우
- 원격에는 2개만 있고 앱은 10개를 보려는 경우
- 로컬은 정상인데 원격 미디어만 빠진 경우

### 결과물

- 원격에 올라간 현재 배치 media

### 다음 단계로 넘기는 조건

- 메인 상태가 `원격 업로드 완료 (remote_uploaded)` 이거나
- hosted media를 쓰지 않는 배포라면 이 단계는 생략 가능해야 한다.

### 관련 코드/문서/경로

- [R2 업로드 모듈](/Users/macbook/reflix-nextjs/scripts/lib/r2-uploader.mjs)
- [Release batch 구현 계획](/Users/macbook/reflix-nextjs/docs/superpowers/plans/2026-03-24-reflix-release-batch-implementation.md)

---

## 8. production 반영

### 단계 목적

현재 배치를 실제 서비스에 반영한다.

### 현재 상태

Vercel production deploy와 환경 변수 상태를 확인하면서 사람이 배포를 반영한다.

### 목표 상태

배치 기준의 데이터/미디어/환경 설정이 한 번에 맞물리도록 안전하게 반복 가능한 배포 절차를 만든다.

### 입력

- 로컬 검증 완료 배치
- 필요한 경우 원격 업로드 완료 상태

### 작업

- 현재 production 환경이 same-origin인지 hosted media인지 확인한다.
- 필요한 환경 변수가 올바른지 확인한다.
- production deploy를 실행한다.

### 판정 기준

- production이 현재 배치 기준으로 다시 빌드되고 반영된다.
- media source 계약이 production 환경과 일치한다.

### 자주 생기는 문제

- production은 원격 media를 보는데 원격 업로드가 덜 된 경우
- preview와 production의 설정이 섞이는 경우
- 최신 route는 배포됐는데 clip 데이터가 어긋나는 경우

### 결과물

- production에 반영된 현재 배치

### 다음 단계로 넘기는 조건

- 메인 상태가 `배포 완료 (deployed)` 이어야 한다.

### 관련 코드/문서/경로

- [README](/Users/macbook/reflix-nextjs/README.md)
- [Export 스크립트](/Users/macbook/reflix-nextjs/scripts/export.mjs)

---

## 9. production 검증

### 단계 목적

production에서 실제 사용자가 보게 되는 결과가 현재 배치와 일치하는지 확인한다.

### 현재 상태

사람이 실제 URL과 브라우저 동작을 확인한다.

### 목표 상태

배치별 검증 체크리스트를 기준으로 빠르게 통과/실패를 판정할 수 있다.

### 입력

- production에 반영된 현재 배치

### 작업

- browse 페이지 확인
- quick view 확인
- detail 페이지 확인
- search 결과 확인
- 썸네일/프리뷰/영상 URL이 예상한 source를 보는지 확인

### 판정 기준

- production에서 현재 배치가 실제로 보인다.
- 로컬 검증 결과와 큰 차이가 없다.
- media 누락이나 경로 깨짐이 없다.

### 자주 생기는 문제

- local은 10개인데 production은 2개만 보이는 경우
- 상세 페이지는 열리지만 media가 404인 경우
- search는 되는데 browse에 일부 clip이 빠진 경우

### 결과물

- production 검증 결과

### 다음 단계로 넘기는 조건

- 메인 상태가 `게시 완료 (published)` 이어야 한다.
- 문제가 있으면 `원격 미디어 누락 (remote_media_missing)` 또는 `로컬/프로덕션 불일치 (local_production_mismatch)` 플래그를 붙인다.

### 관련 코드/문서/경로

- [reflix.dev](https://reflix.dev)
- [마스터 개요 문서](./reflix-pipeline-overview.md)

---

## 10. 다음 배치 확대 여부 판단

### 단계 목적

현재 배치 검증 결과를 바탕으로 다음 배치를 얼마나 키울지 결정한다.

### 현재 상태

작은 수의 clip으로 먼저 검증하고, 문제가 없으면 확대하는 방향이 합의되어 있다.

### 목표 상태

검증 결과에 따라 배치 확대를 반복 가능한 운영 사이클로 만든다.

### 입력

- 로컬 검증 결과
- production 검증 결과

### 작업

- 이번 배치에서 드러난 문제를 정리한다.
- 확대 가능한지, 같은 크기로 한 번 더 검증할지, 축소해야 하는지 판단한다.

### 판정 기준

- 다음 배치 크기를 설명할 수 있다.
- 확대해도 되는 이유 또는 멈춰야 하는 이유가 명확하다.

### 자주 생기는 문제

- 작은 배치에서는 괜찮았는데 확대 시 문제가 생길 가능성
- “한 번 됐으니 바로 전체 배포”로 넘어가고 싶은 유혹

### 결과물

- 다음 배치 운영 결정

### 다음 단계로 넘기는 조건

- 다음 Phase 2 사이클을 시작할 준비가 되거나
- 배치를 유지한 채 문제를 먼저 해결해야 한다.

---

## Phase 2 최종 체크리스트

아래 체크리스트를 통과하면 해당 배치는 Phase 2를 통과했다고 본다.

- 이번 배치가 명시적으로 정의되어 있다.
- 이번 배치 아이템의 `aiTags` 누락 여부가 export 전에 점검되었다.
- 로컬 산출물이 배치와 일치한다.
- 로컬 browse / detail / search가 정상이다.
- production 반영이 필요한 경우 실제 서비스에서 같은 배치가 보인다.
- production media source와 배치 범위가 어긋나지 않는다.
- 다음 배치를 확대할지 유지할지 판단할 수 있다.

## 관련 코드와 문서

- [Reflix 전체 파이프라인 개요](./reflix-pipeline-overview.md)
- [Phase 1 상세 문서](./phase-1-eagle-library-workflow.md)
- [Release batch 구현 계획](/Users/macbook/reflix-nextjs/docs/superpowers/plans/2026-03-24-reflix-release-batch-implementation.md)
- [README](/Users/macbook/reflix-nextjs/README.md)
- [AI 태깅 backfill 스크립트](/Users/macbook/reflix-nextjs/scripts/ai-tag-backfill.mjs)
- [Export 스크립트](/Users/macbook/reflix-nextjs/scripts/export.mjs)
- [Eagle metadata 백업/쓰기 유틸](/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.mjs)
- [R2 업로드 모듈](/Users/macbook/reflix-nextjs/scripts/lib/r2-uploader.mjs)
