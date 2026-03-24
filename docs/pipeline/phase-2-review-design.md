# Phase 2 Review Design

## 문서 목적

이 문서는 Reflix Phase 2에서 `approve` 이전에 수행하는 `review` 단계를 설계한다.

목표는 아래 세 가지다.

- Eagle 안에서 사람이 이름과 태그를 검토하기 쉽게 만든다.
- 검색 노출에 도움이 되는 이름/태그 보강 제안을 시스템이 먼저 만든다.
- 사람이 직접 Eagle을 수정하고, 괜찮다고 판단한 뒤에만 `reflix:approved`로 다음 단계로 넘긴다.

이 문서는 실제 게시 성공/실패 추적 전체를 다루지 않는다. 게시 상태와 active batch 승격은 [Phase 2 Approval and Publish Design](./phase-2-approval-and-publish-design.md)에서 다룬다.

## 이 단계가 필요한 이유

`approve`만 바로 두면 “이번에 올려도 되는가”만 판단하게 되고, 검색 품질을 높이기 위한 이름/태그 보강이 생략되기 쉽다.

Reflix에서는 같은 영상이라도 이름과 태그가 조금만 더 좋아지면 browse, detail, search에서 찾히는 방식이 달라진다. 따라서 게시 승인을 하기 전에 아래를 한 번 점검하는 독립 단계가 필요하다.

- 현재 이름이 검색에 충분히 걸리는가
- 빠진 의미 태그가 없는가
- 중복/약한/숫자 중심 태그가 섞이지 않았는가
- taxonomy를 벗어나는 새 태그 후보가 정말 필요한가

즉 review 단계의 목적은 “게시 승인”이 아니라 “검색 메타데이터 보정”이다.

## 구현 결정

이 설계의 구현은 아래 결정으로 고정한다.

- review 단계는 `release:scan` 다음, `release:approve` 전에 실행한다.
- review 결과 산출물은 `.tmp/release-review/<timestamp>/...` 아래에 생성한다.
- 사람용 보고서는 `.tmp/release-review/<timestamp>/review-report.md`다.
- 기계용 제안 데이터는 `.tmp/release-review/<timestamp>/review-suggestions.json`이다.
- review 단계는 Eagle 메타데이터를 자동 수정하지 않는다.
- 시스템은 검토 대상에 `reflix:review-requested`를 붙인다.
- 사람은 Eagle에서 이름/태그를 직접 수정하고, 괜찮으면 `reflix:approved`, 제외하면 `reflix:hold`를 붙인다.
- `reflix:approved`가 붙는 순간 `reflix:review-requested`는 제거하는 방향으로 운영한다.
- review suggestion은 deterministic metadata-based hint이며, Eagle의 이름과 content tag는 사람이 직접 편집한다.

## Phase 2 안에서의 위치

Phase 2의 큰 흐름은 아래처럼 본다.

1. `release:scan`
2. `release:review`
3. Eagle에서 사람 검토
4. `release:approve`
5. `export:batch:dry`
6. `export:batch`
7. `release:mark-published` 또는 `release:mark-failed`

즉 `review`는 승인 전에 사람이 메타데이터를 다듬는 단계다.

## review 단계의 역할

`release:review`는 아래 3가지 역할만 가진다.

### 1. 검토 대상 계산

현재 active batch 범위 안에서 review가 필요한 아이템을 찾는다.

기본 원칙:

- active batch 안에 있어야 한다
- Phase 1 종료 조건을 만족해야 한다
- `reflix:hold`는 review 대상에서 제외한다
- 아직 `reflix:approved`가 없으면 기본 review 대상이다
- 이미 `reflix:approved`가 있어도 이름/태그/폴더 등 콘텐츠 변경이 감지되면 재검토 대상으로 올릴 수 있다

### 2. review 제안 산출물 생성

시스템은 사람이 Eagle에서 빠르게 판단할 수 있도록 두 종류의 산출물을 만든다.

- `review-report.md`
- `review-suggestions.json`

### 3. Eagle에 검토 요청 상태 표시

review 대상에는 `reflix:review-requested`를 붙인다.

상태 전이의 기본 형태는 아래와 같다.

- 스캔됨 -> `reflix:review-requested`
- 검토 후 승인 -> `reflix:approved`
- 검토 후 제외 -> `reflix:hold`
- 게시 성공 -> `reflix:published`
- 게시 실패 -> `reflix:publish-failed`

## 운영 태그

review 단계를 포함한 운영 태그는 아래 다섯 개로 본다.

