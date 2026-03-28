# Pricing Modal Design Spec

**Date:** 2026-03-28
**Status:** Draft

## Problem

가격 페이지(`/pricing`)가 별도 라우트로 존재하여, Browse/Navbar/Account에서 업그레이드 시 컨텍스트가 끊긴다. 모달로 전환하면 현재 화면 위에서 바로 결제 흐름을 시작할 수 있어 전환율이 높아진다.

## Decision Summary

| 항목 | 결정 |
|------|------|
| 모달 디자인 | `LandingPricing.tsx` 스타일 재사용 |
| 상태 관리 | UIStore (Zustand) — `pricingModalOpen` |
| 잠금 클립 클릭 | 가격 모달 바로 오픈 |
| `/pricing` 라우트 | 삭제, `/browse`로 리다이렉트 |
| 랜딩 페이지 pricing 섹션 | 변경 없음 (인라인 유지) |

## Architecture

### New Component: `PricingModal.tsx`

**위치:** `src/components/pricing/PricingModal.tsx`

QuickViewModal 패턴을 따르는 모달 래퍼 + LandingPricing 스타일의 가격 카드 UI.

**구조:**
```
<div> (fixed backdrop, z-50, bg-black/70)
  └─ <section role="dialog" aria-modal="true">
       ├─ Close button (X)
       ├─ Title + subtitle
       ├─ Billing toggle (monthly/yearly)
       └─ Cards row (Free | divider | Pro)
            ├─ Free: features list + "무료 시작" → closePricingModal() (이미 /browse에 있으면 이동 없음)
            └─ Pro: features list + "구독 시작" → /api/checkout POST → Stripe redirect
```

**핵심 동작:**
- Backdrop 클릭 → 닫기
- ESC 키 → 닫기
- Focus trap (모달 열릴 때 포커스 잠금, 닫힐 때 이전 요소로 복원)
- `aria-modal="true"`, `role="dialog"`, `aria-label`
- 월간/연간 토글은 `useState`로 로컬 관리
- Pro CTA 클릭 시:
  - 미인증 → `closePricingModal()` + `/login`으로 리다이렉트
  - 인증 + free tier → `/api/checkout` POST (interval 포함) → `window.location.href = data.url`
  - 인증 + pro tier → 버튼 비활성화 ("구독 중")

**디자인 토큰 (LandingPricing에서 가져옴):**
- 배경: `#0a0a0a` (모달 내부)
- 텍스트: white, `#777`, `#999`
- 디바이더: `rgba(255,255,255,0.06)`
- Pro 뱃지: `rgba(99,102,241,0.25)` border + background
- 토글 활성: `white` bg / `black` text
- 체크 아이콘: `#333` circle + white checkmark
- CTA Free: border `rgba(255,255,255,0.12)` ghost button
- CTA Pro: `bg-white text-black` solid button
- 모달 max-width: `max-w-2xl` (672px)
- 모달 border-radius: `rounded-2xl`

**Props:**
```typescript
interface PricingModalProps {
  lang: Locale;
}
```

dict를 사용하지 않는다. 기존 `PricingCards.tsx`와 동일하게 `lang === "ko"` 삼항으로 문자열을 인라인 처리한다. 이유: dictionaries 모듈은 `"server-only"` 가드가 있어 클라이언트 컴포넌트에서 import 불가. 문자열이 적고(제목, 부제, 기능 목록, CTA 2개) 이미 PricingCards에서 동일 패턴을 사용 중.

### UIStore Changes

`src/stores/uiStore.ts`에 추가:

```typescript
pricingModalOpen: boolean;
openPricingModal: () => void;
closePricingModal: () => void;
```

### Entry Point Changes (4곳)

1. **Navbar** (`src/components/layout/Navbar.tsx`)
   - "Pro 업그레이드" `<Link>` → `<button onClick={openPricingModal}>`

2. **Account** (`src/app/[lang]/account/AccountClient.tsx`)
   - "Pro로 업그레이드" `<Link>` → `<button onClick={openPricingModal}>`

3. **Browse 배너** (`src/app/[lang]/browse/BrowseClient.tsx`)
   - "Pro로 잠금 해제" `<a>` → `<button onClick={openPricingModal}>`

4. **잠금 클립** (`src/components/clip/ClipCard.tsx`)
   - `if (locked) return;` → `if (locked) { openPricingModal(); return; }`

### Modal Mount Point

`PricingModal`은 자체적으로 Zustand `uiStore.pricingModalOpen`을 구독하여 조건부 렌더링한다. 모달 컴포넌트 내부에서 `if (!pricingModalOpen) return null` 패턴을 사용.

**마운트 위치:** `src/app/[lang]/layout.tsx`에 클라이언트 래퍼 컴포넌트 `PricingModalHost`를 추가. 이 래퍼는 `useParams()`로 lang을 읽고 `PricingModal`을 렌더링한다.

