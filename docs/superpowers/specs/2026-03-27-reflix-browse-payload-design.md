# Reflix Browse Payload Design

## Goal

`browse`의 첫 진입 payload를 10k 클립 규모에서도 가볍게 유지하면서, 검색/필터는 “projection이 준비된 뒤 로컬에서 즉시 반응”하는 경험을 유지한다. 무거운 메타데이터는 브라우즈 목록에 싣지 않고, 선택 시점에만 개별 클립 detail을 lazy load 한다.

## Constraints

- 현재 브라우즈의 핵심 UX인 masonry grid + 빠른 탐색 감각은 유지한다.
- 검색/필터마다 서버 왕복이 발생하는 구조로 바꾸지 않는다.
- 브라우즈 route가 detail-grade metadata 전체를 client boundary로 넘기지 않는다.
- 오른쪽 패널 / quick view / detail page는 선택된 클립 기준으로만 무거운 정보를 읽는다.
- 기존 클립 detail JSON(`public/data/clips/{id}.json`) 계약은 가능한 한 유지한다.
- URL 기반 deep-link browse (`/browse?...`)는 계속 동작해야 한다.

## Current Problems

- `src/app/[lang]/browse/page.tsx`가 전체 clip index를 읽고 client provider로 넘긴다.
- 현재 `ClipIndex`는 `aiTags.description`까지 포함할 수 있어 browse payload가 detail에 가까워질 수 있다.
- 모바일 검색은 full dataset 기준으로 전부 렌더링해 결과 수가 커질 때 비용이 커진다.
- 브라우즈 안의 여러 패널이 동일한 전체 dataset를 공유하므로, 첫 payload와 hydration 비용이 dataset 크기에 비례한다.
- 무거운 정보와 가벼운 정보의 경계가 흐려서, browse / search / detail이 같은 덩어리에 묶여 있다.

## Approved Architecture

### 1. Data Boundary를 세 층으로 분리한다

브라우즈 관련 데이터는 아래 세 층으로 나눈다.

#### A. Browse Summary

브라우즈 카드 렌더링에 필요한 최소 정보만 가진다.

포함 필드:

- `id`
- `name`
- `thumbnailUrl`
- `previewUrl`
- `lqipBase64`
- `width`
- `height`
- `duration`
- `star`
- `category`

원칙:

- 기본 browse 그리드와 기본 정렬/페이지 렌더링은 이 summary envelope만으로 가능해야 한다.
- summary에는 `aiTags.description`, `annotation`, `palettes`, `relatedClips`를 넣지 않는다.

#### B. Browse Search Projection

검색/필터에 필요한 경량 데이터다. projection은 로컬 검색을 유지하기 위해 client에서 보관할 수 있지만, browse 첫 진입 payload에는 포함하지 않는다.

포함 필드:

- `id`
- 검색/필터용 manual tags
- 구조화된 AI tags
- folders
- sort/filter에 필요한 scalar fields (`star`, `category`, 이름 정렬용 필드)
- 검색 결과를 즉시 렌더링하기 위한 compact display envelope
  - `name`
  - `thumbnailUrl`
  - `previewUrl`
  - `lqipBase64`
  - `width`
  - `height`
  - `duration`
  - `star`
  - `category`

원칙:

- projection은 “검색/필터용 browse data”이지 detail data가 아니다.
- full AI description은 projection에 넣지 않는다.
- 검색 품질 유지가 필요한 경우 description을 통째로 넣는 대신 export 시 tokenized searchable fields로 압축한다.
- projection은 이후 shard로 확장 가능해야 하지만, 10k 1차 목표에서는 단일 파일 또는 단순 manifest 구조도 허용한다.

#### C. Clip Detail

선택된 클립에 대해서만 읽는 개별 JSON이다.

포함 필드:

- 현재 `Clip`이 가진 detail-grade metadata 전체
- `aiTags.description`
- `annotation`
- `palettes`
- `relatedClips`
- 기타 상세 페이지 / inspector / quick view에 필요한 필드

