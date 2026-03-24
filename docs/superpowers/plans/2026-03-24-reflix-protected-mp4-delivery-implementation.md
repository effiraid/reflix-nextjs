# Reflix Protected MP4 Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep animated browse previews and detail playback working while making production `mp4` delivery cookie-gated behind a Cloudflare Worker, without adding per-card signing round-trips.

**Architecture:** Reuse the existing relative-path media contract and single `NEXT_PUBLIC_MEDIA_URL` prefixing helper. Add a shared HMAC session-token module used by both Next `proxy.ts` and a new `media.reflix.dev` Cloudflare Worker, make UI surfaces fail closed when protected `mp4` requests fail, and prune `public/videos` plus `public/previews` during protected production builds so `reflix.dev` never exposes raw `mp4` files.

**Tech Stack:** Next.js 16 proxy, React 19, TypeScript 5, Vitest, Testing Library, Node.js ESM scripts, Cloudflare Workers, Cloudflare R2, Wrangler

---

## File Map

- Create: `src/lib/mediaSession.ts`
  Shared Web Crypto helpers for HMAC signing, token verification, protected-path detection, and cookie option assembly. Must stay runtime-neutral so both Next proxy and Cloudflare Worker can import it.
- Create: `src/lib/mediaSession.test.ts`
  Unit coverage for token round-trips, expiry, tamper rejection, and path classification.
- Modify: `src/proxy.ts`
  Upgrade the locale proxy to issue a short-lived media session cookie on page responses when protected media delivery is enabled.
- Create: `src/proxy.test.ts`
  Covers cookie issuance on page requests, no-op behavior for local/preview mode, and redirect responses still receiving the cookie.
- Modify: `src/components/clip/ClipCard.tsx`
  Add fail-closed preview fallback so browse cards silently drop to static thumbnails if protected preview playback fails.
- Modify: `src/components/clip/ClipCard.test.tsx`
  Covers preview video rendering and fallback behavior after an error event.
- Modify: `src/components/layout/RightPanelInspector.tsx`
  Add the same fail-closed preview fallback for the inspector panel.
- Modify: `src/components/layout/RightPanelInspector.test.tsx`
  Covers preview error fallback back to static thumbnail rendering.
- Modify: `src/components/clip/VideoPlayer.tsx`
  Track protected full-video load failures, preserve the poster, and disable interactive playback instead of falling back to public paths.
- Modify: `src/components/clip/VideoPlayer.test.tsx`
  Covers protected URL resolution, autoplay behavior, and fail-closed playback after media errors.
- Create: `scripts/prepare-protected-public-build.mjs`
  Production-only build-prep entrypoint that removes `public/videos` and `public/previews` before `next build` when protection is enabled.
- Create: `scripts/lib/protected-public-build.mjs`
  Pure Node helper used by the build-prep script and tested in isolation.
- Create: `scripts/lib/protected-public-build.test.mjs`
  Temp-project tests covering no-op mode and protected pruning mode.
- Modify: `package.json`
  Add Worker scripts, protected build prep to `build`, and any needed dev dependencies.
- Modify: `tsconfig.json`
  Exclude Worker source from Next app typechecking so the app build is not coupled to Worker runtime globals.
- Add: `workers/media-gateway/wrangler.toml`
  Worker entrypoint, custom-domain routing, R2 binding, and deployment config.
- Add: `workers/media-gateway/tsconfig.json`
  Worker-local TypeScript config so the gateway can use Cloudflare types cleanly.
- Add: `workers/media-gateway/src/index.ts`
  Cookie-gated media gateway for `videos/*`, `previews/*`, and public pass-through for `thumbnails/*`, including `GET`, `HEAD`, and `Range`.
- Add: `workers/media-gateway/src/index.test.ts`
  Unit tests for protected path handling, cookie rejection, thumbnail pass-through, and ranged reads.
- Modify: `.env.local.example`
  Document the new media protection env vars.
- Modify: `README.md`
  Update the production build/deploy flow to use the protected media gateway.
