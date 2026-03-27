# Reflix 유료화 모델 전환 + 인증 하드닝 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 콘텐츠 전체 공개 + 검색 능력 기반 유료화 모델로 전환하고, 인증 보안 취약점을 수정한다.

**Architecture:** 기존 pro/free 콘텐츠 티어 구분을 제거하고, 검색 결과 수 제한(Free: 5개)과 필터 조합 제한(Free: 단일 축)으로 유료화 포인트를 이동. 무작위 버튼은 Pro 전용. 동시에 OAuth open redirect, /account 서버 보호, 미디어 세션 토큰 보안을 수정.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Supabase Auth, Cloudflare Worker

**Spec:** `~/.gstack/projects/effiraid-reflix-nextjs/macbook-codex-preserve-main-worktree-20260327-105421-design-20260327-120940.md`

---

## Context

Reflix는 게임 애니메이션 레퍼런스 플랫폼이다. 현재 pro/free 티어로 콘텐츠 접근을 차등하는 구조인데, 공유가 핵심 가치이므로 콘텐츠를 전부 공개하고 "찾는 능력"으로 유료화 포인트를 이동한다. 동시에 보안 취약점도 수정한다.

---

## Task 1: 티어 기반 콘텐츠 제한 코드 제거 — 타입 & 유틸리티

**Files:**
- Modify: `src/lib/types.ts` (lines 16, 39, 59)
- Delete: `src/lib/usage.ts` (전체)
- Delete: `src/lib/usage.test.ts` (전체)
- Modify: `src/stores/authStore.ts` (lines 6-9, 15, 20-24, 31, 36, 38-53)

- [ ] **Step 1: `src/lib/types.ts`에서 AccessTier 제거**

`AccessTier` 타입 정의(line 16)를 삭제하고, `Clip` 인터페이스의 `accessTier?: AccessTier` (line 39)와 `BrowseSummaryRecord`의 `accessTier?: AccessTier` (line 59)를 삭제한다.

- [ ] **Step 2: `src/lib/usage.ts`와 `src/lib/usage.test.ts` 삭제**

두 파일 전체를 삭제한다. `getDailyLimit`, `isViewAllowed`, `getRemainingViews` 함수는 더 이상 사용되지 않는다.

- [ ] **Step 3: `src/stores/authStore.ts`에서 일일 조회 관련 코드 제거**

삭제 대상:
- `DAILY_VIEW_LIMITS` 상수 (lines 6-9)
- `dailyViews: number` 상태 (line 15)
- `setDailyViews`, `incrementViews`, `resetDailyViews`, `getDailyViewLimit`, `getRemainingViews` 인터페이스 선언 (lines 20-24)
- `dailyViews: 0` 초기값 (line 31)
- `setDailyViews` 구현 (line 36)
- `incrementViews`, `resetDailyViews`, `getDailyViewLimit`, `getRemainingViews` 구현 (lines 38-53)

`Tier` 타입과 `user`, `tier`, `isLoading`, `setUser`, `setTier`, `setLoading`은 유지한다.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build 2>&1 | head -50`
Expected: AccessTier 참조 에러가 여러 파일에서 발생 (다음 태스크에서 수정)

- [ ] **Step 5: Commit**

```bash
git add -u src/lib/types.ts src/lib/usage.ts src/lib/usage.test.ts src/stores/authStore.ts
git commit -m "refactor: remove AccessTier type, usage utils, and daily view limit state"
```

---

## Task 2: AccessGate 및 컴포넌트에서 티어 제한 제거

**Files:**
- Delete: `src/components/auth/AccessGate.tsx` (전체)
- Modify: `src/components/clip/ClipCard.tsx` (lines 22, 41-42, 75-81, 123, 139, 145)
- Modify: `src/components/clip/MasonryGrid.tsx` (lines 71-85, 110, 136, 186)
- Modify: `src/components/clip/ClipDetailView.tsx` (lines 23, 26)

- [ ] **Step 1: `src/components/auth/AccessGate.tsx` 삭제**

파일 전체를 삭제한다. `AccessGate`와 `DailyLimitModal` 컴포넌트가 포함되어 있다.

- [ ] **Step 2: `ClipCard.tsx`에서 Pro 뱃지/잠금 로직 제거**

- `isProClip`, `showProBadge` 변수 삭제 (lines 41-42)
- `{showProBadge ? <ProBadge /> : null}` 삭제 (line 145)
- `locked` prop 제거 (line 22)
- `locked ? " blur-lg scale-110" : ""` 삼항 연산자를 제거하고 기본 클래스만 유지 (lines 123, 139)

- [ ] **Step 3: `MasonryGrid.tsx`에서 Pro 잠금 로직 제거**

- `lockedProClipIds` useMemo 블록 전체 삭제 (lines 71-85)
- `lockedProClipIds` prop 전달 삭제 (line 110)
- `MasonryColumn` 인터페이스에서 `lockedProClipIds: Set<string>` 삭제 (line 136)
- `locked={lockedProClipIds.has(clip.id)}` prop 삭제 (line 186)

- [ ] **Step 4: `ClipDetailView.tsx`에서 AccessGate 래핑 제거**

`<AccessGate clipAccessTier={...} lang={lang}>` 래퍼(line 23)와 `</AccessGate>` 닫는 태그(line 26)를 제거하고, 내부 콘텐츠를 직접 렌더링한다. `AccessGate` import도 삭제.

- [ ] **Step 5: 빌드 확인**

Run: `npm run build 2>&1 | head -50`
Expected: 빌드 성공 또는 filter.ts 관련 에러만 남음

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor: remove AccessGate, Pro badge, and clip locking from UI components"
```