```tsx
// src/components/pricing/PricingModalHost.tsx ("use client")
"use client";
import { useParams } from "next/navigation";
import { PricingModal } from "./PricingModal";
import type { Locale } from "@/lib/types";

export function PricingModalHost() {
  const { lang } = useParams<{ lang: string }>();
  return <PricingModal lang={(lang ?? "ko") as Locale} />;
}
```

`layout.tsx`에서는 `<PricingModalHost />`만 추가:
```tsx
<HtmlLang lang={lang} />
<PricingModalHost />
{children}
```

### `/pricing` Route Removal

1. `src/app/[lang]/pricing/` 디렉토리 삭제 (page.tsx, PricingCards.tsx)
2. `proxy.ts`에 리다이렉트 규칙 추가:
   ```
   /ko/pricing → /ko/browse
   /en/pricing → /en/browse
   ```

### Landing Page CTA Update

`LandingPricing.tsx`의 Pro CTA는 현재 `<Link href="/${lang}/pricing?interval=yearly">`로 삭제될 라우트를 가리키고 있다. `openPricingModal()`로 변경한다.

**변경 내용:**
- Pro CTA: `<Link href={proCta}>` → `<button onClick={openPricingModal}>`로 변경. 동일한 스타일 유지.
- `proCta` 변수와 관련 interval URL 로직 삭제 (모달이 자체 토글을 갖고 있으므로 불필요).
- LandingPricing의 billingInterval `useState`와 토글 UI는 유지 — 인라인 카드에서 가격 정보 표시용.
- 모달은 자체 독립적인 billingInterval 상태를 갖는다 (랜딩 토글과 연동하지 않음). 사용자가 인라인에서 연간을 보고 CTA를 클릭해도 모달은 월간(기본값)으로 열린다. 이는 의도적 — 모달에서 다시 선택하게 하여 결제 의사를 확인.

## Data Flow

```
User action (click locked clip / navbar / account / browse banner / landing CTA)
  → uiStore.openPricingModal()
  → PricingModal renders (z-50 overlay)
  → User selects monthly/yearly, clicks "구독 시작"
  → if (!user) → closePricingModal() + router.push('/login')
  → if (user && tier === 'free') → POST /api/checkout { lang, interval }
  → response.url → window.location.href (Stripe Checkout)
  → Stripe success → /account?checkout=success
  → Stripe cancel → /browse (was /pricing, now redirects)
```

## Mobile Behavior

- 모달은 모바일에서 전체 화면에 가깝게 (`max-h-[calc(100vh-2rem)]`, overflow-y-auto)
- 카드 레이아웃: md 이상에서 가로 2열, 모바일에서 세로 스택 (LandingPricing과 동일)
- 터치 스크롤 가능

## Edge Cases

- **이미 Pro인 사용자:** 모달이 열려도 "구독 중" 비활성 버튼 표시. 잠금 클립 자체가 없으므로 이 경우는 Navbar에서만 발생 가능 → Navbar에서 Pro 사용자에게는 업그레이드 버튼 미노출 (기존 동작 유지)
- **미인증 + 잠금 클립 클릭:** 잠금 클립은 free tier에만 표시되고, 미인증은 free로 간주됨. 모달에서 "구독 시작" 클릭 시 로그인 리다이렉트.
- **Stripe cancel URL:** `/pricing`이 삭제되므로 checkout route의 cancel_url을 `/${lang}/browse`로 변경.
- **결제 진행 중 모달 닫기:** Stripe로 리다이렉트되면 모달 상태는 자연히 리셋됨 (페이지 이동). 리다이렉트 전에 사용자가 ESC/backdrop 클릭하면 그냥 닫힘.

## Files to Change

| 파일 | 변경 |
|------|------|
| `src/components/pricing/PricingModal.tsx` | **신규** — 모달 컴포넌트 |
| `src/stores/uiStore.ts` | `pricingModalOpen` 상태 추가 |
| `src/components/layout/Navbar.tsx` | Link → openPricingModal() |
| `src/app/[lang]/account/AccountClient.tsx` | Link → openPricingModal() |
| `src/app/[lang]/browse/BrowseClient.tsx` | anchor → openPricingModal() |
| `src/components/clip/ClipCard.tsx` | locked click → openPricingModal() |
| `src/app/[lang]/LandingPricing.tsx` | Pro CTA Link → openPricingModal() |
| `src/components/pricing/PricingModalHost.tsx` | **신규** — 클라이언트 래퍼 (useParams로 lang 읽��) |
| `src/app/[lang]/layout.tsx` | PricingModalHost 마운트 |
| `proxy.ts` | /pricing → /browse 리다이렉트 추가 |
| `src/app/api/checkout/route.ts` | cancel_url을 /browse로 변경 |
| `src/app/[lang]/pricing/` | **삭제** (page.tsx, PricingCards.tsx) |

## Out of Scope

- 랜딩 페이지 인라인 카드 디자인 변경
- 가격/기능 텍스트 변경
- Stripe webhook 변경
- 새로운 딕셔너리 키 추가
