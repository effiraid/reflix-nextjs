# Reflix Pipeline Overview

## 문서 목적

이 문서는 Reflix 전체 운영 파이프라인의 큰 그림을 설명한다. 다음을 한 번에 이해할 수 있도록 정리하는 것이 목적이다.

- 원본 mp4가 어떤 과정을 거쳐 Eagle 라이브러리에 정리되는지
- Eagle 라이브러리에서 정리된 아이템이 어떤 기준으로 Reflix 배포 대상으로 넘어가는지
- 왜 `1:1 매칭`, `release batch`, `검증 후 확대`가 중요한지
- 현재 수동 운영 방식과 나중에 자동화할 목표 방식이 어떻게 다른지

이 문서는 세부 작업 절차를 모두 담는 문서가 아니다. 전체 구조와 용어, 단계 간 연결 관계를 이해하기 위한 마스터 문서다.

## 먼저 읽는 순서

처음 보는 사람은 아래 순서로 읽는다.

1. 이 문서에서 전체 개념과 단계 경계를 이해한다.
2. [Phase 1 상세 문서](./phase-1-eagle-library-workflow.md)에서 실제 운영 절차를 확인한다.
3. [Phase 2 상세 문서](./phase-2-release-workflow.md)에서 배포 절차와 배치 운영 방식을 확인한다.
4. [Phase 2 review 설계 문서](./phase-2-review-design.md)에서 이름/태그 검토 단계와 Eagle 검토 요청 구조를 확인한다.
5. [Phase 2 승인/게시 설계 문서](./phase-2-approval-and-publish-design.md)에서 자동 선정 + Eagle 승인 구조를 확인한다.
6. 필요한 경우 관련 코드와 기존 계획 문서를 찾아본다.

## 한눈에 보는 전체 흐름

Reflix 파이프라인은 크게 두 단계로 나뉜다.

1. **Phase 1: Eagle 라이브러리 정리**
   원본 mp4를 Eagle 라이브러리에 정리하고, 이름/태그/폴더/썸네일과 AI 메타데이터를 정리해 `배포 후보` 상태로 만드는 단계다.
2. **Phase 2: Reflix 배포**
   Phase 1에서 정리된 Eagle 아이템을 Reflix 앱 데이터와 미디어 파일로 만들어 `reflix.dev`에 반영하는 단계다.

큰 흐름은 아래와 같다.

```text
원본 mp4
→ Phase 1: Eagle 정리
→ AI 메타데이터 보강
→ 배포 후보
→ Phase 2: release batch 선정
→ 앱용 데이터/미디어 생성
→ reflix.dev 반영
```

현재 export 단계는 단일 순차 루프가 아니라 아래 stage 구조로 실행된다.

```text
discover
→ process-media
→ build-artifacts
→ compute-related
→ upload (옵션)
→ finalize
```

중간에 실패해도 검증된 stage 결과만 재사용하도록 `.tmp/export-runs/<run-id>/`에 run state를 남긴다. 운영자가 보는 진행 메시지와 실패 요약은 한글로 출력한다.

## 핵심 개념

### 원본 mp4

아직 Eagle에 들어가지 않은 영상 파일이다. 작업 시작점이다.

### Eagle library

Reflix의 운영 원본 라이브러리다. 이름, 태그, 폴더, 썸네일 정리가 이 단계에서 이루어진다. 현재 로컬 기본 경로는 `/Users/macbook/Desktop/라이브러리/레퍼런스 - 게임,연출.library`이며, 나중에 NAS로 바뀌어도 `EAGLE_LIBRARY_PATH`만 변경하면 된다.

### 이름 정리

영상 내용을 검색 가능한 형태로 표현하기 위해 오탈자, 동의어, 표현 길이를 정리하는 과정이다.

### 태그

검색과 필터링을 위해 영상에 붙이는 의미 단위다. 예: 감정, 행동, 상황, 작품명.

### 태그 그룹

태그를 더 큰 체계로 묶는 분류 기준이다. 새 태그가 생기면 어느 그룹에 속하는지 함께 관리해야 한다.

### 폴더 분류

Eagle 폴더 구조 안에서 아이템을 적절한 위치에 넣는 작업이다. 태그와 달리 탐색 구조를 안정화하는 역할을 한다.

### Eagle 썸네일 작업

