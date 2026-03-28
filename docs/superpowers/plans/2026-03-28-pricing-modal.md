# Pricing Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone `/pricing` page with an in-app modal triggered from Browse, Navbar, Account, and locked clip clicks.

**Architecture:** A new `PricingModal` client component (LandingPricing visual style + PricingCards checkout logic) mounts globally via a thin `PricingModalHost` wrapper in `layout.tsx`. Zustand `uiStore` manages open/close state. All existing `/pricing` links become `openPricingModal()` calls. The `/pricing` route is deleted and redirected to `/browse` in `proxy.ts`.

**Tech Stack:** React 19, Zustand, Next.js 16, Stripe Checkout (`/api/checkout`), Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-28-pricing-modal-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/stores/uiStore.ts` | Modify | Add `pricingModalOpen`, `openPricingModal()`, `closePricingModal()` |
| `src/components/pricing/PricingModal.tsx` | Create | Modal UI (LandingPricing style) + Stripe checkout logic |
| `src/components/pricing/PricingModalHost.tsx` | Create | Client wrapper — reads `lang` via `useParams`, renders `PricingModal` |
| `src/app/[lang]/layout.tsx` | Modify | Mount `PricingModalHost` |
| `src/components/layout/Navbar.tsx` | Modify | Link → `openPricingModal()` |
| `src/app/[lang]/account/AccountClient.tsx` | Modify | Link → `openPricingModal()` |
| `src/app/[lang]/browse/BrowseClient.tsx` | Modify | anchor → `openPricingModal()` |
| `src/components/clip/ClipCard.tsx` | Modify | locked click → `openPricingModal()` |
| `src/app/[lang]/LandingPricing.tsx` | Modify | Pro CTA Link → `openPricingModal()` |
| `src/app/api/checkout/route.ts` | Modify | `cancel_url` → `/browse` |
| `src/proxy.ts` | Modify | Add `/pricing` → `/browse` redirect |
| `src/app/[lang]/pricing/` | Delete | Remove page.tsx + PricingCards.tsx |

---

### Task 1: UIStore — Add Pricing Modal State

**Files:**
- Modify: `src/stores/uiStore.ts`

- [ ] **Step 1: Add state and actions to UIStore interface**

In `src/stores/uiStore.ts`, add to the `UIStore` interface (after `shuffleSeed` / before `toggleLeftPanel`):

```typescript
pricingModalOpen: boolean;
openPricingModal: () => void;
closePricingModal: () => void;
```

- [ ] **Step 2: Add implementation in create() call**

In the `create()` body, add (after `shuffleSeed: Math.random()` initial state):

```typescript
pricingModalOpen: false,
openPricingModal: () => set({ pricingModalOpen: true }),
closePricingModal: () => set({ pricingModalOpen: false }),
```

Do NOT add `pricingModalOpen` to the `partialize` function — modal state should not persist across sessions.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/stores/uiStore.ts
git commit -m "feat(store): add pricingModalOpen state to uiStore"
```

---

### Task 2: PricingModal Component

**Files:**
- Create: `src/components/pricing/PricingModal.tsx`

**Reference:** Visual design from `src/app/[lang]/LandingPricing.tsx`, checkout logic from `src/app/[lang]/pricing/PricingCards.tsx:83-112`.

- [ ] **Step 1: Create component file**

Create `src/components/pricing/PricingModal.tsx` with the following structure:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import type { Locale } from "@/lib/types";

interface PricingModalProps {
  lang: Locale;
}

