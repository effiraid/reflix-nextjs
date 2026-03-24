# Reflix Hosted Media and Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship stable R2-backed media delivery for Reflix and complete the remaining playback/search surfaces that depend on hosted media.

**Architecture:** Keep clip JSON media paths relative (`/videos/...`, `/previews/...`, `/thumbnails/...`) so generated data stays environment-agnostic. Add a shared app-side media URL resolver that prefixes `NEXT_PUBLIC_MEDIA_URL` only when it is set, and add an explicit R2 upload mode to the export pipeline so the same generated assets can be uploaded to Cloudflare R2 without changing JSON structure. Once hosted media is stable, build `VideoPlayer`, `QuickViewModal`, the clip detail route, and a basic search route on top of the shared resolver.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest, Testing Library, Node.js ESM, `node:test`, FFmpeg, Cloudflare R2 via `@aws-sdk/client-s3`

**Spec References:**
- `docs/superpowers/specs/2026-03-22-reflix-design.md`
- `docs/media-strategy.md`
- `docs/superpowers/specs/2026-03-23-reflix-taxonomy-design.md`

**Out of Scope For This Plan:**
- Cloudflare Worker signed-video delivery and HMAC token validation
- Pagefind index generation for long-tail search
- Home page expansion, PWA/service worker, and 404 polish

---

## Current Decisions

These decisions are fixed for this plan and override older ambiguous drafts:

- **Media JSON stays relative-path based.**
  `videoUrl`, `previewUrl`, and `thumbnailUrl` remain `/videos/...`, `/previews/...`, and `/thumbnails/...` in generated JSON.
- **Stage-3 preview remains MP4, not animated WebP.**
  `docs/media-strategy.md` is the current source of truth for browse preview behavior.
- **Static thumbnail remains WebP.**
  Older references to PNG thumbnails in the March 22 design doc are treated as obsolete design history, not implementation targets.
- **Same-origin must work when `NEXT_PUBLIC_MEDIA_URL` is unset.**
  This is required for local development and Vercel preview deployments.
- **Production can point to `https://media.reflix.app`.**
  App code must only prefix that origin when the env var is explicitly set.
- **Export generates first, uploads second.**
  Local asset generation remains the canonical pipeline; R2 upload is an optional follow-up step, not a separate data contract.

## Environment Matrix

| Environment | `NEXT_PUBLIC_MEDIA_URL` | Asset source | Expected behavior |
|---|---|---|---|
| local dev | unset | same-origin `public/` | app loads `/thumbnails/...` and `/previews/...` directly |
| Vercel preview | unset | same-origin deployed static assets | preview builds do not depend on `media.reflix.app` |
| production web | `https://media.reflix.app` | R2 custom domain | app resolves all media URLs against hosted origin |

## External Ops Checklist

These are required for the final hosted-media verification task, but do not require app-code branching beyond env-driven behavior:

- Create or verify the `reflix-media` R2 bucket
- Upload test assets to `videos/`, `previews/`, and `thumbnails/`
- Point `media.reflix.app` to the R2 custom domain
- Apply the bucket CORS policy required by the design doc
- Set Vercel production env vars for `NEXT_PUBLIC_MEDIA_URL` and R2 credentials where needed
- Keep Vercel preview env free of `NEXT_PUBLIC_MEDIA_URL` until hosted media is intentionally validated there

## Rollout Order

This plan must be executed in order:

1. Fix the media URL contract in app code
2. Add explicit R2 upload support to the export pipeline
3. Verify same-origin preview behavior still works
4. Verify hosted R2 media works in production-like mode
5. Build playback surfaces (`VideoPlayer`, `QuickViewModal`, detail page)
6. Build the search route on top of the stabilized media contract

Do not start the playback or search tasks before the media contract and R2 upload path are verified.

---

## File Structure