Eagle 내부에서 아이템을 더 빠르게 식별할 수 있게 만드는 썸네일 처리다. 현재 코드베이스에서는 단순한 “png 변환”이 아니라, Eagle의 `_thumbnail.png` 파일명을 유지하면서 내부 내용을 움직이는 썸네일 워크플로우로 교체하는 작업을 뜻한다.

### AI 메타데이터 보강

수동 태그를 대체하지 않고 보강하기 위해 `aiTags`를 Eagle 원본 metadata에 기록하는 단계다. 이 값은 export 산출물에 직접 덧쓰는 것이 아니라 Eagle `metadata.json`에 먼저 저장되고, 이후 Phase 2 export가 그대로 읽어 앱용 JSON으로 복사한다.

### 배포 후보

Phase 1 종료 조건을 만족해 Reflix 배포 대상으로 올릴 수 있는 아이템 상태다.

### release batch

이번 배포에서 실제로 반영할 아이템 집합이다. 처음에는 10개만 넣고 검증한 뒤, 문제가 없으면 100개, 1000개, 더 큰 규모로 확대한다.

### published state

실제로 앱과 배포 환경에 반영된 상태다. Eagle 전체와는 다를 수 있으며, 현재 배포에 포함된 범위는 `release batch`가 결정한다.

## 운영 원칙

### 1. Eagle와 Reflix는 1:1 매칭을 유지한다

하나의 Eagle 아이템은 하나의 Reflix clip으로 이어져야 한다. 이름이나 태그가 바뀌어도, 아이템 식별 기준은 안정적으로 유지되어야 한다.

### 2. 원본 전체와 현재 배포 범위는 분리한다

Eagle 전체 라이브러리는 작업 원본이다. 실제 배포 범위는 항상 `release batch`로 따로 정한다.

### 3. 검증 후 확대한다

처음부터 대량 배포하지 않는다. 적은 수의 아이템으로 먼저 로컬과 production이 같은 결과를 내는지 확인한 뒤, 같은 파이프라인으로 배치를 늘린다.

### 4. 수동 운영과 자동화 목표를 분리해서 본다

현재 사람이 직접 확인하고 판단하는 단계와, 나중에 자동화할 목표 단계를 문서에서 분리해서 관리한다.

### 5. AI 메타데이터의 소스 오브 트루스는 Eagle metadata다

`src/data/index.json`과 `public/data/clips/*.json`은 export 산출물이다. AI 태깅은 이 파생 JSON에 직접 덧쓰지 않고, Eagle `metadata.json`을 먼저 보강한 뒤 export에서 소비하는 순서를 유지한다.

## Phase 1 요약

### 목적

원본 mp4를 Eagle 라이브러리에 정리하고, 이름/태그/태그 그룹/폴더/썸네일과 AI 메타데이터를 정리해 `배포 후보` 상태로 만드는 것.

### 시작 조건

- 새 원본 mp4가 존재한다.
- Eagle 라이브러리에 아직 정리되지 않은 신규 대상이 있다.

### 종료 조건

아래 조건을 모두 만족하면 Phase 1이 끝난다.

- 영상이 Eagle에 들어가 있다.
- 이름이 정리되어 있다.
- 태그가 붙어 있다.
- 새 태그 여부와 태그 그룹 상태가 정리되어 있다.
- 폴더가 분류되어 있다.
- 썸네일이 정리되어 있다.
- AI 메타데이터 상태가 정리되어 있다.
- 따라서 Reflix 배포 후보로 올릴 수 있다.

### Phase 1 산출물

- Eagle에 저장된 정리 완료 아이템
- 이름 정리 결과
- 태그 및 태그 그룹 정리 결과
- 폴더 분류 결과
- Eagle 썸네일 처리 결과
- Eagle metadata의 `aiTags` 반영 결과
- `배포 후보` 상태로 표시할 수 있는 아이템 집합

세부 절차는 [Phase 1 상세 문서](./phase-1-eagle-library-workflow.md)에서 다룬다.

## Phase 2 요약

### 목적

Phase 1에서 정리된 Eagle 아이템을 Reflix 앱에 반영하고, 전 세계 사용자가 `reflix.dev`에서 볼 수 있게 만드는 것.

### 핵심 개념