---

## Task 3: 필터에서 티어 로직 제거

**Files:**
- Modify: `src/lib/filter.ts` (lines 1, 26, 35, 39-42)
- Modify: `src/lib/filter.test.ts` (lines 152-168)
- Modify: `src/app/[lang]/browse/BrowseClient.tsx` (filterClips 호출부)

- [ ] **Step 1: `filter.ts`에서 티어 필터링 제거**

- import에서 `AccessTier` 제거 (line 1)
- `FilterableClipRecord` 인터페이스에서 `accessTier?: AccessTier` 삭제 (line 26)
- `filterClips` 함수 시그니처에서 `userTier?: AccessTier` 파라미터 삭제 (line 35)
- 티어 기반 gating 로직 4줄 삭제 (lines 39-42):
  ```typescript
  // 삭제할 코드:
  if (userTier && userTier !== "pro") {
    result = result.filter((c) => (c.accessTier ?? "pro") === "free");
  }
  ```

- [ ] **Step 2: `filter.test.ts`에서 티어 테스트 제거**

3개 테스트 케이스 삭제 (lines 152-168):
- `"tier=free shows only free clips"`
- `"tier=pro shows all clips"`
- `"clips without accessTier default to pro (gated for free users)"`

- [ ] **Step 3: `BrowseClient.tsx`에서 filterClips 호출 수정**

`filterClips()` 호출에서 `userTier` 인자를 제거한다.

- [ ] **Step 4: 테스트 실행**

Run: `npx vitest run src/lib/filter.test.ts`
Expected: PASS (남은 테스트 모두 통과)

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 6: Commit**

```bash
git add -u src/lib/filter.ts src/lib/filter.test.ts src/app/[lang]/browse/BrowseClient.tsx
git commit -m "refactor: remove tier-based clip filtering from filter logic"
```

---

## Task 4: 검색 결과 제한 (Free: 5개, Pro: 무제한)

**Files:**
- Modify: `src/app/[lang]/browse/BrowseClient.tsx` (filtered memo + 결과 카운트 표시)

- [ ] **Step 1: BrowseClient에서 검색 결과 제한 로직 추가**

`filtered` memo에서 `filterClips()` 반환 후, 유저 티어에 따라 표시 결과를 slice한다.

```typescript
// BrowseClient.tsx의 filtered memo 내부
const allResults = filterClips(projectionClips, filters, categories, tagI18n, lang);
const hasSearchOrFilter = filters.searchQuery || hasActiveBrowseFilters;
const tier = useAuthStore((s) => s.tier);
const user = useAuthStore((s) => s.user);
const FREE_SEARCH_LIMIT = 5;

// 검색/필터 활성 시에만 제한 적용
const isLimited = hasSearchOrFilter && (!user || tier !== "pro");
const filtered = isLimited ? allResults.slice(0, FREE_SEARCH_LIMIT) : allResults;
const totalResultCount = allResults.length;
const hiddenCount = isLimited ? Math.max(0, totalResultCount - FREE_SEARCH_LIMIT) : 0;
```

- [ ] **Step 2: "N개 더 보기" Pro 배너 추가**

검색 결과 카운트 표시 영역(lines 323-329)에 hiddenCount > 0일 때 Pro 업그레이드 배너를 추가한다.