원칙:

- 브라우즈 목록은 detail을 미리 들고 있지 않는다.
- 상세 정보는 오른쪽 패널 / quick view / detail page에서 개별적으로 읽는다.

### 2. First Load는 Summary만 사용한다

`/[lang]/browse` 진입 시 서버는 전체 index를 import 하지 않는다.

대신:

- 서버가 browse query를 파싱한다.
- 서버는 summary / projection 기반 browse service를 호출해 첫 page 결과만 계산한다.
- client에는 “현재 query의 첫 page 결과 + 최소 facet 상태 + projection loading 상태”만 넘긴다.

이 구조의 목적:

- route payload를 작게 유지한다.
- deep-link query가 있는 경우에도 첫 paint를 서버가 책임질 수 있게 한다.
- 전체 browse corpus가 client boundary로 넘어가는 경로를 없앤다.

### 3. Projection은 Background에서 Preload 한다

브라우즈 페이지가 안정된 뒤 background에서 projection을 preload 한다.

동작:

1. 브라우즈 route hydration 완료
2. idle 시점 또는 low-priority effect에서 projection fetch 시작
3. projection 준비 완료 후 search/filter local engine 활성화

정책:

- 추천 기본값은 “페이지 진입 직후 background preload”다.
- projection이 아직 준비되지 않은 상태에서 사용자가 검색/필터를 열면, UI는 즉시 loading state를 보여주고 projection 준비 후 결과를 반영한다.
- 키 입력마다 서버 왕복을 추가하지 않는다.

### 4. Search / Filter는 Projection 준비 이후 Local로 동작한다

projection이 준비된 뒤에는 검색/필터는 client에서 local로 처리한다.

이유:

- 사용자는 검색/필터가 즉시 반응하길 기대한다.
- 10k 규모에서는 properly shaped projection을 local로 다루는 비용이, detail-grade full index를 들고 있는 비용보다 작다.

세부 정책:

- 검색 결과 리스트는 projection의 compact display envelope를 사용해 바로 렌더링한다.
- 결과 수가 많아도 모바일 검색 오버레이는 결과 수 제한 또는 virtualization을 적용한다.
- browse 본문 masonry는 여전히 virtualization된 렌더링을 유지한다.

### 5. Selection은 Detail Lazy Load로 통일한다

클립 선택 이후의 무거운 정보는 공통 detail loader 경로로 가져온다.

적용 대상:

- 오른쪽 패널
- quick view
- 상세 페이지

정책:

- 선택된 `clipId` 기준으로 `public/data/clips/{id}.json`을 읽는다.
- 이미 로드한 detail은 cache 해 재선택 시 즉시 표시한다.
- 빠른 키보드 이동 중 불필요한 중복 요청이 생기지 않도록 abort/cancel 또는 last-write-wins 정책을 둔다.

### 6. Deep-Link Browse는 Server Query로 첫 결과를 만든다

`/browse?q=...&tags=...` 같은 진입도 첫 응답부터 의미 있는 결과를 보여줘야 한다.

따라서 서버 browse service는 아래를 지원해야 한다.

- 초기 query parse
- 첫 page result 계산
- total count / next cursor 계산
- 초기 facet 계산 또는 최소한 현재 query 기준 count 계산

이때 server-side browse query는 projection을 filesystem 기반으로 읽어 계산한다. 중요한 점은 “filesystem read”이지 “bundle import”가 아니라는 것이다.

## Data Artifacts

### Export Output

export는 기존 `public/data/clips/{id}.json` 외에 아래 browse artifacts를 생성한다.

- `public/data/browse/summary.json`
- `public/data/browse/projection.json`
- 필요 시 향후 확장 가능한 `manifest.json`

10k 1차에서는 단순 JSON 구조를 허용한다. 다만 file contract는 나중에 shard로 바꾸더라도 loader interface가 유지되도록 설계한다.

### Loader Boundary