- `reflix:review-requested`
- `reflix:approved`
- `reflix:published`
- `reflix:publish-failed`
- `reflix:hold`

### 태그 의미

#### `reflix:review-requested`

시스템이 “이 아이템은 이름/태그 검토가 필요하다”고 표시한 상태다. 아직 사람의 review가 끝나지 않았다.

#### `reflix:approved`

사람이 Eagle에서 이름/태그를 검토했고, 이번 배치에 넣어도 된다고 승인한 상태다.

#### `reflix:published`

실제 게시가 성공한 상태다. export, 필요한 업로드, production 반영, 검증까지 성공한 뒤에만 붙인다.

#### `reflix:publish-failed`

게시를 시도했지만 실패한 상태다. 재시도나 원인 분석이 필요하다.

#### `reflix:hold`

사람이 의도적으로 이번 배치에서 제외한 상태다.

### 태그 해석 원칙

- `reflix:review-requested`는 “사람 액션 필요”를 뜻한다.
- `reflix:approved`는 review와 배치 포함 판단이 끝났음을 뜻한다.
- `reflix:hold`가 있으면 이번 배치에서는 제외한다.
- `reflix:approved`가 붙으면 `reflix:review-requested`는 제거하는 것을 기본으로 한다.
- `reflix:published`와 `reflix:publish-failed`는 review 단계가 아니라 게시 결과 단계의 태그다.
- review suggestion은 deterministic metadata-based hint다.

## review 제안이 다루는 것

review 단계는 아래 4종류의 제안만 만든다.

### 1. 이름 유지/수정 제안

- 현재 이름이 충분하면 `유지`
- 더 검색 가능성이 높은 이름이 있으면 `수정 제안`

예:

- 현재: `연출 아케인 힘듦`
- 제안: `연출 아케인 힘듦 거친 호흡 숨 고르기`

### 2. 태그 추가 제안

검색 노출에 도움이 되는데 아직 빠진 개념을 제안한다.

우선순위:

- 행동
- 감정
- 상태
- 상황
- 연출 의도

### 3. 태그 제거/정리 제안

자동 삭제는 하지 않고, 아래처럼 정리 가치가 있는 태그만 제안한다.

- 숫자 토큰
- 중복/동의어
- 의미가 약한 흔적성 태그
- 운영 태그와 섞인 콘텐츠 태그

### 4. 새 태그 후보 제안

기존 taxonomy로 설명하기 어려운데 반복적인 검색 가치가 있는 경우만 제안한다.

원칙:

- 기존 taxonomy 재사용 우선
- 새 태그는 보수적으로 제안

## 제안의 근거

`release:review`는 아래 4개 입력을 함께 본다.

### 1. 현재 Eagle item 메타데이터

- 이름
- 태그
- 폴더
- annotation
- star
- mtime

이 값이 review 제안의 1차 재료다.

### 2. 현재 taxonomy

- [`/Users/macbook/reflix-nextjs/src/data/categories.json`](/Users/macbook/reflix-nextjs/src/data/categories.json)

taxonomy는 기존 분류 체계를 재사용하기 위한 기준점이다. 새 태그를 무분별하게 만드는 것을 막는다.

### 3. 현재 export된 clip JSON

- [`/Users/macbook/reflix-nextjs/public/data/clips/L3TR52T22TPVR.json`](/Users/macbook/reflix-nextjs/public/data/clips/L3TR52T22TPVR.json) 같은 clip JSON

이 값으로 현재 Reflix에 어떤 이름/태그/폴더로 실제 반영되는지 확인한다.

### 4. 운영 규칙

아래 운영 규칙을 같이 적용한다.

- 숫자 토큰은 태그로 쓰지 않는다
- 운영 태그(`reflix:*`)는 콘텐츠 태그 제안에서 제외한다
- 기존 taxonomy를 우선 재사용한다
- 검색 의미가 약한 태그는 제안 대상에서 제외한다

추가 동기화 규칙:

- 이름과 태그를 비교할 때는 숫자 토큰과 `reflix:*`를 제외한 의미 토큰만 센다
- 이름 쪽 의미 토큰이 더 많으면 이름을 기준으로 태그를 보강한다
- 태그 쪽 의미 토큰이 더 많으면 태그를 기준으로 이름 보강안을 만든다
- 동률이면 이름을 우선 기준으로 본다

추천 품사/형태 제한:

