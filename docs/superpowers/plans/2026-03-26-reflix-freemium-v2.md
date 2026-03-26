# Reflix Freemium V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a freemium layer for Reflix that preserves the current static browsing model, shows the full catalog as teaser inventory, and gates full video playback behind free-manifest rules plus paid upgrade.

**Architecture:** Keep `src/data/index.json` and clip metadata static so browse performance and deployment shape do not change. Protect media at the Cloudflare Worker layer: everyone gets a short-lived `free` media session cookie from `proxy.ts`, full videos are allowed only for clips listed in `config/free-clips.json` or for users whose auth-backed refresh route upgrades the cookie to `pro`, and all UI paywalls key off the same `accessTier` field.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand, Cloudflare Worker + R2, Supabase Auth/Postgres, Stripe

---

## Locked Product Decisions

- Full catalog stays visible in browse. `Pro` clips are teaser inventory, not hidden inventory.
- `thumbnails` remain public. `previews` remain worker-protected but accessible with the default free media cookie.
- `videos` are accessible only when the requested clip is in the free manifest or the media cookie has `tier: "pro"`.
- `proxy.ts` never talks to Supabase. It only issues the default free media cookie and handles locale redirect logic.
- `Supabase` is used only for user auth/profile state. `Stripe` is used only for billing. The worker never queries either service.
- `boards` are not part of launch MVP. They are a phase-2 retention feature after paid access is live.
- `daily usage limits` are phase-1.5. Launch can ship with catalog teaser + clip gating + subscription, then add quota if needed.

## Scope Split

### MVP Launch Scope

- Catalog teaser with `accessTier` metadata
- Free clip manifest
- Worker enforcement for preview/video access
- Paywall UI across browse, quick view, detail, and right panel
- Supabase auth
- Stripe checkout + webhook + account page
- Pro media-session refresh route

### Explicitly Out of Scope for MVP

- Boards and saved collections
- Team licenses
- SSO
- Per-user recommendation engine
- Admin dashboard
- Multi-quality transcoding

## File Structure

### Data + Access Model

- Create: `config/free-clips.json`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/filter.ts`
- Modify: `src/lib/filter.test.ts`
- Modify: `scripts/lib/index-builder.mjs`
- Modify: `scripts/export.mjs` only if flag plumbing is needed for free-manifest loading

### Media Session + Worker

- Modify: `src/lib/mediaSession.ts`
- Modify: `src/proxy.ts`
- Modify: `workers/media-gateway/src/index.ts`
- Modify: `workers/media-gateway/src/index.test.ts`
- Modify: `src/proxy.test.ts`
- Modify: `src/lib/mediaSession.test.ts`

### UI Gating

- Create: `src/components/auth/AccessGate.tsx`
- Create: `src/components/auth/ProBadge.tsx`
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/components/clip/QuickViewModal.tsx`
- Modify: `src/components/clip/ClipDetailView.tsx`
- Modify: `src/components/clip/ClipDetailLayout.tsx`
- Modify: `src/components/layout/RightPanelContent.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `src/app/[lang]/clip/[id]/page.tsx`

### Auth + Billing

- Modify: `package.json`
- Create: `supabase/migrations/20260326_freemium.sql`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/stores/authStore.ts`
- Create: `src/components/auth/AuthProvider.tsx`
- Create: `src/app/api/media-session/route.ts`
- Create: `src/app/api/checkout/route.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`
- Create: `src/app/[lang]/login/page.tsx`
- Create: `src/app/[lang]/pricing/page.tsx`
- Create: `src/app/[lang]/account/page.tsx`
- Modify: `src/app/[lang]/layout.tsx`
- Modify: `src/app/[lang]/dictionaries/ko.json`
- Modify: `src/app/[lang]/dictionaries/en.json`

### Phase-1.5 Usage Limits

- Create: `src/lib/usage.ts`
- Create: `src/app/api/usage/route.ts`
- Modify: `src/stores/authStore.ts`
- Modify: `src/components/auth/AccessGate.tsx`
- Create: `src/lib/usage.test.ts`