- Modify: `docs/media-strategy.md`
  Update the deployment section so production `mp4` delivery is documented as Worker-gated, not public static hosting.

## Reference Docs

- Next.js proxy file convention: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- Next.js `NextResponse` cookies: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-response.md`
- Cloudflare Workers custom domains: [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- Cloudflare Wrangler config: [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- Cloudflare R2 Workers API ranged reads: [R2 Workers API Reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)

## Environment Contract

- `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.dev`
- `MEDIA_SESSION_SECRET=<shared-hmac-secret>`
- `MEDIA_SESSION_COOKIE_DOMAIN=.reflix.dev`
- `MEDIA_SESSION_TTL_SECONDS=21600`
- `PROTECT_MP4_PUBLIC_ASSETS=true` in production builds only

Worker secrets and vars:

- Wrangler secret: `MEDIA_SESSION_SECRET`
- Wrangler var or hardcoded route target: `media.reflix.dev`
- R2 bucket binding: `MEDIA_BUCKET -> reflix-media`

## Task 1: Add Shared Media Session Primitives

**Files:**
- Create: `src/lib/mediaSession.ts`
- Test: `src/lib/mediaSession.test.ts`

- [ ] **Step 1: Write the failing token and path tests**

```ts
import { describe, expect, it, vi } from "vitest";
import {
  isProtectedMediaPath,
  signMediaSessionToken,
  verifyMediaSessionToken,
} from "./mediaSession";