- Eagle 정리 상태와 Reflix clip 데이터는 1:1 매칭을 유지한다.
- 전체 Eagle 라이브러리를 한 번에 올리지 않는다.
- `release batch`를 통해 이번에 반영할 아이템 집합을 명시적으로 정한다.
- 로컬과 production은 같은 `release batch`를 기준으로 검증한다.
- export는 Eagle metadata에 이미 기록된 `aiTags`를 소비한다.

### Phase 2에서 일어나는 일

- 최근 생성/수정된 Eagle 아이템을 우선 검토한다.
- 배포 후보 중 이번에 올릴 대상을 `release batch`로 선정한다.
- 배치 안에 `aiTags` 필드가 빠진 항목이 있으면 Phase 1로 되돌려 AI 메타데이터 보강을 먼저 끝낸다.
- 앱용 데이터와 미디어 파일을 생성한다.
- 로컬과 production에서 같은 세트가 보이는지 확인한다.
- 검증이 끝나면 배치를 확대한다.

세부 절차는 [Phase 2 상세 문서](./phase-2-release-workflow.md)에서 다룬다.

이름/태그 검토 단계는 [Phase 2 review 설계 문서](./phase-2-review-design.md)에서 다루고, 자동 선정, Eagle 승인 태그, proposed batch, published state 구조는 [Phase 2 승인/게시 설계 문서](./phase-2-approval-and-publish-design.md)에서 다룬다.

## 현재 운영 방식 vs 목표 자동화 방식

| 항목 | 현재 상태 | 목표 상태 |
|---|---|---|
| 원본 소스 경로 | 로컬 Eagle 경로를 기준으로 운영 | 환경 변수만 바꿔 NAS 등 다른 경로로 전환 가능 |
| 이름 정리 | 사람이 검토하고 확정 | 자동 후보 생성 + 사람 승인 |
| 태그 부착 | 사람이 판단 후 적용 | 이름 기반 후보 생성 + 예외 수동 검토 |
| 폴더 분류 | 규칙 + 수동 검토 혼합 | 규칙 기반 자동 분류 + 미분류만 수동 검토 |
| Eagle 썸네일 처리 | 별도 썸네일 스크립트 실행 | 동일 워크플로우 자동 호출 가능 |
| AI 메타데이터 보강 | 일부 파일럿/수동 확인 중심 | `aiTags` 없는 항목만 배치 backfill 후 Eagle metadata에 저장 |
| Reflix 배포 | 선택된 범위를 기준으로 점진 확대 예정 | `release batch` 기반으로 안전하게 반복 실행 |

## 관련 코드와 문서

현재 파이프라인을 이해할 때 자주 참조하는 위치는 아래와 같다.

- [Eagle 썸네일 처리 스크립트](/Users/macbook/reflix-nextjs/scripts/eagle-thumbnail-pilot.mjs)
- [Eagle 라이브러리 경로 해석](/Users/macbook/reflix-nextjs/scripts/lib/eagle-library-path.mjs)
- [AI 태깅 backfill 스크립트](/Users/macbook/reflix-nextjs/scripts/ai-tag-backfill.mjs)
- [Eagle metadata 백업/쓰기 유틸](/Users/macbook/reflix-nextjs/scripts/lib/eagle-metadata.mjs)
- [Export 스크립트](/Users/macbook/reflix-nextjs/scripts/export.mjs)
- [AI 태깅 파일럿 비교 스크립트](/Users/macbook/reflix-nextjs/scripts/pilot-ai-tag-compare.mjs)
- [미디어 전략 문서](/Users/macbook/reflix-nextjs/docs/media-strategy.md)
- [기존 Eagle Phase 2 계획](/Users/macbook/reflix-nextjs/docs/superpowers/plans/2026-03-23-eagle-phase2-name-tag-folder-implementation.md)
- [카테고리 기준 데이터](/Users/macbook/reflix-nextjs/src/data/categories.json)

## 이 문서를 유지할 때의 원칙

- 구현 세부사항보다 단계 경계와 책임을 우선 설명한다.
- 새 자동화가 추가돼도 Phase 1과 Phase 2의 경계는 흔들지 않는다.
- 배포 범위는 항상 “전체 원본”이 아니라 “현재 release batch” 기준으로 설명한다.
- 실제 운영 흐름이 바뀌면 이 문서를 먼저 갱신하고, 세부 절차 문서를 그 다음에 맞춘다.