function CheckIcon() {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: 15, height: 15, background: "#333" }}
    >
      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function PricingModal({ lang }: PricingModalProps) {
  const { pricingModalOpen, closePricingModal } = useUIStore();
  const { user, tier } = useAuthStore();
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const isKo = lang === "ko";
  const isYearly = billingInterval === "yearly";
  const isPro = tier === "pro";

  // Focus management
  useEffect(() => {
    if (pricingModalOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [pricingModalOpen]);

  // ESC key handler
  useEffect(() => {
    if (!pricingModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePricingModal();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pricingModalOpen, closePricingModal]);

  // Lock body scroll
  useEffect(() => {
    if (!pricingModalOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [pricingModalOpen]);

  const handleSubscribe = useCallback(async () => {
    if (!user) {
      closePricingModal();
      router.push(`/${lang}/login`);
      return;
    }
    if (isPro || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, interval: billingInterval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }, [user, isPro, loading, lang, billingInterval, closePricingModal, router]);

  if (!pricingModalOpen) return null;

  const freeFeatures = isKo
    ? ["50개 무료 클립", "20회/일 조회", "보드 1개"]
    : ["50 free clips", "20 views/day", "1 board"];
  const proFeatures = isKo
    ? ["전체 라이브러리", "무제한 조회", "무제한 보드"]
    : ["Full library", "Unlimited views", "Unlimited boards"];

  const proPrice = isYearly
    ? (isKo ? "₩99,000" : "$99")
    : (isKo ? "₩9,900" : "$9.90");
  const proPeriod = isYearly
    ? (isKo ? "/년" : "/yr")
    : (isKo ? "/월" : "/mo");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={closePricingModal}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isKo ? "요금제" : "Pricing"}
        tabIndex={-1}
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl outline-none"
        style={{ background: "#0a0a0a" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closePricingModal}
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-sm text-[#888] transition-colors hover:text-white"
          style={{ background: "rgba(255,255,255,0.06)" }}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="px-6 pb-6 pt-8 md:px-8">
          {/* Title */}
          <div className="text-center">
            <h2
              className="text-2xl font-bold text-white"
              style={{ letterSpacing: "-0.5px" }}
            >
              {isKo ? "요금제" : "Pricing"}
            </h2>
            <p className="mt-1.5 text-[13px] text-[#777]">
              {isKo
                ? "게임 애니메이션 레퍼런스를 자유롭게 탐색"
                : "Explore game animation references freely"}
            </p>
          </div>

          {/* Billing toggle */}
          <div className="mt-6 flex items-center justify-center">
            <div
              className="inline-flex rounded-full p-1"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-all"
                style={{
                  background: !isYearly ? "white" : "transparent",
                  color: !isYearly ? "black" : "#666",
                }}
              >
                {isKo ? "월간" : "Monthly"}
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("yearly")}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all"
                style={{
                  background: isYearly ? "white" : "transparent",
                  color: isYearly ? "black" : "#666",
                }}
              >
                <span>{isKo ? "연간" : "Yearly"}</span>
                <span
                  aria-hidden="true"
                  className="whitespace-nowrap rounded-full px-1.5 py-1 text-[10px] font-semibold leading-none"
                  style={{
                    background: isYearly
                      ? "rgba(22,101,52,0.12)"
                      : "rgba(34,197,94,0.12)",
                    color: isYearly ? "#166534" : "#22c55e",
                  }}
                >
                  -17%
                </span>
              </button>
            </div>
          </div>

          {/* Cards row */}
          <div className="mt-8 flex flex-col md:flex-row">
            {/* Free plan */}
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-lg font-semibold text-white">Free</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">
                  {isKo ? "₩0" : "$0"}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-[#777]">
                {isKo ? "무료로 시작하세요" : "Start for free"}
              </p>

              <div
                className="my-5"
                style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
              />

              <ul className="flex flex-1 flex-col gap-2.5">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-[#999]">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={closePricingModal}
                className="mt-6 block rounded-full py-2 text-center text-[13px] font-medium text-white transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {isKo ? "무료 시작" : "Start free"}
              </button>
            </div>

            {/* Center divider */}
            <div
              className="hidden md:block"
              style={{
                width: 1,
                background: "rgba(255,255,255,0.06)",
                marginTop: 24,
                marginBottom: 24,
              }}
            />
            <div
              className="md:hidden"
              style={{
                height: 1,
                background: "rgba(255,255,255,0.06)",
                marginLeft: 24,
                marginRight: 24,
              }}
            />

            {/* Pro plan */}
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Pro</h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{
                    background: "rgba(99,102,241,0.25)",
                    border: "1px solid rgba(99,102,241,0.3)",
                  }}
                >
                  {isKo ? "★ 추천" : "★ Best"}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">{proPrice}</span>
                <span className="text-[13px] text-[#777]">{proPeriod}</span>
              </div>
              {isYearly && (
                <p className="mt-1 text-[12px] text-[#999]">
                  <span style={{ textDecoration: "line-through", color: "#555" }}>
                    {isKo ? "₩9,900" : "$9.90"}
                  </span>{" "}
                  {isKo ? "₩8,250/월" : "$8.25/mo"}
                </p>
              )}
              <p className="mt-1.5 text-[13px] text-[#777]">
                {isKo ? "모든 클립에 무제한 접근" : "Unlimited access to all clips"}
              </p>

              <div
                className="my-5"
                style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
              />

              <ul className="flex flex-1 flex-col gap-2.5">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-[#999]">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isPro || loading}
                className="mt-6 block rounded-full bg-white py-2 text-center text-[13px] font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading
                  ? (isKo ? "결제 준비 중..." : "Preparing...")
                  : isPro
                    ? (isKo ? "구독 중" : "Current plan")
                    : (isKo ? "구독 시작" : "Subscribe")}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors (authStore must export `useAuthStore` with `user` and `tier`)

- [ ] **Step 3: Commit**

```bash
git add src/components/pricing/PricingModal.tsx
git commit -m "feat: add PricingModal component with LandingPricing style"
```

---

### Task 3: PricingModalHost + Layout Mount

**Files:**
- Create: `src/components/pricing/PricingModalHost.tsx`
- Modify: `src/app/[lang]/layout.tsx`

- [ ] **Step 1: Create PricingModalHost**

Create `src/components/pricing/PricingModalHost.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { PricingModal } from "./PricingModal";
import type { Locale } from "@/lib/types";

export function PricingModalHost() {
  const { lang } = useParams<{ lang: string }>();
  return <PricingModal lang={(lang ?? "ko") as Locale} />;
}
```

- [ ] **Step 2: Mount in layout.tsx**

In `src/app/[lang]/layout.tsx`, add import at top:

```typescript
import { PricingModalHost } from "@/components/pricing/PricingModalHost";
```

In the return, add `<PricingModalHost />` after the `<HtmlLang lang={lang} />` line inside the `params.then()` callback:

```tsx
return (
  <>
    <HtmlLang lang={lang} />
    <PricingModalHost />
    {children}
  </>
);
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/pricing/PricingModalHost.tsx src/app/\[lang\]/layout.tsx
git commit -m "feat: mount PricingModalHost in locale layout"
```

---

### Task 4: Navbar — Link to Modal

**Files:**
- Modify: `src/components/layout/Navbar.tsx` (lines 280-288)

- [ ] **Step 1: Replace Link with button**

In `src/components/layout/Navbar.tsx`, find the Pro upgrade Link in UserMenu (around line 280-288). It currently looks like:

```tsx
<Link href={`/${lang}/pricing`} className="flex items-center gap-2 px-3 py-1.5 text-xs text-accent...">
  <CrownIcon className="size-3.5" />
  {isKo ? "Pro 업그레이드" : "Upgrade to Pro"}
</Link>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => {
    openPricingModal();
    // Close user menu if applicable
  }}
  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-accent..."
>
  <CrownIcon className="size-3.5" />
  {isKo ? "Pro 업그레이드" : "Upgrade to Pro"}
</button>
```

Add `openPricingModal` to the destructured uiStore import. The UserMenu component already imports from stores — check if `useUIStore` is already imported, if not add it:

```typescript
const { openPricingModal } = useUIStore();
```

Note: The button needs `w-full` to match the Link's block display. Check the exact className from the existing Link and match it.

- [ ] **Step 2: Remove unused Link import if `/pricing` was its only usage in this file**

Check if `Link` from `next/link` is still used elsewhere in Navbar.tsx. It likely is (for other nav items), so keep it.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat(navbar): trigger pricing modal instead of page navigation"
```

---

### Task 5: AccountClient — Link to Modal

**Files:**
- Modify: `src/app/[lang]/account/AccountClient.tsx` (lines 180-187)

- [ ] **Step 1: Replace Link with button**

Find the upgrade Link (around line 180-187):

```tsx
<Link href={`/${lang}/pricing`} className="...bg-accent...">
  <CrownIcon className="size-3.5" />
  {isKo ? "Pro로 업그레이드" : "Upgrade to Pro"}
</Link>
```

Replace with:

```tsx
<button
  type="button"
  onClick={openPricingModal}
  className="...bg-accent..."
>
  <CrownIcon className="size-3.5" />
  {isKo ? "Pro로 업그레이드" : "Upgrade to Pro"}
</button>
```

Add at top of component:
```typescript
const { openPricingModal } = useUIStore();
```

Import `useUIStore` if not already imported:
```typescript
import { useUIStore } from "@/stores/uiStore";
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\[lang\]/account/AccountClient.tsx
git commit -m "feat(account): trigger pricing modal instead of page navigation"
```

---

### Task 6: BrowseClient — Anchor to Modal

**Files:**
- Modify: `src/app/[lang]/browse/BrowseClient.tsx` (lines 523-528)

- [ ] **Step 1: Replace anchor with button**

Find the "Pro로 잠금 해제" link (around line 523-528):

```tsx
<a href={`/${lang}/pricing`} className="text-xs font-medium text-primary hover:underline">
  {lang === "ko" ? "Pro로 잠금 해제" : "Unlock with Pro"}
</a>
```

Replace with:

```tsx
<button
  type="button"
  onClick={openPricingModal}
  className="text-xs font-medium text-primary hover:underline"
>
  {lang === "ko" ? "Pro로 잠금 해제" : "Unlock with Pro"}
</button>
```

Add `openPricingModal` from `useUIStore`. BrowseClient likely already imports `useUIStore` — check and add `openPricingModal` to the destructured values.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\[lang\]/browse/BrowseClient.tsx
git commit -m "feat(browse): trigger pricing modal from locked clips banner"
```

---

### Task 7: ClipCard — Locked Click Opens Modal

**Files:**
- Modify: `src/components/clip/ClipCard.tsx` (lines 48-82)

- [ ] **Step 1: Replace locked click behavior**

In `src/components/clip/ClipCard.tsx`, find `handleClick` (line 48-59). Currently:

```typescript
const handleClick = useCallback(() => {
  if (locked) return;
  // ... selection logic
}, [locked, ...]);
```

Change to:

```typescript
const handleClick = useCallback(() => {
  if (locked) {
    openPricingModal();
    return;
  }
  // ... selection logic (unchanged)
}, [locked, openPricingModal, ...]);
```

Do the same for `handleDoubleClick` (line 61-68) and `handleKeyDown` (line 70-82):

```typescript
const handleDoubleClick = useCallback(() => {
  if (locked) {
    openPricingModal();
    return;
  }
  // ... existing logic
}, [locked, openPricingModal, ...]);
```

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (locked) {
    if (e.key === "Enter" || e.key === " ") {
      openPricingModal();
    }
    return;
  }
  // ... existing logic
}, [locked, openPricingModal, ...]);
```

Add at top of component:
```typescript
const { openPricingModal } = useUIStore();
```

Import `useUIStore` if not already imported:
```typescript
import { useUIStore } from "@/stores/uiStore";
```

Also update accessibility attributes — locked cards now have an action (open modal):

```typescript
tabIndex={0}  // was: locked ? -1 : 0
```

Remove `aria-disabled={locked || undefined}` — the card is now interactive when locked.

Remove `cursor-not-allowed` from the locked card's className. The card now opens the pricing modal, so the cursor should indicate clickability (default `cursor-pointer` from the card's base styles).

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/clip/ClipCard.tsx
git commit -m "feat(clip-card): open pricing modal on locked clip click"
```

---

### Task 8: LandingPricing — CTA to Modal

**Files:**
- Modify: `src/app/[lang]/LandingPricing.tsx` (lines 87-89, 305-310)

- [ ] **Step 1: Replace Pro CTA Link with button**

In `src/app/[lang]/LandingPricing.tsx`, find the Pro CTA Link (around line 305-310):

```tsx
<Link
  href={proCta}
  className="mt-8 block rounded-full bg-white py-2.5 text-center text-[14px] font-medium text-black transition-opacity hover:opacity-80"
>
  {dict.pricingProCta}
</Link>
```

Replace with:

```tsx
<button
  type="button"
  onClick={openPricingModal}
  className="mt-8 block w-full rounded-full bg-white py-2.5 text-center text-[14px] font-medium text-black transition-opacity hover:opacity-80"
>
  {dict.pricingProCta}
</button>
```

Note the added `w-full` to make the button fill the container width like the Link did.

- [ ] **Step 2: Clean up unused proCta variable**

Remove lines 87-89:

```typescript
const proCta = isYearly
  ? `/${lang}/pricing?interval=yearly`
  : `/${lang}/pricing`;
```

Remove the `Link` import from `next/link` if the Free plan CTA also needs updating. Check — the Free plan CTA (around line 213-221) links to `/${lang}/browse`, which is still valid. So keep the `Link` import for Free CTA.

- [ ] **Step 3: Add uiStore import**

Add at top:

```typescript
import { useUIStore } from "@/stores/uiStore";
```

Inside the component:

```typescript
const { openPricingModal } = useUIStore();
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\[lang\]/LandingPricing.tsx
git commit -m "feat(landing): trigger pricing modal from Pro CTA"
```

---

### Task 9: Checkout Route — Update cancel_url

**Files:**
- Modify: `src/app/api/checkout/route.ts` (line 140)

- [ ] **Step 1: Change cancel_url**

In `src/app/api/checkout/route.ts`, find line 140:

```typescript
cancel_url: `${origin}/${lang}/pricing?checkout=cancel`,
```

Change to:

```typescript
cancel_url: `${origin}/${lang}/browse`,
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "fix(checkout): update cancel_url from /pricing to /browse"
```

---

### Task 10: Proxy — Add /pricing Redirect

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Add redirect rule**

In `src/proxy.ts`, find the locale routing section (around line 108-118 where pathname matching happens). Add a redirect rule **before** the existing locale checks. Find the section that checks for locale-prefixed paths and add:

```typescript
// Redirect removed /pricing route to /browse
const pricingMatch = pathname.match(/^\/([a-z]{2})\/pricing\b/);
if (pricingMatch) {
  const pricingLang = pricingMatch[1];
  return NextResponse.redirect(new URL(`/${pricingLang}/browse`, request.url), 301);
}
```

Place this early in the middleware function, after the locale detection but before the auth guard for `/account`. The 301 (permanent) status tells search engines the page has moved.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(proxy): redirect /pricing to /browse (301)"
```

---

### Task 11: Delete /pricing Route

**Files:**
- Delete: `src/app/[lang]/pricing/page.tsx`
- Delete: `src/app/[lang]/pricing/PricingCards.tsx`

- [ ] **Step 1: Delete pricing directory**

```bash
rm -rf src/app/\[lang\]/pricing
```

- [ ] **Step 2: Check for broken imports**

Run: `npx tsc --noEmit`

If any file still imports from `@/app/[lang]/pricing/PricingCards`, fix those imports. Based on exploration, `PricingCards` is only used in `src/app/[lang]/pricing/page.tsx` (which we're deleting), so no broken imports expected.

- [ ] **Step 3: Search for remaining references to `/pricing`**

Run: `grep -r "pricing" src/ --include="*.tsx" --include="*.ts" -l`

Verify all results are either:
- `PricingModal.tsx` (new component) ✓
- `PricingModalHost.tsx` (new wrapper) ✓
- `uiStore.ts` (state) ✓
- `checkout/route.ts` (cancel_url updated) ✓
- Files that reference "pricing" in comments or unrelated context ✓

No file should still link to `/${lang}/pricing` as a route.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove /pricing page route (replaced by modal)"
```

---

### Task 12: Manual QA Verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test Browse entry point**

Navigate to `http://localhost:3000/ko/browse`. As a free user:
1. Verify locked clips show lock overlay
2. Click a locked clip → pricing modal opens
3. Verify modal has: title, billing toggle, Free/Pro cards, correct prices
4. Click backdrop → modal closes
5. Press ESC → modal closes
6. Verify "Pro로 잠금 해제" banner button opens modal

- [ ] **Step 3: Test Landing page entry point**

Navigate to `http://localhost:3000/ko`. Scroll to pricing section:
1. Inline cards still display correctly
2. Click "구독 시작" on Pro card → pricing modal opens
3. Toggle monthly/yearly in inline section (visual only)
4. Toggle monthly/yearly in modal (independent state)

- [ ] **Step 4: Test /pricing redirect**

Navigate to `http://localhost:3000/ko/pricing`:
1. Should redirect to `/ko/browse`
2. Same for `/en/pricing` → `/en/browse`

- [ ] **Step 5: Test mobile layout**

Use browser DevTools responsive mode (375px width):
1. Open pricing modal
2. Cards should stack vertically
3. Modal should be scrollable
4. Close button accessible

- [ ] **Step 6: Verify console clean**

Check browser console: 0 errors, 0 warnings target.