```tsx
{hiddenCount > 0 && (
  <div className="border-b border-border px-4 py-3 bg-surface-alt flex items-center justify-between">
    <p className="text-xs text-muted">
      {lang === "ko"
        ? `${hiddenCount}개 결과가 더 있습니다`
        : `${hiddenCount} more results available`}
    </p>
    <a
      href={`/${lang}/pricing`}
      className="text-xs font-medium text-primary hover:underline"
    >
      {lang === "ko" ? "Pro로 전체 보기" : "View all with Pro"}
    </a>
  </div>
)}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 4: Commit**

```bash
git add src/app/[lang]/browse/BrowseClient.tsx
git commit -m "feat: add search result limit for free users (5 results, Pro unlimited)"
```

---

## Task 5: 필터 조합 제한 (Free: 단일 축, Pro: 복수 축)

**Files:**
- Modify: `src/app/[lang]/browse/BrowseClient.tsx` 또는 `src/components/layout/SubToolbar.tsx`

- [ ] **Step 1: 필터 조합 감지 로직 추가**

필터 축(axis) 개수를 세는 로직을 추가한다. 축 = 태그, 카테고리, 게임 등 독립된 필터 차원.

```typescript
// BrowseClient.tsx 또는 SubToolbar.tsx
const activeFilterAxes = [
  filters.selectedTags?.length > 0,
  filters.selectedCategory != null,
  filters.selectedGame != null,
  filters.selectedStar != null,
].filter(Boolean).length;

const isFilterLimited = activeFilterAxes > 1 && (!user || tier !== "pro");
```

- [ ] **Step 2: 2개 이상 축 선택 시 Pro 배너 표시**

두 번째 필터 축을 선택하려 할 때, Pro 업그레이드 안내를 표시한다. 필터 UI에서 두 번째 축의 선택을 막거나, 선택 시 배너를 보여주고 필터를 적용하지 않는다.

```tsx
{isFilterLimited && (
  <div className="px-4 py-2 bg-surface-alt border-b border-border">
    <p className="text-xs text-muted">
      {lang === "ko"
        ? "필터 조합은 Pro 전용입니다"
        : "Filter combinations require Pro"}
    </p>
    <a href={`/${lang}/pricing`} className="text-xs text-primary hover:underline">
      {lang === "ko" ? "Pro 구독하기" : "Get Pro"}
    </a>
  </div>
)}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat: restrict filter combinations to Pro users (free: single axis only)"
```

---

## Task 6: 무작위 버튼 Pro 전용 처리

**Files:**
- Modify: `src/components/layout/SubToolbar.tsx` (lines 155-162)

- [ ] **Step 1: 무작위 버튼에 Pro 게이트 추가**

`SubToolbar.tsx`의 shuffle 버튼(lines 155-162)을 티어에 따라 분기한다.

```tsx
// SubToolbar.tsx
const tier = useAuthStore((s) => s.tier);
const user = useAuthStore((s) => s.user);
const isProUser = user && tier === "pro";

// 기존 shuffle 버튼을 대체:
{isProUser ? (
  <button
    type="button"
    aria-label={shuffleLabel}
    onClick={reshuffleClips}
    className="p-1.5 rounded hover:bg-surface-hover text-muted"
  >
    <RefreshIcon />
  </button>
) : (
  <button
    type="button"
    aria-label={lang === "ko" ? "Pro 전용 기능" : "Pro feature"}
    onClick={() => { /* Pro 업그레이드 안내 또는 pricing 페이지 이동 */ }}
    className="p-1.5 rounded text-muted/40 cursor-not-allowed relative group"
    title={lang === "ko" ? "Pro 전용" : "Pro only"}
  >
    <RefreshIcon />
    <span className="absolute -top-1 -right-1 text-[8px] font-bold text-primary">PRO</span>
  </button>
)}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SubToolbar.tsx
git commit -m "feat: restrict shuffle button to Pro users"
```

---

## Task 7: `/account` 서버 측 보호 (proxy.ts)

**Files:**
- Modify: `src/proxy.ts` (middleware 함수, lines 87-123)

- [ ] **Step 1: proxy.ts에 /account 경로 보호 추가**

`proxy()` 함수 내부, locale redirect 이후에 account 경로 체크를 삽입한다. 기존 `getSessionTier()` 함수를 재사용한다.

```typescript
// proxy.ts의 middleware 함수 내부
// locale redirect 처리 후, withMediaSession 호출 전에 추가:

const pathname = request.nextUrl.pathname;

