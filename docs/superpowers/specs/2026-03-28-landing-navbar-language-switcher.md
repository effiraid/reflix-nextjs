# Landing Navbar: 로그인/계정 → 언어 전환 교체

## 요약

랜딩 페이지 네비바에서 로그인/계정 버튼을 제거하고, 🌐 지구본 아이콘 + 텍스트 형태의 언어 전환 링크로 교체한다.

## 현재 상태

- `LandingNavbar.tsx`: 데스크톱/모바일 모두 로그인(Sign in) 또는 계정(Account) 버튼 표시
- `authStore` import로 사용자 세션 확인 후 조건부 렌더링
- `authDict` prop으로 `signIn`, `account` 텍스트 수신
- 랜딩 페이지에 언어 전환 기능 없음

## 변경 사항

### 제거 대상
- `useAuthStore` import 및 `user` 상태 참조
- `useSyncExternalStore` (isClient 체크 — 인증 조건부 렌더링 전용이었음)
- `authDict` prop 및 관련 타입 정의
- 데스크톱 로그인/계정 `Link` (167–195행)
- 모바일 바텀 시트 로그인/계정 `Link` (320–350행)
- `page.tsx`에서 `authDict={dict.auth}` prop 전달

### 추가 대상

**데스크톱 (divider 뒤, CTA 버튼 앞):**
- 지구본 SVG 아이콘 (16×16) + 대상 언어명 텍스트
- `ko` 페이지: "🌐 English" → `/en/` 로 이동
- `en` 페이지: "🌐 한국어" → `/ko/` 로 이동
- 기존 nav link와 동일한 스타일 (13px, fontWeight 400, `rgba(255,255,255,0.45)`, hover 시 white)

**모바일 바텀 시트 (divider 아래):**
- 지구본 아이콘 + 대상 언어명 텍스트
- 기존 시트 항목과 동일한 스타일 (15px, padding 14px 16px, minHeight 48)
- 클릭 시 `closeSheet()` 호출 후 언어 전환 페이지로 이동

### 언어 전환 링크 생성
```typescript
const otherLang = lang === "ko" ? "en" : "ko";
const otherLangLabel = lang === "ko" ? "English" : "한국어";
// 랜딩 페이지이므로 단순히 /{otherLang} 으로 이동
const switchHref = `/${otherLang}`;
```

### 아이콘
인라인 SVG 지구본 아이콘 사용. 외부 아이콘 라이브러리 의존성 없음.

## 영향 범위

| 파일 | 변경 |
|------|------|
| `src/app/[lang]/LandingNavbar.tsx` | 로그인/계정 → 언어 전환 교체, auth import 제거 |
| `src/app/[lang]/page.tsx` | `authDict` prop 제거 |

## 비변경 사항

- 브라우즈 네비바(`src/components/layout/Navbar.tsx`)는 변경하지 않음
- 딕셔너리 파일 변경 없음 (언어명은 하드코딩 — "English", "한국어"는 고유명사)
- 라우팅/i18n 로직 변경 없음
