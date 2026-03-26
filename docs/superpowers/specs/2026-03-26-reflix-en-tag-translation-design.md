# Reflix — 영어 태그 AI 번역 파이프라인 설계

## 문제

Reflix는 `ko`와 `en` 언어 전환을 지원하지만, 실제 태그 경험은 아직 완전히 이중언어화되어 있지 않다.

- 수동 태그는 `src/data/tag-i18n.json`이 있는 경우에만 일부 영어로 표시된다.
- AI 구조화 태그(`aiTags.actionType`, `emotion`, `composition`, `pacing`, `characterType`, `effects`)는 영어 모드에서도 한국어 원문이 그대로 노출된다.
- 상세 페이지와 우측 패널의 태그 칩은 raw 문자열을 직접 렌더링하는 구간이 있어 영어 모드에서도 한국어 태그가 그대로 보인다.
- 검색과 필터는 한국어 canonical tag를 기준으로 동작하고 있어, 영어 UI 경험과 데이터 저장 형식이 분리되어 있지 않다.

사용자 관점에서의 문제는 명확하다. `en`으로 언어를 바꿨는데 태그가 한국어로 남아 있다. 이 상태에서는 영어 UI의 완성도가 낮고, AI 분석 카드의 의미도 영어 사용자에게 충분히 전달되지 않는다.

## 목표

- 영어 모드에서 수동 태그와 AI 태그를 모두 영어 라벨로 표시한다.
- 태그 번역은 자동 반영된다. 별도 수동 승인 단계는 두지 않는다.
- 번역 전 단계에서 명시적 규칙을 적용해 AI 결과의 일관성을 높인다.
- 저장용 canonical tag는 한국어로 유지해 기존 데이터, URL, 필터 상태, Eagle 메타데이터를 깨지 않는다.
- manual tag와 AI structured tag가 같은 의미면 영어 모드에서 같은 canonical English label을 보이게 한다.
- 검색과 필터도 영어 태그 라벨을 이해하도록 보강한다.

## 비목표

- Eagle 메타데이터의 원본 `tags`를 영어로 치환하지 않는다.
- 한국어 canonical tag 체계를 영어 canonical tag 체계로 마이그레이션하지 않는다.
- 초기에 사람이 모든 태그 번역 사전을 완비해야 하는 구조로 가지 않는다.
- build/export 경로에 AI 호출을 강제로 끼워 넣지 않는다.

## 현재 확인된 사실

### 데이터 계층

- `src/data/tag-i18n.json`은 현재 한국어 수동 태그를 영어 라벨로 바꾸는 단순 맵이다.
- `src/lib/data.ts`의 `getTagI18n()`은 런타임에서 이 파일을 읽는다.
- `src/data/index.json`에는 `clip.tags` 외에 `aiTags`가 들어갈 수 있다.
- `src/lib/aiTags.ts`는 `aiTags`를 UI와 검색용 태그 집합으로 합치는 역할을 한다.

### UI 계층

- `src/components/filter/TagFilterPanel.tsx`는 `clip.tags`에 대해서만 `tagI18n`을 이용해 영어 라벨을 표시한다.
- `src/components/layout/RightPanelInspector.tsx`는 `clip.tags`와 `aiTags` 구조화 태그를 raw 문자열로 렌더링한다.
- `src/components/clip/ClipDetailView.tsx`도 `clip.tags`를 raw 문자열로 렌더링한다.
- 결과적으로 영어 모드에서도 일부는 번역되고, 일부는 한국어가 그대로 노출되는 불일치가 있다.

### 검색 계층

- `src/lib/clipSearch.ts`와 `src/lib/aiTags.ts`는 수동 태그 번역을 검색 후보에 포함하지만, AI 구조화 태그 자체에 대한 영어 라벨 사전은 없다.
- 따라서 영어 설명(`description.en`)은 검색 가능해도, 영어 태그 칩과 영어 태그 검색 경험은 완성되지 않았다.

## 핵심 결정

### 1. 한국어 태그를 canonical source로 유지한다

저장, URL, 필터 상태, Eagle 메타데이터, `index.json`의 태그 값은 계속 한국어를 기준으로 유지한다.

이 결정의 이유는 세 가지다.

1. 기존 데이터와 링크를 깨지 않는다.
2. Eagle 라이브러리 운영 흐름과 앱 런타임을 분리할 수 있다.
3. 번역 품질이 흔들리더라도 저장층은 안정적으로 유지된다.

즉, `?tag=고통` 같은 URL은 그대로 두고, 영어 UI에서는 이를 `Suffering`으로 표시한다.

### 2. 번역은 `규칙 우선 + AI fallback`으로 간다

AI만으로 태그를 번역하면 같은 한국어 태그가 실행마다 다른 영어 표현을 가질 가능성이 높다. 현재 태그 분포도 `힘듦`, `지침`, `힘겨움`, `괴로움`, `비틀비틀`, `비틀거리기`처럼 서로 가까운 표현이 많아, 규칙 없이 AI만 쓰면 용어가 쉽게 흔들린다.

