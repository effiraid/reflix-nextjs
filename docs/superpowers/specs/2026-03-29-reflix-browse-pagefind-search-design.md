# Reflix Browse Pagefind Search Design

## Goal

`/browse` 검색을 “클라이언트가 전체 projection/filter-index를 내려받아 직접 순회하는 방식”에서 “검색 전용 인덱스가 먼저 `clip id`를 찾아주고, browse 화면은 그 ID만 기존 결과 집합에 대입하는 방식”으로 전환한다. 목표는 10k 클립 규모에서 검색 시 전체 JSON 다운로드 병목을 제거하는 것이다.

## Non-Goals

- 이번 단계에서 `/search` 전용 페이지를 키우지 않는다.
- 한국어 `초성 검색`과 `영타→한글 변환`은 유지하지 않는다.
- 태그 패널 내부의 소규모 태그 이름 검색 로직은 바꾸지 않는다.
- browse filter 자체를 서버 왕복형 검색 API로 바꾸지 않는다.

## Current Problems

- 현재 `/browse` 검색은 `ClipDataProvider`가 `/api/browse/cards`와 `/api/browse/filter-index`를 내려받은 뒤, `src/lib/clipSearch.ts`가 전체 배열을 순회하며 점수를 계산한다.
- 첫 진입 idle preload는 제거했지만, 검색을 시작하는 순간에는 여전히 전체 상세 검색 데이터가 필요하다.
- 10k 클립에서는 검색을 하기 위해 전체 검색용 JSON을 통째로 받는 구조 자체가 병목이다.
- 한국어 편의 기능(초성/영타→한글)은 가치 대비 복잡도가 높고, 지금 목표인 10k 안정성과 직접 관련이 없다.

## Constraints

- 검색 UX는 계속 `/browse` 안에서 동작해야 한다.
- 검색과 태그/폴더 필터는 함께 써야 한다.
- 기존 browse card 렌더 구조와 masonry 흐름은 유지한다.
- 검색이 시작될 때 `filter-index.json` 전체 다운로드가 다시 생기면 안 된다.
- 모바일 검색 오버레이와 데스크톱 검색이 같은 검색 엔진 경로를 써야 한다.
- 검색 인덱스는 빌드 파이프라인에 안정적으로 붙어야 한다.

## Chosen Approach

### Option A — 추천안

`/browse` 내부에서 Pagefind를 직접 사용한다. 검색어가 생기면 Pagefind가 먼저 `clip id` 결과를 찾고, browse는 현재 카드/필터 결과에서 그 ID와 교집합만 남긴다. 한국어 `초성 검색`, `영타→한글 변환`은 이번 전환에서 제거한다.

채택 이유:

- 10k 대응의 핵심 병목인 “검색 시 전체 JSON 다운로드”를 바로 제거할 수 있다.
- `/search` 페이지를 새로 키우지 않아도 되어 범위가 명확하다.
- 검색 품질보다 성능 구조 전환이 지금은 더 중요하다.
- 초성/영타 기능을 빼면 Pagefind 기본 구조를 그대로 사용할 수 있어 구현과 유지보수가 단순해진다.

### Rejected Alternatives

#### Option B — `/browse` + Pagefind + 초성 보조 로직 유지

Pagefind를 기본으로 쓰되 초성/영타 변환만 별도 로컬 matcher로 보완한다.

기각 이유:

- 보완 로직이 잘못 설계되면 다시 전체 dataset 의존이 생길 수 있다.
- 지금 단계에서는 기능 이득보다 복잡도 증가가 더 크다.

#### Option C — `/search` 전용 Pagefind 페이지 도입

검색은 별도 `/search` 페이지로 분리하고 `/browse`는 필터 중심 화면으로 유지한다.

기각 이유:

- 사용자가 원하는 동선과 다르다.
- 검색 UX를 두 군데로 나누면 구현량이 커지고, `/browse`와 결과 일관성을 맞추기 어려워진다.

## Approved Architecture

### 1. `/browse` 검색은 Pagefind 결과 ID를 기준으로 동작한다

검색어가 비어 있으면 기존처럼 browse 카드 목록만 사용한다.

검색어가 있으면:

1. Pagefind에 검색어를 전달한다.
2. Pagefind가 `clip id` 목록을 반환한다.
3. browse 화면은 현재 카드/필터 결과에서 해당 ID만 남긴다.

즉 검색은 “로컬 배열 점수 계산”이 아니라 “Pagefind 결과 ID 기반 필터링”으로 바뀐다.

### 2. 필터와 검색은 교집합으로 결합한다

검색과 필터의 책임을 분리한다.

- 폴더/태그/카테고리/보드 같은 구조 필터는 기존 browse 로직이 처리한다.
- 텍스트 검색은 Pagefind가 처리한다.
- 최종 결과는 두 결과의 교집합이다.

정책:

- 필터만 있으면 기존 결과를 그대로 사용한다.
- 검색만 있으면 Pagefind 결과 ID에 해당하는 카드만 보인다.
- 둘 다 있으면 “필터 결과 중 검색에 걸린 카드만” 보인다.

### 3. 검색용 상세 projection 전체 다운로드를 제거한다

`/browse` 검색은 더 이상 `/api/browse/filter-index` 전체 payload에 의존하지 않는다.

이후 구조:

- 첫 진입: 가벼운 cards payload만 사용
- 검색 입력: Pagefind 인덱스 질의
- 결과 렌더: cards lookup + Pagefind result ids

즉 검색을 위해 `filter-index.json` 전체를 클라이언트로 가져오는 경로는 끊는다.

### 4. 모바일 검색과 데스크톱 검색은 같은 엔진을 쓴다

모바일 오버레이와 데스크톱 navbar 검색은 같은 search adapter를 사용해야 한다.

필수 조건:

- 같은 검색어에 같은 결과 순서를 낸다.
- 한쪽만 legacy local search를 쓰는 상태를 허용하지 않는다.
- 검색 결과 렌더는 카드용 최소 display envelope만 쓴다.

### 5. 한국어 초성/영타→한글은 제거한다

이번 전환에서 아래 기능을 제거한다.

- `getChoseong()` 기반 초성 검색
- `convertQwertyToHangul()` 기반 영타→한글 변환

남는 동작:

- 일반 한글 부분 검색
- 일반 영어 검색
- Pagefind 기본 relevance 정렬

이 결정은 “검색 편의보다 10k 구조 전환이 우선”이라는 우선순위에 따른다.

## Data and Build Pipeline

### 1. Pagefind 인덱스는 빌드 시 생성한다

빌드 완료 후 Pagefind 인덱스를 생성하는 단계를 추가한다.

필수 결과물:

- 정적 인덱스 파일이 build output과 함께 배포된다.
- preview/prod 모두 같은 빌드 파이프라인을 사용한다.

### 2. Pagefind source body는 clip detail이 아니라 search-safe text로 제한한다

인덱스 소스는 검색에 필요한 텍스트만 포함해야 한다.

우선 포함 후보:

- clip name
- 수동 태그
- 구조화 AI tag
- 검색용 토큰(`searchTokens`)이 계속 필요하면 그 압축 텍스트

이번 단계에서는 `aiTags.description` 전체를 반드시 넣을 필요는 없다. 인덱스 크기와 품질을 보며 최소 필드로 시작한다.

### 3. cards lookup은 계속 browse의 렌더 source다

Pagefind는 결과 ID를 찾는 용도이고, 실제 카드 렌더는 기존 `cards.json` 기반 lookup을 계속 사용한다.

이유:

- 인덱스가 렌더용 데이터까지 책임지면 구조가 다시 복잡해진다.
- browse card 렌더는 기존 데이터 계약을 최대한 유지하는 편이 안전하다.

## Runtime Behavior

### Browse First Load

1. `/browse` 첫 진입
2. cards 기반 초기 카드 렌더
3. 검색어가 없으면 Pagefind 로드 없음

### Search Activation

1. 사용자가 검색어 입력
2. Pagefind runtime/인덱스 로드
3. 검색 결과 ID 획득
4. cards lookup + 기존 필터 결과와 교집합 적용
5. masonry/grid 업데이트

### Search Clear

검색어를 지우면 즉시 일반 browse 결과로 돌아간다.

## File Ownership

이번 설계에서 바뀔 가능성이 높은 핵심 파일은 아래다.

- `package.json`
- `src/app/[lang]/browse/BrowseClient.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/MobileSearchOverlay.tsx`
- `src/lib/clipSearch.ts`
- `src/lib/filter.ts`
- `src/lib/search.ts`
- `src/lib/browse-service.ts`
- `src/lib/types.ts`

필요하면 별도 adapter/helper를 추가해도 되지만, 기존 browse 구조를 깨지 않도록 책임 경계는 명확히 나눈다.

## Verification

### Functional Verification

- `/browse`에서 검색이 정상 동작한다.
- 검색 + 태그/폴더/보드 필터를 같이 써도 결과가 맞다.
- 모바일 검색 오버레이도 같은 결과를 보여준다.
- 검색어를 지우면 기본 browse 상태로 즉시 돌아간다.

### Network Verification

- 첫 진입에서 `/api/browse/filter-index` 전체 다운로드가 발생하지 않는다.
- 검색 시작 시 `filter-index.json` 전체 fetch가 다시 생기지 않는다.
- 검색 시 Pagefind 관련 정적 인덱스 요청만 발생한다.

### Build Verification

- `npm run build`가 인덱스 생성까지 포함해 통과한다.
- preview/prod 배포에서 인덱스 파일이 빠지지 않는다.

## Migration Notes

- 기존 `src/lib/search.ts`의 초성/영타 유틸은 이번 단계에서 삭제되거나, 더 이상 browse 검색 경로에서 사용되지 않게 된다.
- 기존 `clipSearch.ts`의 score 기반 전체 배열 검색은 browse 검색에서 제거한다.
- 태그 패널 내부처럼 “클립 전체가 아니라 작은 태그 목록”을 검색하는 곳은 기존 matcher를 그대로 유지해도 된다.

## Success Criteria

- `/browse` 검색이 더 이상 전체 상세 검색 JSON 다운로드에 의존하지 않는다.
- 검색은 Pagefind 기반 ID 검색으로 바뀐다.
- 검색과 필터는 교집합으로 정확히 동작한다.
- 초성/영타→한글 제거가 코드와 UX에 일관되게 반영된다.
- 빌드와 배포 파이프라인이 인덱스 생성까지 안정적으로 포함한다.