```
src/
├── app/
│   └── [lang]/
│       ├── browse/
│       │   └── BrowseClient.tsx                 ← wire quick-view keyboard flow into the existing grid
│       ├── clip/
│       │   └── [id]/
│       │       └── page.tsx                     ← server route for detail playback page
│       └── search/
│           ├── page.tsx                         ← server route for search
│           └── SearchPageClient.tsx             ← client search rendering using existing filter logic
├── components/
│   ├── clip/
│   │   ├── VideoPlayer.tsx                      ← shared player for detail page + quick view
│   │   ├── VideoPlayer.test.tsx                 ← player interaction coverage
│   │   ├── QuickViewModal.tsx                   ← modal playback overlay for browse
│   │   ├── QuickViewModal.test.tsx              ← modal keyboard/backdrop coverage
│   │   ├── ClipDetailView.tsx                   ← presentational detail-page body
│   │   └── ClipDetailView.test.tsx              ← detail metadata coverage
│   ├── common/
│   │   ├── SearchBar.tsx                        ← shared query input with URL handoff
│   │   └── SearchBar.test.tsx                   ← search input behavior coverage
│   └── layout/
│       ├── Navbar.tsx                           ← replace ad hoc search UI with shared SearchBar
│       ├── RightPanelInspector.tsx              ← consume shared media URL resolver
│       └── RightPanelInspector.test.tsx         ← media URL rendering assertions
├── lib/
│   ├── mediaUrl.ts                              ← resolve relative media paths into same-origin or remote URLs
│   ├── mediaUrl.test.ts                         ← resolver contract coverage
│   ├── constants.ts                             ← remove hard-coded remote fallback
│   └── data.ts                                  ← existing clip loaders reused by detail/search routes
└── components/clip/
    ├── ClipCard.tsx                             ← consume shared media URL resolver
    └── ClipCard.test.tsx                        ← media URL rendering assertions

scripts/
├── export.mjs                                   ← generate media locally, optionally upload to R2
└── lib/
    ├── r2-uploader.mjs                          ← Cloudflare R2 upload client
    └── r2-uploader.test.mjs                     ← uploader env/key behavior coverage

repo root/
├── .env.local.example                           ← document local/prod media env vars
├── README.md                                    ← operator setup and export/deploy workflow
└── next.config.ts                               ← remote image host config derived from env
```

## Scope Notes

- This plan supersedes the remaining scope of `docs/superpowers/plans/archive/2026-03-23-reflix-implementation.md` for media delivery and late-phase playback/search work.
- Completed focused plans from `2026-03-23` remain valid and are not reopened here.
- The JSON contract stays relative-path based. Production points to `media.reflix.app` via environment config; preview/local deployments continue to work against same-origin assets when `NEXT_PUBLIC_MEDIA_URL` is unset.
- `docs/media-strategy.md` is the canonical media-format decision document whenever it conflicts with older design prose.

---

### Task 1: Freeze the Media URL Contract

**Files:**
- Create: `src/lib/mediaUrl.ts`
- Create: `src/lib/mediaUrl.test.ts`
- Modify: `src/lib/constants.ts`
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/components/clip/ClipCard.test.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`
- Modify: `src/components/layout/RightPanelInspector.test.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Write the failing resolver tests**

Create `src/lib/mediaUrl.test.ts` covering:
- relative path stays relative when no media base is configured
- `https://media.reflix.app` prefixes `/thumbnails/a.webp` without double slashes
- already-absolute URLs pass through unchanged
- empty/whitespace media base resolves to same-origin behavior

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `npx vitest run src/lib/mediaUrl.test.ts`
Expected: FAIL because `src/lib/mediaUrl.ts` does not exist yet.

- [ ] **Step 3: Implement the shared resolver and remove the hard-coded remote fallback**

In `src/lib/mediaUrl.ts`:
- export `getMediaUrl(path: string): string`
- export `getConfiguredMediaBase(): string`
- normalize trailing slashes
- return the original relative path when `NEXT_PUBLIC_MEDIA_URL` is missing

In `src/lib/constants.ts`:
- replace the current hard-coded `https://media.reflix.app` fallback with either an empty string or a call-through to the new helper contract

In `next.config.ts`:
- derive `remotePatterns` from `process.env.NEXT_PUBLIC_MEDIA_URL`
- keep `cacheComponents: true`
- do not assume `media.reflix.app` is always present for preview builds

- [ ] **Step 4: Wire the existing media consumers to the shared helper**

Update:
- `src/components/clip/ClipCard.tsx`
- `src/components/layout/RightPanelInspector.tsx`

Both files should import `getMediaUrl()` instead of concatenating `MEDIA_BASE_URL` manually.

Update existing component tests so they assert:
- relative URLs still render in test/dev mode
- absolute remote URLs render when the helper is mocked to return a remote base

- [ ] **Step 5: Run the focused UI and resolver tests**

Run: `npx vitest run src/lib/mediaUrl.test.ts src/components/clip/ClipCard.test.tsx src/components/layout/RightPanelInspector.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/mediaUrl.ts src/lib/mediaUrl.test.ts src/lib/constants.ts next.config.ts src/components/clip/ClipCard.tsx src/components/clip/ClipCard.test.tsx src/components/layout/RightPanelInspector.tsx src/components/layout/RightPanelInspector.test.tsx
git commit -m "feat: add environment-safe media URL resolution"
```