- 태그 제안과 새 태그 후보는 라이브러리에서 자주 쓰는 축을 우선 추천한다
- 우선 추천 대상:
  - 명사류
  - 동작형 `-기`
  - 상태/감정 명사형(`-움`, `-함`, `-ㅁ` 계열 포함)
  - 의태어/의성어
- 기본 제외 대상:
  - 숫자
  - 운영 태그
  - 조사 결합형, 관형형, 연결형 같은 문법 조각
  - 의미 없는 영어 조각

## review 단계의 1차 구현 범위

1차 구현에서는 영상 프레임 자체를 분석하지 않는다. 메타데이터 기반 제안만 만든다.

즉 1차 입력은 아래로 제한한다.

- Eagle metadata
- taxonomy
- existing clip JSON

이 범위만으로도 운영상 충분한 가치가 있다. 영상 내용 직접 분석은 이후 단계에서 확장할 수 있다.

## review 완료 판정

review는 별도 완료 태그를 두지 않는다. 사람이 Eagle에서 검토를 끝내고 괜찮다고 판단했을 때 `reflix:approved`를 붙인다.

즉 review 완료의 의미는 아래와 같다.

- 이름을 한 번 검토했다
- 태그를 한 번 검토했다
- 검색 관점에서 필요한 보강을 했거나, 현재 상태로 충분하다고 판단했다
- 그래서 이번 배치에 넣어도 된다고 승인했다

`reflix:approved`가 이 단계의 통과 상태를 겸한다.

## `review-report.md` 구조

사람이 Eagle과 함께 읽을 문서이므로, 상단 요약 + 하단 아이템별 상세 구조를 사용한다.

### 상단 요약

최소한 아래를 포함한다.

- 생성 시각
- batch 이름
- 대상 개수
- `review_needed`
- `review_needed_changed`
- `already_approved`
- `held`

### 운영 안내

짧은 액션 안내를 넣는다.

- Eagle에서 아래 아이템을 확인한다
- 이름/태그를 직접 수정한다
- 괜찮으면 `reflix:approved`
- 제외하면 `reflix:hold`
- 수정 후 `release:approve`를 실행한다

### 아이템별 섹션

각 아이템에는 아래 정보를 포함한다.

- `ID`
- `현재 상태`
- `현재 이름`
- `이름 제안`
- `현재 태그`
- `추가 추천 태그`
- `제거 추천 태그`
- `새 태그 후보`
- `이유`
- `신뢰도`
- `다음 행동`

### 정렬 순서

아래 순서로 정렬하는 것을 기본으로 한다.

1. `review_needed_changed`
2. `review_needed`
3. `held`
4. `already_approved`

## `review-suggestions.json` 구조

기계가 읽는 suggestion 파일은 상단 메타 정보와 아이템 배열로 나눈다.

### 상단 메타 정보

최소 필드:

- `version`
- `generatedAt`
- `batchName`
- `scope`
- `summary`

`summary`에는 최소한 아래를 넣는다.

- 총 대상 수
- `review_needed`
- `review_needed_changed`
- `already_approved`
- `held`

### 아이템별 필드

각 아이템은 아래 필드를 가진다.

- `id`
- `status`
- `currentName`
- `suggestedName`
- `nameDecision`
- `currentTags`
- `suggestedTagsToAdd`
- `suggestedTagsToRemove`
- `newTagCandidates`
- `currentFolders`
- `reason`
- `confidence`
- `nextAction`

### 필드 해석 원칙

- `suggestedName`은 이름 유지면 현재 이름과 같아도 된다.
- `nameDecision`은 `keep` 또는 `suggest-change`를 사용한다.
- `suggestedTagsToAdd`는 검색 노출에 실제 도움이 되는 태그만 담는다.
- `suggestedTagsToRemove`는 제거 권장 태그만 담고 자동 삭제 의미는 아니다.
- `newTagCandidates`는 taxonomy에 없는 신규 후보를 담는다.
- `confidence`는 `high`, `medium`, `low` 같은 단계형 값을 권장한다.
- `nextAction`은 `approve_after_review`, `hold_for_manual_decision`, `review_existing_changes` 같은 액션 키를 사용한다.

## 관련 문서

- [Reflix Pipeline Overview](./reflix-pipeline-overview.md)
- [Phase 1: Eagle Library Workflow](./phase-1-eagle-library-workflow.md)
- [Phase 2: Reflix Release Workflow](./phase-2-release-workflow.md)
- [Phase 2 Approval and Publish Design](./phase-2-approval-and-publish-design.md)
