# 검색 전략 (Search Strategy)

## 현재 구현 (2026-03-25)

언어별 특화 검색을 통해 한국어/영어 각각의 사용자 경험을 최적화한다.

### 아키텍처

```
filterClips()
  ├── 1. 카테고리 필터
  ├── 2. 폴더 필터
  ├── 3. 태그 필터 (AND)
  ├── 4. 별점 필터
  └── 5. 검색 쿼리 ← lang별 matcher 분기
```

검색 로직은 `src/lib/search.ts`에 격리되어 있으며, `createMatcher(lang, query)` 팩토리가 언어별 매칭 함수를 반환한다.

### 한국어 (`/ko`) — es-hangul

| 기능 | 예시 | 설명 |
|------|------|------|
| 일반 매칭 | `마법` → "마법" | `includes()` 기본 매칭 |
| 초성 검색 | `ㅁㅂ` → "마법" | `getChoseong()` 활용 |
| 영타→한글 변환 | `rja` → "검" | `convertQwertyToHangul()` 활용 |

패키지: [`es-hangul`](https://github.com/toss/es-hangul) (Toss)

### 영어 (`/en`) — microfuzz

| 기능 | 예시 | 설명 |
|------|------|------|
| 정확 매칭 | `sword` → "Sword" | 대소문자 무시 |
| 부분 매칭 | `mag` → "Magic" | prefix/contains |
| 퍼지 매칭 | `magc` → "Magic" | 오타 허용 (smart strategy) |

패키지: [`@nozbe/microfuzz`](https://github.com/Nozbe/microfuzz) (~1KB)

### 적용 위치

| 파일 | 역할 |
|------|------|
| `src/lib/search.ts` | `matchesKorean()`, `matchesEnglish()`, `createMatcher()` |
| `src/lib/filter.ts` | 클립 검색 (`filterClips` 내 검색 블록) |
| `src/components/filter/TagFilterPanel.tsx` | 태그 패널 내 검색 |
| `src/components/layout/SubToolbar.tsx` | 메인 검색바 (IME 처리 포함) |

### IME 처리

한글 입력 시 조합 중 검색 방지를 위해 `onCompositionStart/End` + `isComposingRef` 패턴을 사용한다. SubToolbar와 TagFilterPanel 양쪽에 적용되어 있다.

---

## 라이브러리 선택 근거

### es-hangul

한국어 검색에서 초성 검색은 카카오/네이버급 기본 UX. 영타→한글 변환은 키보드 전환 실수를 자연스럽게 커버.

### microfuzz (vs Fuse.js)

| 기준 | microfuzz | Fuse.js |
|------|-----------|---------|
| 번들 크기 | ~1KB | ~15KB |
| API 적합성 | `fuzzyMatch(text, query)` → 필터 체인에 1:1 | 리스트 기반 — 필터 파이프라인 구조 변경 필요 |
| 커뮤니티 | 작음 (GitHub 250★) | 큼 (GitHub 19.8K★) |
| 유지보수 | 리스크 있음 (릴리즈 1회) | 안정적 |

**선택 이유:** 현재 `filterClips()` 파이프라인이 클립을 순회하며 개별 필드에 match/no-match를 판단하는 구조이므로, 문자열 단위 매칭 함수(`fuzzyMatch`)가 자연스럽게 맞는다. Fuse.js는 리스트를 통째로 넘기는 설계라 래퍼를 만들면 10만 클립에서 인스턴스 50만 번 생성 문제가 발생한다.

**리스크 완화:** microfuzz가 deprecated 되더라도 교체 범위는 `search.ts`의 `matchesEnglish()` 한 함수뿐.

---

## 스케일링 전략

### 현재 클라이언트 사이드 검색의 한계

| 클립 수 | 예상 성능 | 판단 |
|---------|----------|------|
| ~1,000 | < 10ms | 문제 없음 |
| ~10,000 | ~50ms | 허용 가능 |
| ~100,000 | ~300ms+ | 체감 지연, 전환 시점 |
| ~1,000,000 | 수 초 | 사용 불가 |

### 전환 계획: Pagefind

데이터가 1만 건을 넘기거나 JSON 전체 로드가 느려지기 시작하면 [Pagefind](https://pagefind.app/)로 전환한다.

**Pagefind 특징:**
- 빌드 타임에 정적 인덱스 생성 → 서버 불필요 (SSG 아키텍처와 동일)
- CJK 세그멘테이션 내장
- 영어 fuzzy search 내장
- 필요한 인덱스 청크만 로드 (전체 JSON 로드 불필요)

**전환 시 변경 범위:**

```ts
// before
if (filters.searchQuery) {
  const match = createMatcher(lang, filters.searchQuery);
  result = result.filter(c => match(c.name) || c.tags.some(...));
}

// after
if (filters.searchQuery) {
  const searchResults = await pagefind.search(filters.searchQuery);
  const matchedIds = new Set(searchResults.map(r => r.id));
  result = result.filter(c => matchedIds.has(c.id));
}
```

폴더/태그/별점 필터는 그대로 유지. `search.ts` + `filter.ts` 검색 블록만 교체.

**주의:** Pagefind는 초성 검색을 지원하지 않으므로 한국어 초성 매칭은 별도 처리가 필요하다 (es-hangul 유지 또는 인덱스에 초성 데이터 포함).

---

## 미래 고려사항

| 사항 | 긴급도 | 비고 |
|------|--------|------|
| 검색 디바운싱 (150~200ms) | 데이터 수천 건 이후 | 현재 불필요 |
| 혼합 언어 쿼리 ("마법 attack") | 낮음 | 현실적 사용 사례 거의 없음 |
| 검색 결과 하이라이팅 | 중간 | microfuzz가 highlight range 제공 |
| Pagefind 전환 | 1만 건+ | 위 전환 계획 참고 |