---

### Task 2: Add Explicit R2 Upload Support to the Export Pipeline

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`
- Modify: `README.md`
- Create: `scripts/lib/r2-uploader.mjs`
- Create: `scripts/lib/r2-uploader.test.mjs`
- Modify: `scripts/export.mjs`

- [ ] **Step 1: Write the failing uploader tests**

Create `scripts/lib/r2-uploader.test.mjs` covering:
- missing required R2 env vars throws a clear error
- upload keys preserve the relative-path contract (`videos/...`, `previews/...`, `thumbnails/...`)
- `content-type` mapping is correct for `.mp4` and `.webp`
- dry-run mode returns a summary without performing network work

- [ ] **Step 2: Run the uploader tests to verify they fail**

Run: `node --test scripts/lib/r2-uploader.test.mjs`
Expected: FAIL because `scripts/lib/r2-uploader.mjs` does not exist yet.

- [ ] **Step 3: Add the R2 client dependency and implement the uploader module**

Update `package.json`:
- add `@aws-sdk/client-s3`
- add one explicit upload script, for example `export:r2`

Implement `scripts/lib/r2-uploader.mjs` with:
- `createR2ClientFromEnv()`
- `uploadFile({ localPath, key, contentType, dryRun })`
- `uploadBatch(entries, { dryRun })`
- explicit env validation for `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

- [ ] **Step 4: Wire `scripts/export.mjs` to generate locally and optionally upload remotely**

Change `scripts/export.mjs` so:
- local artifact generation in `public/videos`, `public/previews`, `public/thumbnails` remains the canonical first step
- `--r2` becomes the explicit upload flag
- `--dry-run --r2` prints planned uploads without requiring real writes
- summary output clearly separates `generated`, `uploaded`, `skipped`, and `failed`
- upload keys exactly mirror the app contract:
  - `videos/{id}.mp4`
  - `previews/{id}.mp4`
  - `thumbnails/{id}.webp`

Do not change the JSON fields; they must remain relative (`/videos/...`, `/previews/...`, `/thumbnails/...`).

- [ ] **Step 5: Update operator docs and env examples**

Update `.env.local.example` and `README.md` to explain:
- preview/local deployments can leave `NEXT_PUBLIC_MEDIA_URL` unset
- production sets `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.app`
- local media build: `node scripts/export.mjs --local`
- hosted upload: `node scripts/export.mjs --local --r2`

- [ ] **Step 6: Run script verification**

Run:
- `node --test scripts/lib/r2-uploader.test.mjs`
- `node scripts/export.mjs --dry-run --limit 1`
- `node scripts/export.mjs --dry-run --limit 1 --local --r2`

Expected:
- uploader tests PASS
- dry run prints one-item summaries
- `--local --r2` shows planned local generation plus planned upload keys

- [ ] **Step 7: Commit**

```bash
git add package.json .env.local.example README.md scripts/lib/r2-uploader.mjs scripts/lib/r2-uploader.test.mjs scripts/export.mjs
git commit -m "feat: add explicit R2 upload mode to export pipeline"
```

---

### Task 3: Build the Shared Video Player

**Files:**
- Create: `src/components/clip/VideoPlayer.tsx`
- Create: `src/components/clip/VideoPlayer.test.tsx`

- [ ] **Step 1: Write the failing player tests**

Create `src/components/clip/VideoPlayer.test.tsx` covering:
- play/pause button toggles state
- compact mode hides speed controls and starts muted
- progress text renders current time and total duration
- right-click is prevented on the video surface
- `getMediaUrl()` is used for both `src` and `poster`

- [ ] **Step 2: Run the player tests to verify they fail**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: FAIL because `src/components/clip/VideoPlayer.tsx` does not exist yet.

- [ ] **Step 3: Implement the minimal player**

Implement `src/components/clip/VideoPlayer.tsx` with:
- custom play/pause button
- progress bar click-to-seek
- current time / duration display
- compact vs full mode
- `controlsList="nodownload nofullscreen noremoteplayback"`
- `disablePictureInPicture`
- right-click and drag prevention

Use `getMediaUrl()` for `videoUrl` and `thumbnailUrl`.

- [ ] **Step 4: Run the player tests to verify they pass**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: PASS