---

### Task 1: Add Access Metadata Without Breaking Static Browse

**Files:**
- Create: `config/free-clips.json`
- Modify: `src/lib/types.ts`
- Modify: `scripts/lib/index-builder.mjs`
- Modify: `src/lib/filter.ts`
- Test: `src/lib/filter.test.ts`

- [ ] Add `accessTier: "free" | "pro"` to both `Clip` and `ClipIndex` in [`src/lib/types.ts`](/Users/macbook/reflix-nextjs/src/lib/types.ts).
- [ ] Create `config/free-clips.json` as the single source of truth for launch-free clip ids.
- [ ] Update `buildClipIndex()` and `buildFullClip()` in [`scripts/lib/index-builder.mjs`](/Users/macbook/reflix-nextjs/scripts/lib/index-builder.mjs) to set `accessTier` from the manifest.
- [ ] Keep teaser-safe metadata public for all clips. Do not remove `previewUrl` or basic tags/categories from the static index.
- [ ] Update `filterClips()` in [`src/lib/filter.ts`](/Users/macbook/reflix-nextjs/src/lib/filter.ts) so browse can support a mixed catalog; do not hard-filter pro clips out for free users.
- [ ] Extend [`src/lib/filter.test.ts`](/Users/macbook/reflix-nextjs/src/lib/filter.test.ts) with cases for:
  - mixed free/pro clips stay visible in browse
  - future “free-only” views can still be derived by explicit filter
  - sorting/search behavior is unchanged by `accessTier`
- [ ] Run: `npm test -- src/lib/filter.test.ts`

### Task 2: Move Access Enforcement to the Worker, Not the Page Tree

**Files:**
- Modify: `src/lib/mediaSession.ts`
- Modify: `src/proxy.ts`
- Modify: `workers/media-gateway/src/index.ts`
- Test: `src/lib/mediaSession.test.ts`
- Test: `src/proxy.test.ts`
- Test: `workers/media-gateway/src/index.test.ts`

- [ ] Extend the media token payload in [`src/lib/mediaSession.ts`](/Users/macbook/reflix-nextjs/src/lib/mediaSession.ts) to include `tier: "free" | "pro"`.
- [ ] Keep token verification backward-safe only if there are existing deployed v1 cookies to support; otherwise cut directly to v2 and update tests.
- [ ] Change [`src/proxy.ts`](/Users/macbook/reflix-nextjs/src/proxy.ts) to mint a default `free` media session cookie for all non-static page requests. Do not add any Supabase lookup here.
- [ ] Update [`workers/media-gateway/src/index.ts`](/Users/macbook/reflix-nextjs/workers/media-gateway/src/index.ts) with the new rules:
  - `/thumbnails/*` stays public
  - `/previews/*` requires a valid media cookie and valid origin/referrer
  - `/videos/*` requires a valid media cookie and either `tier === "pro"` or `clipId` present in `FREE_CLIP_IDS`
- [ ] Load `FREE_CLIP_IDS` into the worker as a bundled manifest so authorization does not depend on network/database access.
- [ ] Add worker tests for:
  - free cookie + free clip video -> `200`
  - free cookie + pro clip video -> `403`
  - pro cookie + pro clip video -> `200`
  - missing cookie + preview -> `403`
  - public thumbnail -> `200`
- [ ] Run:
  - `npm test -- src/lib/mediaSession.test.ts`
  - `npm test -- src/proxy.test.ts`
  - `npm test -- workers/media-gateway/src/index.test.ts`

### Task 3: Gate Every Playback Surface With the Same Rule

**Files:**
- Create: `src/components/auth/AccessGate.tsx`
- Create: `src/components/auth/ProBadge.tsx`
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `src/components/clip/QuickViewModal.tsx`
- Modify: `src/components/clip/ClipDetailView.tsx`
- Modify: `src/components/clip/ClipDetailLayout.tsx`
- Modify: `src/components/layout/RightPanelContent.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`