따라서 번역 순서는 다음과 같이 고정한다.

1. 고정 번역 사전 적용
2. 보존 규칙 적용
3. 정규화 규칙 적용
4. 기존 캐시 재사용
5. 남은 태그만 AI 번역
6. 후처리 검증
7. `src/data/tag-i18n.json` 갱신

### 3. 영어 출력은 설명문이 아니라 짧은 canonical UI label로 제한한다

영어 태그의 톤은 검색 설명형 문장이 아니라 UI 칩용 canonical label로 통일한다.

- 1-3단어 권장
- `Title Case`
- 불필요한 관사 제거
- 너무 긴 설명 금지

예:

- `비틀거리기` → `Staggering`
- `미디엄샷` → `Medium Shot`
- `피로감` → `Fatigue`

## 제안 구조

구현은 `규칙 파일`, `번역 생성 명령`, `런타임 표시 helper` 세 층으로 나눈다.

### 번역 규칙 파일

초기 구현은 규칙 파일을 별도로 둔다.

- `scripts/config/tag-translation-rules.json`

이 파일은 최소한 다음 섹션을 가진다.

- `glossary`
  - 고정 번역 사전
- `preserve`
  - 번역하지 않고 그대로 유지할 태그
- `normalize`
  - 입력 정규화용 규칙
- `style`
  - 출력 형식 제한

### `glossary`

자주 쓰이는 태그, 도메인 고정 용어, 이미 팀이 선호하는 표현을 강제한다.

예:

- `고통` → `Suffering`
- `연출` → `Direction`
- `마법사` → `Mage`

### `preserve`

다음 항목은 AI에 보내지 않고 원문 유지 또는 규칙 유지한다.

- 숫자
- 약어
- 이미 영문인 태그
- 브랜드/작품명/고유명사

예:

- `Arcane`
- `2D`
- `POV`
- `PV`

초기에는 규칙 파일에 직접 넣고, 이후 필요하면 자동 감지 규칙을 추가한다.

### `normalize`

정규화는 aggressive synonym merge가 아니라, 먼저 형태 차이만 줄이는 보수적 정규화로 시작한다.

예:

- `비틀비틀` → `비틀거리기`
- `일어서기` → `일어나기`

이 정규화는 저장층을 바꾸기 위한 것이 아니라, 영어 라벨의 일관성을 높이기 위한 사전 처리다.

### `style`

AI 결과와 규칙 결과 모두 다음 형식을 만족해야 한다.

- 빈 문자열 금지
- 양끝 공백 제거
- 1-3단어 권장
- `Title Case`
- 불필요한 구두점 제거

## 번역 생성 파이프라인

번역은 별도 운영 명령으로 생성한다.

권장 명령:

- `npm run tags:translate`

이 명령은 다음 순서로 동작한다.

1. `src/data/index.json`에서 manual tag와 AI structured tag를 모두 수집한다.
2. 정규화 전 원본과 정규화 후 canonical key를 함께 만든다.
3. `glossary`, `preserve`, `normalize`를 먼저 적용한다.
4. `src/data/tag-i18n.json`의 기존 값을 캐시로 사용한다.
5. 아직 영어 라벨이 없는 항목만 AI 모델에 보낸다.
6. 결과를 후처리 검증한다.
7. 최종 맵을 정렬된 JSON으로 `src/data/tag-i18n.json`에 저장한다.

기본 동작은 증분 갱신이다.

- 기존 번역은 재사용
- 새 태그만 AI 호출
- 규칙이 바뀐 태그만 다시 계산 가능

운영 옵션은 다음 정도가 적절하다.

- `--dry-run`
- `--only-new`
- `--clip-id <id>`
- `--write`

## AI 입력/출력 계약

AI는 전체 문맥을 주는 번역기가 아니라, 남은 태그에 대한 canonical label 생성기로 제한한다.

입력:

- 한국어 원문 태그
- 필요하면 정규화 전 원문
- 이미 확정된 glossary 예시 몇 개
- 출력 스타일 규칙

출력:

- `{ "<ko-tag>": "<en-label>" }` 형태의 JSON 맵

AI가 description을 생성하거나 새로운 taxonomy를 만들게 하지 않는다. 이번 단계의 AI 역할은 오직 영어 라벨 보완이다.

## 런타임 표시 설계

### 원칙

- 내부 키는 항상 한국어
- 표시 라벨만 현재 locale에 따라 다르게 계산
- manual tag와 AI structured tag 모두 동일한 번역 함수를 사용

권장 helper:

- `getTagDisplayLabel(tag, lang, tagI18n)`

동작:

- `lang === "ko"`면 원문 반환
- `lang === "en"`이면 `tagI18n[tag] ?? tag` 반환

### 적용 범위

#### 1. 우측 패널

`src/components/layout/RightPanelInspector.tsx`

- `clip.tags`
- `getStructuredAiTags(clip.aiTags)`