// /account 보호: 미인증 시 /login으로 리다이렉트
if (pathname.match(/^\/[a-z]{2}\/account/)) {
  const { userId } = await getSessionTier(request);
  if (!userId) {
    const lang = pathname.split("/")[1] || "ko";
    return NextResponse.redirect(new URL(`/${lang}/login`, request.url));
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: add server-side auth protection for /account route in proxy"
```

---

## Task 8: OAuth 콜백 open redirect 차단

**Files:**
- Modify: `src/app/api/auth/callback/route.ts` (line 8, 39)

- [ ] **Step 1: ?next 파라미터 화이트리스트 검증 추가**

`new URL()` 생성 전에 화이트리스트를 검증한다.

```typescript
// route.ts 상단에 추가
const ALLOWED_NEXT_PATTERNS = [
  /^\/ko\//,
  /^\/en\//,
];

// 기존 line 8 변경:
const nextParam = searchParams.get("next") ?? "/ko/browse";
const safeNext = ALLOWED_NEXT_PATTERNS.some((p) => p.test(nextParam))
  ? nextParam
  : "/ko/browse";

// line 39: next → safeNext로 변경
const response = NextResponse.redirect(new URL(safeNext, origin));
```

참고: OAuth 콜백은 두 경로가 존재.
- `/api/auth/callback` (서버 PKCE) — `?next` 파라미터 사용, 이 파일에서 화이트리스트 적용
- `/[lang]/auth/callback` (클라이언트 hash) — `?next` 미사용, open redirect 위험 없음

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/callback/route.ts
git commit -m "fix(security): whitelist OAuth callback redirect paths to prevent open redirect"
```

---

## Task 9: 미디어 세션 토큰 보안 수정

**Files:**
- Modify: `src/proxy.ts` (withMediaSession 함수, lines 50-85)

- [ ] **Step 1: 미디어 세션 토큰에서 tier 단순화**

콘텐츠 전체 공개이므로, 인증된 유저는 모두 `tier: "pro"`, 미인증은 `tier: "free"`로 설정. 실질적으로 미디어 접근 차단은 하지 않되, 토큰 구조는 유지하여 핫링크 방지 목적으로 사용.

```typescript
// proxy.ts의 withMediaSession() 내부
// 기존: const { userId, tier } = await getSessionTier(request);
// 변경: tier는 인증 여부로만 결정
const { userId } = await getSessionTier(request);
const tier = userId ? "pro" : "free"; // 인증 = pro, 미인증 = free
```

- [ ] **Step 2: origin allowlist를 명시적으로 변경**

`withMediaSession()` 내부의 쿠키 도메인 설정에서, 와일드카드(`*.reflix.dev`) 대신 명시적 도메인 목록을 사용하도록 주석을 추가한다. (실제 도메인 검증은 Cloudflare Worker 측에서 수행)

- [ ] **Step 3: localhost 신뢰 제거 주석 추가**

`proxy.ts` 내부에 localhost 관련 조건이 있는지 확인하고, 프로덕션 빌드에서는 localhost origin을 허용하지 않도록 한다.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts
git commit -m "fix(security): simplify media session tier and add origin validation notes"
```

---

## Task 10: AuthProvider에서 일일 조회 관련 코드 정리

**Files:**
- Modify: `src/components/auth/AuthProvider.tsx`

- [ ] **Step 1: AuthProvider에서 dailyViews 로드 코드 제거**

`loadProfile` 내부에서 `daily_usage` 테이블 쿼리와 `setDailyViews` 호출을 제거한다.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/AuthProvider.tsx
git commit -m "refactor: remove daily usage loading from AuthProvider"
```

---

## Task 11: 최종 빌드 및 린트 확인

- [ ] **Step 1: 전체 빌드**

Run: `npm run build`
Expected: 성공 (에러 0개)

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 성공

- [ ] **Step 3: 전체 테스트**

Run: `npx vitest run`
Expected: 모든 테스트 통과

- [ ] **Step 4: 사용하지 않는 import 정리**

빌드/린트에서 잡히지 않은 dead import가 있으면 정리한다. 특히:
- `AccessTier` import
- `AccessGate` import
- `DailyLimitModal` import
- `usage.ts` import

- [ ] **Step 5: 최종 Commit**

```bash
git add -u
git commit -m "chore: cleanup unused imports and final build verification"
```

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.

---

## Verification

### 수동 QA (localhost:3000)

1. **브라우즈 페이지** (`/ko/browse`)
   - 모든 클립이 Pro 뱃지 없이 표시되는지 확인
   - 블러 처리된 클립이 없는지 확인
   - 검색 시 로그인하지 않은 상태에서 5개 결과만 표시되는지 확인
   - "N개 더 보기" Pro 배너가 표시되는지 확인
   - 필터 2개 이상 조합 시 Pro 안내가 표시되는지 확인
   - 무작위 버튼이 비활성(잠금) 상태인지 확인

2. **클립 상세** (`/ko/clip/{id}`)
   - AccessGate 오버레이 없이 바로 표시되는지 확인
   - 공유 링크가 로그인 없이 작동하는지 확인

3. **계정 페이지** (`/ko/account`)
   - 미인증 상태에서 `/ko/login`으로 리다이렉트되는지 확인
   - 로딩 스켈레톤이 잠시도 노출되지 않는지 확인

4. **OAuth 콜백**
   - `/api/auth/callback?next=https://evil.com`이 `/ko/browse`로 폴백되는지 확인
   - `/api/auth/callback?next=/ko/browse`가 정상 작동하는지 확인

5. **Pro 유저** (effiraid@gmail.com 로그인)
   - 검색 결과가 무제한으로 표시되는지 확인
   - 필터 조합이 자유롭게 작동하는지 확인
   - 무작위 버튼이 활성 상태인지 확인