- [ ] Create `AccessGate` as a presentational gate that takes:
  - `clipAccessTier`
  - `userTier`
  - `surface` (`quick-view`, `detail`, `inspector`)
  - `onUpgrade`
  - `children`
- [ ] Create `ProBadge` for clip cards so the mixed teaser grid is visually explicit.
- [ ] Update [`ClipCard.tsx`](/Users/macbook/reflix-nextjs/src/components/clip/ClipCard.tsx) to render the badge and locked-state styling without breaking current selection behavior.
- [ ] Update [`BrowseClient.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/browse/BrowseClient.tsx) so free users still browse the full catalog, but opening a pro clip routes into paywall behavior rather than silent failure.
- [ ] Update [`QuickViewModal.tsx`](/Users/macbook/reflix-nextjs/src/components/clip/QuickViewModal.tsx) because it currently renders a player directly from `clip.id`; this is one of the main paywall leaks.
- [ ] Update [`ClipDetailView.tsx`](/Users/macbook/reflix-nextjs/src/components/clip/ClipDetailView.tsx) and [`ClipDetailLayout.tsx`](/Users/macbook/reflix-nextjs/src/components/clip/ClipDetailLayout.tsx) so pro clips show teaser metadata plus paywall UI until the user is entitled.
- [ ] Update [`RightPanelContent.tsx`](/Users/macbook/reflix-nextjs/src/components/layout/RightPanelContent.tsx) and [`RightPanelInspector.tsx`](/Users/macbook/reflix-nextjs/src/components/layout/RightPanelInspector.tsx) so the inspector never auto-plays a pro preview path without the same access decision already made in browse state.
- [ ] Add/extend component tests for:
  - free user sees locked teaser card
  - quick view on pro clip opens paywall, not player
  - detail page for free clip still plays
  - inspector on pro clip does not bypass paywall

### Task 4: Add Auth State as a UI Layer, Not a Data Fetching Rewrite

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/stores/authStore.ts`
- Create: `src/components/auth/AuthProvider.tsx`
- Modify: `src/app/[lang]/layout.tsx`
- Create: `src/app/[lang]/login/page.tsx`

- [ ] Add dependencies in [`package.json`](/Users/macbook/reflix-nextjs/package.json): `@supabase/ssr`, `@supabase/supabase-js`, `stripe`.
- [ ] Create browser/server/admin Supabase clients under `src/lib/supabase/`.
- [ ] Create `authStore` with only launch-critical state:
  - `user`
  - `isLoading`
  - `tier`
  - `refreshMediaSession()`
- [ ] Create `AuthProvider` to listen for Supabase auth changes and refresh the media cookie after login/logout by calling `/api/media-session`.
- [ ] Wrap [`src/app/[lang]/layout.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/layout.tsx) with the provider. Do not move page-level static data fetching into auth-aware server components.
- [ ] Create a minimal [`login/page.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/login/page.tsx) with magic link and one social option if configured.
- [ ] Keep auth state client-side for MVP. Do not rebuild browse/detail around server-side session checks.

### Task 5: Issue the Pro Media Cookie From a Route Handler

**Files:**
- Create: `supabase/migrations/20260326_freemium.sql`
- Create: `src/app/api/media-session/route.ts`
- Create: `src/lib/supabase/admin.ts`
- Test: route handler test file if test harness exists, otherwise cover via integration/manual checklist

- [ ] Create `profiles` and `subscriptions` tables in `supabase/migrations/20260326_freemium.sql`.
- [ ] Keep `profiles.tier` as the app-level truth for MVP.
- [ ] In [`src/app/api/media-session/route.ts`](/Users/macbook/reflix-nextjs/src/app/api/media-session/route.ts), verify the current Supabase user session.
- [ ] If no authenticated user exists, overwrite the media cookie with `tier: "free"`.
- [ ] If a user exists, look up `profiles.tier` and mint a short-lived media cookie with `tier: "pro"` or `tier: "free"`.
- [ ] Set cookie expiry shorter than the auth session, so webhook/profile changes converge quickly.
- [ ] Manual verification:
  - signed out -> cookie tier becomes `free`
  - signed in free user -> cookie tier stays `free`
  - signed in pro user -> cookie tier becomes `pro`

### Task 6: Add Stripe Without Letting Billing Bleed Into Media Enforcement

**Files:**
- Create: `src/app/api/checkout/route.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`
- Create: `src/app/[lang]/pricing/page.tsx`
- Create: `src/app/[lang]/account/page.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/app/[lang]/dictionaries/ko.json`
- Modify: `src/app/[lang]/dictionaries/en.json`

- [ ] Create hosted checkout route that requires an authenticated user and creates a Stripe Checkout Session.
- [ ] Store `user_id` in Stripe metadata so the webhook can update the correct profile.
- [ ] Create webhook handling for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Webhook updates only `profiles` and `subscriptions`. It does not talk to the worker.
- [ ] Pricing page must match the locked product decision: full catalog visible, full video playback is what upgrades.
- [ ] Account page needs only:
  - current tier
  - billing state
  - Stripe customer portal button
- [ ] Navbar changes:
  - signed out -> `로그인`
  - signed in free -> `계정`, `업그레이드`
  - signed in pro -> `계정`, `구독 관리`
- [ ] Manual verification:
  - pricing -> checkout -> webhook -> account shows `pro`
  - after successful upgrade, `AuthProvider` refreshes media session and pro clips play without full page reload

### Task 7: Add Usage Limits Only After Paid Access Works

**Files:**
- Create: `src/lib/usage.ts`
- Create: `src/app/api/usage/route.ts`
- Modify: `src/stores/authStore.ts`
- Modify: `src/components/auth/AccessGate.tsx`
- Test: `src/lib/usage.test.ts`

- [ ] Count only intentional premium-value actions:
  - opening quick view
  - starting full detail playback
- [ ] Do not count:
  - hover previews
  - inspector teaser playback
  - card visibility
- [ ] Enforce quota in the API route, not only in Zustand.
- [ ] Show quota UI from `AccessGate`, not in random feature branches.
- [ ] If launch pressure is high, defer this entire task and ship MVP without quota.

## Test Matrix

- Unit:
  - `src/lib/filter.test.ts`
  - `src/lib/mediaSession.test.ts`
  - `workers/media-gateway/src/index.test.ts`
  - `src/lib/usage.test.ts` if Task 7 ships
- Component:
  - `ClipCard`
  - `QuickViewModal`
  - `ClipDetailView`
  - `RightPanelInspector`
  - `Navbar`
- Manual integration:
  - signed-out teaser browse
  - free clip playback
  - pro clip paywall
  - login refreshes media cookie
  - successful payment unlocks pro playback
  - cancellation eventually downgrades playback

## Rollout Order

1. Task 1
2. Task 2
3. Task 3
4. Manual QA on teaser/paywall without auth
5. Task 4
6. Task 5
7. Task 6
8. Manual billing QA
9. Task 7 only if needed before launch

## Spec Coverage Check

- Download blocking remains anchored in worker-mediated media access, not in UI-only restrictions.
- Full-catalog teaser is preserved.
- Static browse/detail architecture remains intact for performance.
- Paid access, login, pricing, and account management are covered.
- Boards were intentionally removed from MVP because they are orthogonal to proving willingness to pay.

## Open Risks To Watch During Implementation

- Supabase auth cookie naming/refresh behavior in Next 16 must be verified in this repo before relying on auto-refresh assumptions.
- Stripe webhook lag can briefly delay unlock; `AuthProvider` should offer a manual “권한 새로고침” escape hatch on the account page.
- If preview assets are judged too high-value, move them behind stricter worker logic later without changing the overall plan shape.