describe("mediaSession", () => {
  it("flags videos and previews as protected paths", () => {
    expect(isProtectedMediaPath("/videos/clip-1.mp4")).toBe(true);
    expect(isProtectedMediaPath("/previews/clip-1.mp4")).toBe(true);
    expect(isProtectedMediaPath("/thumbnails/clip-1.webp")).toBe(false);
  });

  it("round-trips a valid signed session token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T15:00:00Z"));

    const token = await signMediaSessionToken(
      { v: 1, host: "reflix.dev", exp: Date.now() + 60_000 },
      "test-secret"
    );

    await expect(
      verifyMediaSessionToken(token, "test-secret", Date.now())
    ).resolves.toMatchObject({ host: "reflix.dev", v: 1 });
  });

  it("rejects tampered or expired tokens", async () => {
    const token = await signMediaSessionToken(
      { v: 1, host: "reflix.dev", exp: Date.now() - 1 },
      "test-secret"
    );

    await expect(
      verifyMediaSessionToken(token, "test-secret", Date.now())
    ).resolves.toBeNull();
    await expect(
      verifyMediaSessionToken(`${token}x`, "test-secret", Date.now())
    ).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mediaSession.test.ts`

Expected: FAIL because `src/lib/mediaSession.ts` does not exist yet.

- [ ] **Step 3: Write the minimal shared implementation**

```ts
export const MEDIA_SESSION_COOKIE_NAME = "reflix-media-session";

const PROTECTED_PREFIXES = ["/videos/", "/previews/"] as const;

export function isProtectedMediaPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function signMediaSessionToken(
  payload: { v: number; host: string; exp: number },
  secret: string
): Promise<string> {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = await signBody(body, secret);
  return `${body}.${signature}`;
}

export async function verifyMediaSessionToken(
  token: string,
  secret: string,
  now: number
) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if ((await signBody(body, secret)) !== signature) return null;

  const payload = JSON.parse(fromBase64Url(body)) as {
    v: number;
    host: string;
    exp: number;
  };

  return payload.exp > now ? payload : null;
}
```

- [ ] **Step 4: Add config helpers needed by the Next proxy**

```ts
export function getMediaSessionConfig(
  env: Record<string, string | undefined>
) {
  const mediaBase = (env.NEXT_PUBLIC_MEDIA_URL ?? "").trim();
  const secret = (env.MEDIA_SESSION_SECRET ?? "").trim();
  const domain = (env.MEDIA_SESSION_COOKIE_DOMAIN ?? "").trim();
  const ttlSeconds = Number.parseInt(env.MEDIA_SESSION_TTL_SECONDS ?? "21600", 10);

  return {
    enabled: Boolean(mediaBase && secret && domain),
    mediaBase,
    secret,
    domain,
    ttlSeconds: Number.isNaN(ttlSeconds) ? 21600 : ttlSeconds,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/mediaSession.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/mediaSession.ts src/lib/mediaSession.test.ts
git commit -m "feat: add shared media session helpers"
```

### Task 2: Issue Media Session Cookies in Next Proxy

**Files:**
- Modify: `src/proxy.ts`
- Test: `src/proxy.test.ts`
- Reference: `src/lib/mediaSession.ts`

- [ ] **Step 1: Write the failing proxy tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("proxy media session cookie", () => {
  it("sets the media session cookie on locale page responses in protected mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.dev");
    vi.stubEnv("MEDIA_SESSION_SECRET", "test-secret");
    vi.stubEnv("MEDIA_SESSION_COOKIE_DOMAIN", ".reflix.dev");

    const response = await proxy(
      new NextRequest("https://reflix.dev/ko/browse")
    );

    expect(response.cookies.get("reflix-media-session")).toBeDefined();
  });

  it("does not set the cookie when hosted media protection is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", undefined);

    const response = await proxy(
      new NextRequest("https://reflix.dev/ko/browse")
    );

    expect(response.cookies.get("reflix-media-session")).toBeUndefined();
  });

  it("sets the cookie on locale redirect responses too", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.dev");
    vi.stubEnv("MEDIA_SESSION_SECRET", "test-secret");
    vi.stubEnv("MEDIA_SESSION_COOKIE_DOMAIN", ".reflix.dev");

    const response = await proxy(new NextRequest("https://reflix.dev/browse"));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.cookies.get("reflix-media-session")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/proxy.test.ts`

Expected: FAIL because `proxy.ts` does not issue the cookie yet.

- [ ] **Step 3: Convert `proxy` to async and centralize response finalization**

```ts
function withMediaSession(
  request: NextRequest,
  response: NextResponse,
  config: ReturnType<typeof getMediaSessionConfig>
): Promise<NextResponse> {
  // sign token only when config is enabled
  // return original response untouched otherwise
}

export async function proxy(request: NextRequest) {
  const config = getMediaSessionConfig(process.env);
  // existing locale logic
  return withMediaSession(request, response, config);
}
```

- [ ] **Step 4: Set cookie options exactly once**

```ts
response.cookies.set({
  name: MEDIA_SESSION_COOKIE_NAME,
  value: token,
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  domain: config.domain,
  path: "/",
  maxAge: config.ttlSeconds,
});
```

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/lib/mediaSession.test.ts src/proxy.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts src/lib/mediaSession.ts
git commit -m "feat: issue media session cookies in proxy"
```

### Task 3: Add Fail-Closed Preview Fallbacks for Browse and Inspector

**Files:**
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/components/clip/ClipCard.test.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`
- Modify: `src/components/layout/RightPanelInspector.test.tsx`

- [ ] **Step 1: Write the failing preview fallback tests**

```ts
it("drops the browse preview overlay after a preview video error", () => {
  // mock useIntersectionLoader => { stage: "webp", isInView: true }
  render(<ClipCard clip={clip} />);

  const preview = document.querySelector("video");
  expect(preview).not.toBeNull();

  fireEvent.error(preview!);

  expect(document.querySelector("video")).toBeNull();
  expect(screen.getByAltText(clip.name)).toBeInTheDocument();
});

it("falls back to the inspector thumbnail when the preview video errors", () => {
  render(
    <RightPanelInspector clip={clip} categories={categories} lang="ko" dict={dict} />
  );

  const preview = document.querySelector("video");
  fireEvent.error(preview!);

  expect(screen.getByAltText("블레이드 스톰")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/clip/ClipCard.test.tsx src/components/layout/RightPanelInspector.test.tsx`

Expected: FAIL because neither component tracks media errors yet.

- [ ] **Step 3: Implement preview failure state in `ClipCard`**

```tsx
const [previewFailed, setPreviewFailed] = useState(false);

useEffect(() => {
  setPreviewFailed(false);
}, [previewUrl]);

const showPreview =
  enablePreview && stage === "webp" && isInView && !previewFailed;

<video
  src={previewUrl}
  muted
  autoPlay
  loop
  playsInline
  onError={() => setPreviewFailed(true)}
/>
```

- [ ] **Step 4: Implement the same fallback in `RightPanelInspector`**

```tsx
const [previewFailed, setPreviewFailed] = useState(false);

useEffect(() => {
  setPreviewFailed(false);
}, [previewUrl]);

{mediaKindKey === "video" && !previewFailed ? (
  <video ... onError={() => setPreviewFailed(true)} />
) : (
  <Image src={thumbnailUrl} alt={title} ... />
)}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/clip/ClipCard.test.tsx src/components/layout/RightPanelInspector.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/clip/ClipCard.tsx src/components/clip/ClipCard.test.tsx src/components/layout/RightPanelInspector.tsx src/components/layout/RightPanelInspector.test.tsx
git commit -m "feat: fail closed on protected preview errors"
```

### Task 4: Make the Full Video Player Fail Closed

**Files:**
- Modify: `src/components/clip/VideoPlayer.tsx`
- Modify: `src/components/clip/VideoPlayer.test.tsx`

- [ ] **Step 1: Write the failing full-player error tests**

```ts
it("keeps the protected media URL and disables playback after a load error", () => {
  render(
    <VideoPlayer
      videoUrl="/videos/clip-1.mp4"
      thumbnailUrl="/thumbnails/clip-1.webp"
      duration={12}
    />
  );

  const video = document.querySelector("video") as HTMLVideoElement;
  fireEvent.error(video);

  expect(video.getAttribute("src")).toBe(
    "https://media.reflix.app/videos/clip-1.mp4"
  );
  expect(screen.getByRole("button", { name: /play video/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`

Expected: FAIL because playback controls remain interactive after a media error.

- [ ] **Step 3: Track media load failure and reset on URL changes**

```tsx
const [hasPlaybackError, setHasPlaybackError] = useState(false);

useEffect(() => {
  setHasPlaybackError(false);
}, [resolvedVideoUrl]);

<video
  ...
  onError={() => {
    setHasPlaybackError(true);
    setIsPlaying(false);
  }}
/>
```

- [ ] **Step 4: Disable interactive playback when the protected request fails**

```tsx
const toggleLabel = hasPlaybackError ? "Video unavailable" : isPlaying ? "Pause video" : "Play video";

<button
  type="button"
  disabled={hasPlaybackError}
  aria-label={toggleLabel}
>
  {hasPlaybackError ? "Unavailable" : isPlaying ? "Pause" : "Play"}
</button>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/clip/VideoPlayer.tsx src/components/clip/VideoPlayer.test.tsx
git commit -m "feat: fail closed on protected full video errors"
```

### Task 5: Prune Public MP4 Assets During Protected Production Builds

**Files:**
- Create: `scripts/lib/protected-public-build.mjs`
- Create: `scripts/lib/protected-public-build.test.mjs`
- Create: `scripts/prepare-protected-public-build.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing build-pruning tests**

```js
test("pruneProtectedPublicBuild leaves public videos and previews alone when protection is disabled", async () => {
  const summary = await pruneProtectedPublicBuild({
    projectRoot,
    enabled: false,
  });

  assert.equal(summary.pruned, false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos")), true);
});

test("pruneProtectedPublicBuild removes only public videos and previews when protection is enabled", async () => {
  const summary = await pruneProtectedPublicBuild({
    projectRoot,
    enabled: true,
  });

  assert.equal(summary.pruned, true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "previews")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "thumbnails")), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/protected-public-build.test.mjs`

Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Implement the pure pruning helper**

```js
export async function pruneProtectedPublicBuild({ projectRoot, enabled }) {
  if (!enabled) return { pruned: false, removedDirs: [] };

  const removedDirs = [];
  for (const relativeDir of ["public/videos", "public/previews"]) {
    const absoluteDir = path.join(projectRoot, relativeDir);
    if (!fs.existsSync(absoluteDir)) continue;
    await fs.promises.rm(absoluteDir, { recursive: true, force: true });
    removedDirs.push(relativeDir);
  }

  return { pruned: true, removedDirs };
}
```

- [ ] **Step 4: Wire the helper into the production build entrypoint**

```js
const enabled = process.env.PROTECT_MP4_PUBLIC_ASSETS === "true";
await pruneProtectedPublicBuild({
  projectRoot: path.resolve(SCRIPT_DIR, ".."),
  enabled,
});
```

- [ ] **Step 5: Update the build script**

```json
{
  "scripts": {
    "build": "node scripts/prepare-protected-public-build.mjs && next build"
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test scripts/lib/protected-public-build.test.mjs`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/protected-public-build.mjs scripts/lib/protected-public-build.test.mjs scripts/prepare-protected-public-build.mjs package.json
git commit -m "feat: prune public mp4 assets for protected builds"
```

### Task 6: Add the Cloudflare Media Gateway Worker

**Files:**
- Add: `workers/media-gateway/wrangler.toml`
- Add: `workers/media-gateway/tsconfig.json`
- Add: `workers/media-gateway/src/index.ts`
- Add: `workers/media-gateway/src/index.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Reference: `src/lib/mediaSession.ts`

- [ ] **Step 1: Write the failing worker tests**

```ts
it("rejects protected media requests without a valid cookie", async () => {
  const request = new Request("https://media.reflix.dev/previews/clip-1.mp4");
  const response = await worker.fetch(request, env);

  expect(response.status).toBe(403);
});

it("allows thumbnails without a media session cookie", async () => {
  const request = new Request("https://media.reflix.dev/thumbnails/clip-1.webp");
  const response = await worker.fetch(request, env);

  expect(response.status).toBe(200);
});

it("forwards ranged preview requests to R2", async () => {
  const request = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
    headers: { Range: "bytes=0-1023", Cookie: validCookie },
  });

  const response = await worker.fetch(request, env);

  expect(response.status).toBe(206);
  expect(env.MEDIA_BUCKET.get).toHaveBeenCalled();
});

it("supports HEAD for protected video objects", async () => {
  const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
    method: "HEAD",
    headers: { Cookie: validCookie },
  });

  const response = await worker.fetch(request, env);

  expect(response.status).toBe(200);
  expect(await response.text()).toBe("");
  expect(env.MEDIA_BUCKET.head).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run workers/media-gateway/src/index.test.ts`

Expected: FAIL because the worker project does not exist yet.

- [ ] **Step 3: Add Worker project config and scripts**

```toml
name = "reflix-media-gateway"
main = "src/index.ts"
compatibility_date = "2026-03-24"
workers_dev = false

[[routes]]
pattern = "media.reflix.dev"
custom_domain = true

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "reflix-media"
preview_bucket_name = "reflix-media"
```

```json
{
  "scripts": {
    "worker:media:dev": "wrangler dev --config workers/media-gateway/wrangler.toml",
    "worker:media:deploy": "wrangler deploy --config workers/media-gateway/wrangler.toml"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260320.0",
    "wrangler": "^4.9.0"
  }
}
```

- [ ] **Step 4: Implement the worker request gate**

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    if (url.pathname.startsWith("/thumbnails/")) {
      return serveR2Object(request, env, url.pathname.slice(1), false);
    }

    if (!isProtectedMediaPath(url.pathname)) {
      return new Response("Not Found", { status: 404 });
    }

    const token = readCookie(request.headers.get("Cookie"), MEDIA_SESSION_COOKIE_NAME);
    const session = token
      ? await verifyMediaSessionToken(token, env.MEDIA_SESSION_SECRET, Date.now())
      : null;

    if (!session) {
      return new Response("Forbidden", { status: 403 });
    }

    return serveR2Object(request, env, url.pathname.slice(1), true);
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 5: Preserve HTTP metadata and ranged playback**

```ts
async function serveR2Object(
  request: Request,
  env: Env,
  key: string,
  protectedPath: boolean
) {
  const object =
    request.method === "HEAD"
      ? await env.MEDIA_BUCKET.head(key)
      : await env.MEDIA_BUCKET.get(key, { range: request.headers });

  if (!object) return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");

  if (protectedPath) {
    headers.set("cache-control", "private, no-store");
  }

  return new Response(request.method === "HEAD" ? null : object.body, {
    status: object.range ? 206 : 200,
    headers,
  });
}
```

- [ ] **Step 6: Isolate worker typing from the Next app build**

```json
// tsconfig.json
{
  "exclude": ["node_modules", "workers"]
}
```

```json
// workers/media-gateway/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run workers/media-gateway/src/index.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add workers/media-gateway/wrangler.toml workers/media-gateway/tsconfig.json workers/media-gateway/src/index.ts workers/media-gateway/src/index.test.ts package.json tsconfig.json
git commit -m "feat: add cookie-gated media worker"
```

### Task 7: Update Environment Docs and Verify the Whole Flow

**Files:**
- Modify: `.env.local.example`
- Modify: `README.md`
- Modify: `docs/media-strategy.md`

- [ ] **Step 1: Document the new protection env vars**

```dotenv
MEDIA_SESSION_SECRET=
MEDIA_SESSION_COOKIE_DOMAIN=.reflix.dev
MEDIA_SESSION_TTL_SECONDS=21600
PROTECT_MP4_PUBLIC_ASSETS=
```

- [ ] **Step 2: Update README production deploy guidance**

```md
- Production should set `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.dev`
- Production should set `PROTECT_MP4_PUBLIC_ASSETS=true`
- Production app deploys must prune `public/videos` and `public/previews`
- Deploy the Cloudflare Worker on `media.reflix.dev` before turning on the protected build
```

- [ ] **Step 3: Update the media strategy doc**

```md
- `preview mp4` remains the browse performance format
- production delivery of `videos/*` and `previews/*` is now Worker-gated from private R2
- `thumbnails/*` remain public
```

- [ ] **Step 4: Run automated verification**

Run:
- `npx vitest run src/lib/mediaSession.test.ts src/proxy.test.ts src/components/clip/ClipCard.test.tsx src/components/layout/RightPanelInspector.test.tsx src/components/clip/VideoPlayer.test.tsx workers/media-gateway/src/index.test.ts`
- `node --test scripts/lib/protected-public-build.test.mjs`

Expected: PASS

- [ ] **Step 5: Run a protected production build in a disposable worktree**

Run:

```bash
PROTECT_MP4_PUBLIC_ASSETS=true \
NEXT_PUBLIC_MEDIA_URL=https://media.reflix.dev \
MEDIA_SESSION_SECRET=test-secret \
MEDIA_SESSION_COOKIE_DOMAIN=.reflix.dev \
npm run build
```

Expected: PASS in the disposable worktree, with `public/videos` and `public/previews` absent by the time `next build` runs.

- [ ] **Step 6: Perform manual verification**

Run:

```bash
curl -I https://media.reflix.dev/previews/L3TR52T22TPVR.mp4
curl -I https://media.reflix.dev/videos/L3TR52T22TPVR.mp4
```

Expected: `403` without a valid cookie.

Browser checks:
- browse motion preview still animates during a normal page session
- inspector preview still animates during a normal page session
- quick view and detail playback still work
- seeking and replay still work
- pasted media URL in a fresh incognito window is blocked

- [ ] **Step 7: Commit**

```bash
git add .env.local.example README.md docs/media-strategy.md
git commit -m "docs: document protected mp4 delivery rollout"
```

## Final Verification Command Set

Run:

```bash
npx vitest run \
  src/lib/mediaSession.test.ts \
  src/proxy.test.ts \
  src/components/clip/ClipCard.test.tsx \
  src/components/layout/RightPanelInspector.test.tsx \
  src/components/clip/VideoPlayer.test.tsx \
  workers/media-gateway/src/index.test.ts

node --test scripts/lib/protected-public-build.test.mjs
```

Expected: PASS
