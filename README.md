# Reflix

Reflix is a Next.js 16 clip browser backed by Eagle exports. The app keeps clip JSON media paths relative (`/videos/...`, `/previews/...`, `/thumbnails/...`) so the same data works in local dev, Vercel preview, and production hosted-media deployments.

## Environment

Copy `.env.local.example` to `.env.local` and fill in the pieces you need.

- Local dev and Vercel preview: leave `NEXT_PUBLIC_MEDIA_URL` unset so the app reads media from same-origin static assets.
- Production: set `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.app` after the R2 custom domain is live.
- R2 upload commands require `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.

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

Reflix media is generated locally first, then optionally uploaded to Cloudflare R2.

```bash
# Generate local media assets into public/
npm run export:local

# Generate locally, then upload the same assets to R2
npm run export:r2

# Preview work without writing files
node scripts/export.mjs --dry-run

# Preview planned R2 uploads without real credentials
node scripts/export.mjs --dry-run --r2
```

Generated media contract:

- `public/videos/{id}.mp4`
- `public/previews/{id}.mp4`
- `public/thumbnails/{id}.webp`

The exported JSON continues to reference these assets as relative paths.

## Deployment Notes

- Vercel preview deployments should not set `NEXT_PUBLIC_MEDIA_URL`.
- Production should set `NEXT_PUBLIC_MEDIA_URL` only after `media.reflix.app` points to the R2 custom domain.
- The app derives remote Next Image configuration from `NEXT_PUBLIC_MEDIA_URL`, so preview builds stay same-origin by default.

## Eagle Thumbnail Ops

- Pilot batch: `npm run eagle:thumbs:pilot`
- Remaining batch: `npm run eagle:thumbs:remaining`