- [ ] **Step 5: Run nearby media tests**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx src/components/clip/ClipCard.test.tsx src/components/layout/RightPanelInspector.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/clip/VideoPlayer.tsx src/components/clip/VideoPlayer.test.tsx
git commit -m "feat: add shared video player for hosted media"
```

---

### Task 4: Add Browse Quick View With Keyboard Navigation

**Files:**
- Create: `src/components/clip/QuickViewModal.tsx`
- Create: `src/components/clip/QuickViewModal.test.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.test.tsx`
- Modify: `src/stores/uiStore.ts`

- [ ] **Step 1: Write the failing modal and browse tests**

Add tests that prove:
- pressing `Space` with a selected clip opens quick view
- `Escape` closes it
- `ArrowLeft` / `ArrowRight` navigate between visible clips
- backdrop click closes the modal
- modal renders `VideoPlayer` with the selected clip's URLs

- [ ] **Step 2: Run the targeted quick-view tests to verify they fail**

Run: `npx vitest run src/components/clip/QuickViewModal.test.tsx src/app/[lang]/browse/BrowseClient.test.tsx`
Expected: FAIL because quick-view UI does not exist yet.

- [ ] **Step 3: Implement the modal and state wiring**

Implement `QuickViewModal.tsx`:
- portal or top-level overlay rendering
- `VideoPlayer`
- title, tags, duration, and detail-link CTA
- backdrop close

Update `BrowseClient.tsx`:
- derive the visible filtered clip order
- open quick view on `Space`
- move selection left/right while modal is open

Keep state simple by reusing `selectedClipId` plus the existing `quickViewOpen` flag in `uiStore`.

- [ ] **Step 4: Run the targeted quick-view tests to verify they pass**

Run: `npx vitest run src/components/clip/QuickViewModal.test.tsx src/app/[lang]/browse/BrowseClient.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/clip/QuickViewModal.tsx src/components/clip/QuickViewModal.test.tsx src/app/[lang]/browse/BrowseClient.tsx src/app/[lang]/browse/BrowseClient.test.tsx src/stores/uiStore.ts
git commit -m "feat: add quick-view modal with keyboard navigation"
```

---

### Task 5: Build the Clip Detail Surface and Route

**Files:**
- Create: `src/components/clip/ClipDetailView.tsx`
- Create: `src/components/clip/ClipDetailView.test.tsx`
- Create: `src/app/[lang]/clip/[id]/page.tsx`
- Modify: `src/lib/data.ts`

**Docs to read first:**
- `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`

- [ ] **Step 1: Write the failing detail view test**

Create `src/components/clip/ClipDetailView.test.tsx` covering:
- title, annotation, tags, and stats render
- `VideoPlayer` receives the clip's hosted media paths
- related-clips section renders only when `relatedClips.length > 0`

- [ ] **Step 2: Run the detail view test to verify it fails**

Run: `npx vitest run src/components/clip/ClipDetailView.test.tsx`
Expected: FAIL because `ClipDetailView.tsx` does not exist yet.

- [ ] **Step 3: Implement the presentational detail view**

Create `ClipDetailView.tsx` as a pure presentational component that receives:
- `clip`
- `lang`
- `dict`

It should render `VideoPlayer`, metadata fields, tag chips, and a minimal related-clips stub.

- [ ] **Step 4: Create the server route page**

Create `src/app/[lang]/clip/[id]/page.tsx`:
- use promise-based `params`
- load clip via `getClip(id)`
- return `notFound()` when absent
- use `'use cache'` plus `cacheLife()`
- export `generateMetadata()`

If `src/lib/data.ts` needs a small helper to support the page cleanly, add it there without changing the JSON contract.

- [ ] **Step 5: Run focused verification**

Run:
- `npx vitest run src/components/clip/ClipDetailView.test.tsx`
- `npm run build`

Expected:
- detail view test PASS
- build PASS with the new dynamic route

- [ ] **Step 6: Commit**

```bash
git add src/components/clip/ClipDetailView.tsx src/components/clip/ClipDetailView.test.tsx src/app/[lang]/clip/[id]/page.tsx src/lib/data.ts
git commit -m "feat: add clip detail page for hosted playback"
```

---

### Task 6: Add the Basic Search Route and Shared SearchBar

**Files:**
- Create: `src/components/common/SearchBar.tsx`
- Create: `src/components/common/SearchBar.test.tsx`
- Create: `src/app/[lang]/search/SearchPageClient.tsx`
- Create: `src/app/[lang]/search/SearchPageClient.test.tsx`
- Create: `src/app/[lang]/search/page.tsx`
- Modify: `src/components/layout/Navbar.tsx`

- [ ] **Step 1: Write the failing search component tests**

Create tests covering:
- `SearchBar` reflects the current query and emits updates
- `SearchPageClient` filters clips with the existing `filterClips()` search logic
- empty-query search page shows a non-error empty state

- [ ] **Step 2: Run the search tests to verify they fail**

Run: `npx vitest run src/components/common/SearchBar.test.tsx src/app/[lang]/search/SearchPageClient.test.tsx`
Expected: FAIL because the new files do not exist yet.

- [ ] **Step 3: Implement the shared SearchBar and search client page**

Create `SearchBar.tsx`:
- controlled input
- optional submit/navigation callback
- no Pagefind dependency yet

Create `SearchPageClient.tsx`:
- consume `initialClips`
- read or receive the query
- reuse `filterClips()` and existing masonry rendering

- [ ] **Step 4: Create the server route and wire Navbar**

Create `src/app/[lang]/search/page.tsx`:
- load `dict`, `clipIndex`, `categories`, `tagI18n`
- pass the current query to `SearchPageClient`

Update `Navbar.tsx`:
- replace ad hoc search input logic with `SearchBar`
- navigate to `/${lang}/search?q=...`

- [ ] **Step 5: Run focused verification**

Run:
- `npx vitest run src/components/common/SearchBar.test.tsx src/app/[lang]/search/SearchPageClient.test.tsx src/components/layout/Navbar.test.tsx`
- `npm run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/common/SearchBar.tsx src/components/common/SearchBar.test.tsx src/app/[lang]/search/SearchPageClient.tsx src/app/[lang]/search/SearchPageClient.test.tsx src/app/[lang]/search/page.tsx src/components/layout/Navbar.tsx
git commit -m "feat: add hosted-media search route and shared search bar"
```

---

### Task 7: End-to-End Hosted Media Verification

**Files:**
- Verify only: `.env.local.example`
- Verify only: `README.md`
- Verify only: `next.config.ts`
- Verify only: `scripts/export.mjs`
- Verify only: `src/app/[lang]/browse/page.tsx`
- Verify only: `src/app/[lang]/clip/[id]/page.tsx`
- Verify only: `src/app/[lang]/search/page.tsx`

- [ ] **Step 1: Prepare production-like env values**

Set or verify:
- `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.app`
- `R2_ACCOUNT_ID=...`
- `R2_ACCESS_KEY_ID=...`
- `R2_SECRET_ACCESS_KEY=...`
- `R2_BUCKET_NAME=reflix-media`
- `R2_PUBLIC_URL=https://media.reflix.app`