둘 다 영어 모드에서 번역 라벨을 사용해 렌더링한다.

#### 2. 상세 페이지

`src/components/clip/ClipDetailView.tsx`

- `clip.tags`
- 필요하면 AI 태그 노출 영역 추가 시 동일 helper 재사용

#### 3. 태그 필터 패널

`src/components/filter/TagFilterPanel.tsx`

기존 수동 태그 번역 로직을 유지하되, AI structured tag에도 같은 helper를 적용한다.

#### 4. 선택/제외 태그 배지

현재 필터 상태는 한국어 tag key를 유지하고, 렌더링 시에만 영어 label로 보여준다.

## 검색 설계

영어 모드에서는 영어 번역 라벨도 검색 후보에 들어가야 한다.

검색 후보는 다음을 포함한다.

- clip name
- 한국어 수동 태그
- 영어 수동 태그 라벨
- 한국어 AI structured tag
- 영어 AI structured tag 라벨
- AI 설명 `description.ko`
- AI 설명 `description.en`

즉, 영어 사용자가 `Fatigue`, `Mage`, `Medium Shot` 같은 검색어를 입력하면 해당 클립을 찾을 수 있어야 한다.

단, 실제 필터 적용 시 사용하는 값은 계속 한국어 canonical key다.

## 운영 흐름

초기 운영은 export/build 경로에 AI를 강제 연결하지 않는다.

권장 순서:

1. Eagle 또는 export로 최신 `src/data/index.json` 생성
2. `npm run tags:translate` 실행
3. `src/data/tag-i18n.json` 갱신
4. 앱 실행 또는 배포

이렇게 분리하는 이유는 다음과 같다.

- AI 키가 없는 환경에서도 export는 돌아가야 한다.
- 번역 비용과 지연을 build 시간에 강제하지 않는다.
- 번역 품질 문제를 데이터 생성 단계에서 독립적으로 다룰 수 있다.

향후 안정화되면 export 후속 단계에 연결할 수 있지만, 초기에는 별도 명령이 안전하다.

## 실패 처리와 폴백

AI 번역은 실패 가능성을 전제로 설계한다.

### 실패 사례

- 모델 응답 파싱 실패
- 빈 문자열 반환
- 한글이 남은 영어 라벨 반환
- 너무 긴 문장형 결과 반환
- 기존 번역을 불필요하게 덮어쓰는 결과

### 실패 시 규칙

1. 기존 `tag-i18n.json` 값이 있으면 유지한다.
2. 새 값을 검증 통과한 경우에만 반영한다.
3. 새 값이 없으면 영어 UI에서 마지막 폴백으로 원문 태그를 보여준다.
4. `preserve` 대상은 실패 여부와 무관하게 규칙 값을 우선한다.

## 품질 기준

- 같은 한국어 태그는 항상 같은 영어 라벨을 가진다.
- manual tag와 AI structured tag가 같은 의미면 같은 영어 라벨을 가진다.
- 영어 모드의 우측 패널, 상세 페이지, 태그 필터, 검색이 같은 번역 맵을 사용한다.
- 한국어 모드의 기존 동작은 바뀌지 않는다.
- 저장층의 태그 값은 그대로 유지된다.

## 테스트 기준

### 규칙/데이터 테스트

- glossary가 AI보다 우선 적용되는지
- normalize가 동일 의미 태그를 한 영어 라벨로 모으는지
- preserve 대상이 번역되지 않는지
- 기존 `tag-i18n.json` 값이 불필요하게 덮어써지지 않는지

### 검색 테스트

- 영어 manual tag 라벨로 검색 가능한지
- 영어 AI structured tag 라벨로 검색 가능한지
- 영어 설명과 영어 태그가 함께 검색 후보에 들어가는지

### UI 테스트

- 영어 모드 우측 패널에서 manual tag가 영어로 보이는지
- 영어 모드 우측 패널에서 AI 태그 칩이 영어로 보이는지
- 영어 모드 상세 페이지에서 태그가 영어로 보이는지
- 영어 모드 태그 필터 패널과 선택 태그 배지가 영어 라벨을 쓰는지

## 영향받는 파일

이번 설계가 구현되면 주로 다음 파일들이 영향을 받는다.

- `scripts/config/tag-translation-rules.json`
- `scripts/lib/*` 아래 번역 파이프라인용 스크립트
- `package.json`
- `src/data/tag-i18n.json`
- `src/lib/aiTags.ts`
- `src/lib/clipSearch.ts`
- `src/components/filter/TagFilterPanel.tsx`
- `src/components/layout/RightPanelInspector.tsx`
- `src/components/clip/ClipDetailView.tsx`

## 결정 요약

- 저장 canonical tag는 한국어 유지
- 영어 UI는 공용 번역 맵을 사용
- 번역 생성은 `규칙 우선 + AI fallback`
- 자동 반영하되 검수 단계는 두지 않음
- 초기 운영은 별도 `tags:translate` 명령으로 분리
