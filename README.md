# Reflix

Reflix is a Next.js 16 clip browser backed by Eagle exports. The app keeps clip JSON media paths relative (`/videos/...`, `/previews/...`, `/thumbnails/...`) so the same data works in local dev, Vercel preview, and production hosted-media deployments.

The active publish scope is defined by [`config/release-batch.json`](./config/release-batch.json). Durable publish history is recorded in [`config/published-state.json`](./config/published-state.json). Local and production are considered aligned only when they are generated from the same release batch and history state.

## Environment

Copy `.env.local.example` to `.env.local` and fill in the pieces you need.

- Local dev and Vercel preview: leave `NEXT_PUBLIC_MEDIA_URL` unset so the app reads media from same-origin static assets.
- Production: set `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.dev` after the `media.reflix.dev` Worker route is live.
- Production protected media also requires `MEDIA_SESSION_SECRET`, `MEDIA_SESSION_COOKIE_DOMAIN=.reflix.dev`, and optionally `MEDIA_SESSION_TTL_SECONDS` (default `21600`).
- Set `PROTECT_MP4_PUBLIC_ASSETS=true` only for production app builds that should prune same-origin `public/videos` and `public/previews`.
- R2 upload commands require `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.
- Optional Sentry error tracking uses `NEXT_PUBLIC_SENTRY_DSN`; add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` only if you also want source map uploads during builds.
- Local Eagle source defaults to `/Users/macbook/Desktop/라이브러리/레퍼런스 - 게임,연출.library`; move to NAS later by changing `EAGLE_LIBRARY_PATH`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Media Export Workflow

Reflix media is generated from the active release batch first, then optionally uploaded to Cloudflare R2.

```bash
# Generate the active release batch from config/release-batch.json
npm run export:batch

# Preview the active batch without writing files
npm run export:batch:dry

# Generate the active batch, then upload the same assets to R2
npm run export:batch:r2

# Explicit prune pass for stale local artifacts outside the merged index
npm run export:prune

# Explicit full-library export (dangerous; requires opt-in)
npm run export:full
```

You can still override the active batch when needed:

```bash
# Export specific clip ids
node scripts/export.mjs --ids ID1,ID2

# Export a different batch file
node scripts/export.mjs --batch config/some-other-batch.json

# Preview planned R2 uploads without real credentials
node scripts/export.mjs --dry-run --r2

# Force a fresh export run instead of resuming an incomplete matching run
node scripts/export.mjs --fresh-run

# Resume a specific run directly
node scripts/export.mjs --resume-run <run-id>

# Tune concurrency per stage
node scripts/export.mjs --media-concurrency 4 --upload-concurrency 6

# Force a full related-clips rebuild
node scripts/export.mjs --force-related-full-rebuild
```

Generated media contract:

- `public/videos/{id}.mp4`
- `public/previews/{id}.mp4`
- `public/thumbnails/{id}.webp`

The exported JSON continues to reference these assets as relative paths.

Export runs now write resumable state under `.tmp/export-runs/<run-id>/`.

- Running the same export command again resumes the newest incomplete matching run by default.
- Use `--fresh-run` when you intentionally want to ignore resumable state and start over.
- Use `--resume-run <run-id>` when you want to resume a specific run directly.
- Operator-facing progress output is printed in Korean and reports each stage separately.

## Tag Translation Workflow

English tag labels are generated into `src/data/tag-i18n.json` from the current clip index plus deterministic rules in `scripts/config/tag-translation-rules.json`.

```bash
# Preview unresolved tags without writing output
node scripts/tag-translate.mjs --dry-run

# Generate and write src/data/tag-i18n.json
npm run tags:translate
```

- `GEMINI_API_KEY` is only required when unresolved Korean tags remain after rule-based translation.
- `npm run tags:translate -- --only-new` limits work to tags that are still missing from `src/data/tag-i18n.json`.
- `node scripts/tag-translate.mjs --dry-run --clip-id CLIP_ID` previews translation work for a single clip.

## Release Approval Workflow

The release commands and Eagle tags form the operator flow for Phase 2:

1. Run `npm run release:scan` to generate the proposed batch and proposal report for the current active batch under `.tmp/release-approval/<timestamp>/`.
2. Run `npm run release:review` to generate deterministic metadata-based review hints and mark review-needed Eagle items with `reflix:review-requested`.
3. Review the items in Eagle, editing names and content tags manually, then tag the chosen items with `reflix:approved`; tag items to exclude with `reflix:hold`.
4. Run `npm run release:approve` to promote the approved proposal into `config/release-batch.json`.
5. Run `npm run export:batch:dry` to verify the active batch before export.
6. Run `npm run export:batch` to materialize the active batch. This now runs `discover -> process-media -> build-artifacts -> compute-related -> finalize` with resumable checkpoints.
7. If export and verification succeed, run `npm run release:mark-published`.
8. If export or verification fails, run `npm run release:mark-failed`.

The active batch lives in `config/release-batch.json`, and `config/published-state.json` is the durable history of successful publishes.

Transitional note:

- `config/release-batch.json` remains the active input for export, but it should be updated through `npm run release:scan` and `npm run release:approve`, not by hand.
- `npm run release:scan` is canary-safe and scans only the current active batch. Use `npm run release:scan:all` only when you intentionally want a full eligible-library proposal.
- `reflix:review-requested` means Reflix wants a human to inspect the Eagle item before approval; it does not mean the item is already approved.
- After approval, run `npm run export:batch:dry`, then `npm run export:batch`, then verify browse/detail and the browse search flow (`/browse?q=...`) locally.
- If the export is interrupted, rerunning the same command resumes verified stages from `.tmp/export-runs/<run-id>/`.
- Only then consider `npm run export:batch:r2` or production deployment.

## Deployment Notes

- Vercel preview deployments should not set `NEXT_PUBLIC_MEDIA_URL`.
- Vercel preview deployments should not set `PROTECT_MP4_PUBLIC_ASSETS`.
- Production should set `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.dev`.
- Production should set `PROTECT_MP4_PUBLIC_ASSETS=true` only after the Cloudflare Worker on `media.reflix.dev` is deployed and `MEDIA_SESSION_SECRET` matches the app secret.
- Protected production builds intentionally prune `public/videos` and `public/previews` before `next build`; `thumbnails` and JSON stay public.
- The app issues a media session cookie from `src/proxy.ts`, and the Worker gates only `videos/*` plus `previews/*`.
- The app derives remote Next Image configuration from `NEXT_PUBLIC_MEDIA_URL`, so preview builds stay same-origin by default.

## Eagle Thumbnail Ops

- Pilot batch: `npm run eagle:thumbs:pilot`
- Remaining batch: `npm run eagle:thumbs:remaining`