- [ ] **Step 2: Generate and upload a small verification batch**

Run:
- `node scripts/export.mjs --ids <one-or-five-real-ids> --local --r2`

Expected:
- local `public/` assets exist
- upload summary includes `videos/...`, `previews/...`, `thumbnails/...`

- [ ] **Step 3: Verify the remote media endpoints directly**

Check:
- `https://media.reflix.app/thumbnails/<id>.webp`
- `https://media.reflix.app/previews/<id>.mp4`
- `https://media.reflix.app/videos/<id>.mp4`

Expected: `200 OK` with correct `content-type`

- [ ] **Step 4: Verify the app surfaces against hosted media**

Check in browser:
- `/ko/browse`
- `/ko/clip/<id>`
- `/ko/search?q=<term>`

Expected:
- browse thumbnails load without broken-image placeholders
- quick view and detail page playback work
- search results render clip cards normally
- Vercel preview still works correctly when `NEXT_PUBLIC_MEDIA_URL` is removed

- [ ] **Step 5: Run final project verification**

Run:
- `node --test scripts/lib/r2-uploader.test.mjs`
- `npx vitest run src/lib/mediaUrl.test.ts src/components/clip/VideoPlayer.test.tsx src/components/clip/QuickViewModal.test.tsx src/components/clip/ClipDetailView.test.tsx src/components/common/SearchBar.test.tsx src/app/[lang]/search/SearchPageClient.test.tsx`
- `npm run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: verify hosted media flow across browse playback and search"
```

---

## Follow-Up Backlog After This Plan

- Cloudflare Worker signed URLs for original video protection
- Pagefind indexing and taxonomy-driven long-tail search
- Home page enrichment from the old master plan
- PWA manifest, service worker, and 404 polish