앱 코드에서 `src/data/index.json`을 직접 import 하는 경로는 제거한다.

대신:

- server browse service는 `public/data/browse/*`를 read 한다.
- client projection loader는 `public/data/browse/projection.json`을 fetch 한다.
- detail loader는 `public/data/clips/{id}.json`을 fetch/read 한다.

## Runtime Behavior

### Browse Route

1. 서버가 현재 query를 읽는다.
2. browse service가 첫 result page를 만든다.
3. 첫 page card list만 client로 전달한다.
4. client는 즉시 grid를 렌더링한다.
5. background에서 projection preload를 시작한다.

### Search / Filter

- projection 준비 전: loading/prepare state
- projection 준비 후: local search/filter
- 모바일 검색: unbounded render 금지
- 결과 card는 compact display envelope로 그린다.

### Selection

- 사용자가 클립을 선택한다.
- UI는 기존 summary card context를 유지한다.
- 오른쪽 패널 / quick view / detail page는 selected clip detail을 lazy load 한다.
- detail load 실패 시 브라우즈 목록은 유지되고 패널만 degrade 된다.

## Rollout

### Phase 1: Artifact Generation

- export에서 summary / projection artifacts를 추가 생성한다.
- 기존 browse는 아직 유지한다.
- 신규 artifacts에 대한 테스트를 먼저 붙인다.

### Phase 2: Browse Initial Payload Cutover

- `src/data/index.json` 직접 import 경로를 browse에서 제거한다.
- browse route는 첫 page server query 결과만 주입한다.
- projection preload 및 local search 엔진을 연결한다.

### Phase 3: Detail Lazy Load Unification

- 오른쪽 패널 / quick view / detail page를 공통 detail loading 정책으로 맞춘다.
- 기존 full-index 의존 browse UI 경로를 정리한다.
- 모바일 검색 결과 rendering guard를 적용한다.

## Files Likely Affected

- `src/app/[lang]/browse/page.tsx`
- `src/app/[lang]/browse/BrowseClient.tsx`
- `src/app/[lang]/browse/ClipDataProvider.tsx`
- `src/app/[lang]/browse/LeftPanelContent.tsx`
- `src/components/filter/TagFilterPanel.tsx`
- `src/components/layout/MobileSearchOverlay.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/RightPanelContent.tsx`
- `src/lib/data.ts`
- `src/lib/filter.ts`
- `src/lib/clipSearch.ts`
- `src/lib/types.ts`
- `scripts/lib/index-builder.mjs`
- `scripts/export.mjs`

## Risks

- projection을 너무 공격적으로 줄이면 검색 품질이 떨어질 수 있다.
- projection과 detail의 태그 의미가 어긋나면 브라우즈와 상세가 다른 결과를 보일 수 있다.
- initial deep-link query와 client-side local filter 결과가 불일치하면 UX 신뢰가 깨진다.
- selection detail fetch가 잦아질 경우 cache / abort 제어가 없으면 패널이 흔들릴 수 있다.

## Testing

### Unit

- summary / projection artifact generation
- browse loader가 `src/data/index.json` import 없이 동작하는지
- local search/filter가 projection 기준으로 동일한 결과를 내는지
- detail lazy loader cache / cancellation behavior

### Integration

- `/browse` 기본 진입 시 첫 payload가 detail-heavy full index를 포함하지 않는지
- deep-link query 진입 시 첫 page가 맞는지
- projection preload 전/후 검색 UX가 기대대로 동작하는지
- 오른쪽 패널 / quick view가 개별 detail 로드로 동작하는지

### Benchmark

- 10k synthetic dataset 기준 initial browse payload
- projection fetch 크기
- projection 준비 이후 한국어/영어 query latency
- 모바일 검색 결과 rendering cost

## Not In Scope

- 서버 검색 엔진 도입
- DB-backed catalog repository
- 100k / 1M 규모의 최종 shard/DB cutover
- unrelated taxonomy refactor
- unrelated browse UI redesign
