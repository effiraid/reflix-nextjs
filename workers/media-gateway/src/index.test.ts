import { describe, expect, it, vi } from "vitest";
import { MEDIA_SESSION_COOKIE_NAME, signMediaSessionToken } from "@/lib/mediaSession";
import worker from "./index";

function createBucketObject({
  body = "media-body",
  contentType = "video/mp4",
  etag = '"etag-123"',
  size = 4096,
  range = undefined,
}: {
  body?: string;
  contentType?: string;
  etag?: string;
  size?: number;
  range?: { offset: number; length: number } | undefined;
}) {
  return {
    body,
    range,
    size,
    httpEtag: etag,
    writeHttpMetadata(headers: Headers) {
      headers.set("content-type", contentType);
    },
  };
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    MEDIA_SESSION_SECRET: "test-secret",
    ALLOWED_ORIGINS: "",
    MEDIA_BUCKET: {
      get: vi.fn(),
      head: vi.fn(),
    },
    ...overrides,
  };
}

async function createValidCookie(
  tier: "free" | "pro" = "pro",
  userId = "user-123"
) {
  const token = await signMediaSessionToken(
    {
      v: 2,
      host: "reflix.dev",
      exp: Date.now() + 60_000,
      userId,
      tier,
    },
    "test-secret"
  );

  return `${MEDIA_SESSION_COOKIE_NAME}=${token}`;
}

describe("media gateway worker", () => {
  it("rejects protected media requests without a valid cookie", async () => {
    const env = createEnv();

    const request = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
      headers: { Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(403);
  });

  it("allows thumbnails without a media session cookie", async () => {
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () =>
          createBucketObject({
            body: "thumb-body",
            contentType: "image/webp",
          })
        ),
        head: vi.fn(),
      },
    });

    const request = new Request("https://media.reflix.dev/thumbnails/clip-1.webp");
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("thumb-body");
    expect(env.MEDIA_BUCKET.get).toHaveBeenCalledWith("thumbnails/clip-1.webp", undefined);
  });

  it("forwards ranged preview requests to R2", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () =>
          createBucketObject({
            range: { offset: 0, length: 1024 },
          })
        ),
        head: vi.fn(),
      },
    });

    const request = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
      headers: {
        Range: "bytes=0-1023",
        Cookie: validCookie,
        Origin: "https://reflix.dev",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-range")).toBe("bytes 0-1023/4096");
    expect(env.MEDIA_BUCKET.get).toHaveBeenCalledWith("previews/clip-1.mp4", {
      range: request.headers,
    });
  });

  it("normalizes ranged preview metadata when R2 includes an undefined suffix field", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () =>
          createBucketObject({
            size: 4096,
            range: { suffix: undefined, length: 1024 } as unknown as {
              offset: number;
              length: number;
            },
          })
        ),
        head: vi.fn(),
      },
    });

    const request = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
      headers: {
        Range: "bytes=0-1023",
        Cookie: validCookie,
        Origin: "https://reflix.dev",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-1023/4096");
  });

  it("supports HEAD for protected video objects", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(),
        head: vi.fn(async () => createBucketObject({})),
      },
    });

    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      method: "HEAD",
      headers: {
        Cookie: validCookie,
        Origin: "https://reflix.dev",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(env.MEDIA_BUCKET.head).toHaveBeenCalledWith("videos/clip-1.mp4");
  });
});

describe("CORS", () => {
  it("responds to OPTIONS preflight with CORS headers", async () => {
    const env = createEnv();
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      method: "OPTIONS",
      headers: { Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://reflix.dev");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("includes CORS headers on GET responses", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://reflix.dev");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("rejects OPTIONS from disallowed origin", async () => {
    const env = createEnv();
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.com" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });
});

describe("Referer/Origin validation", () => {
  it("allows requests with valid Origin header", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });

  it("allows requests with valid Referer header", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Referer: "https://reflix.dev/ko/clip/abc" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });

  it("rejects protected media with neither Origin nor Referer", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("rejects requests with disallowed Origin", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://evil.com" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("rejects subdomain spoofing like evil-reflix.dev", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://evil-reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("allows origins from ALLOWED_ORIGINS env var", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      ALLOWED_ORIGINS: "https://preview.vercel.app,https://staging.reflix.dev",
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://preview.vercel.app" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });
});

describe("S-001: wildcard subdomain blocking", () => {
  it("rejects arbitrary *.reflix.dev subdomains", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://attacker.reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("rejects nested subdomains like a.b.c.reflix.dev", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://a.b.c.reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("allows www.reflix.dev", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://www.reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });
});

describe("S-002: Origin/Referer required for protected media", () => {
  it("rejects /videos/ with cookie but no Origin or Referer", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("rejects /previews/ with cookie but no Origin or Referer", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
      headers: { Cookie: validCookie },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("allows /thumbnails/ without Origin or Referer (public)", async () => {
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () =>
          createBucketObject({ body: "thumb", contentType: "image/webp" })
        ),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/thumbnails/clip-1.webp");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });
});

describe("S-003: localhost access control via ALLOWED_ORIGINS", () => {
  it("rejects localhost when ALLOWED_ORIGINS is empty", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      ALLOWED_ORIGINS: "",
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "http://localhost:3000" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
  });

  it("allows localhost when ALLOWED_ORIGINS includes it", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "http://localhost:3000" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });
});

describe("Anti-embedding headers", () => {
  it("includes X-Frame-Options and CSP on protected media responses", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie, Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "frame-ancestors 'self' https://reflix.dev"
    );
  });

  it("does not include anti-embedding headers on thumbnail responses", async () => {
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () =>
          createBucketObject({ body: "thumb", contentType: "image/webp" })
        ),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/thumbnails/clip-1.webp");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Frame-Options")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });
});

describe("Tier-based access control", () => {
  it("rejects /videos/ for guest users", async () => {
    const guestCookie = await createValidCookie("free", "");
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: guestCookie, Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "sign_in_required", message: expect.any(String) });
  });

  it("allows /videos/ for authenticated free tier users", async () => {
    const freeCookie = await createValidCookie("free");
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: freeCookie, Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });

  it("allows /videos/ for pro tier users", async () => {
    const proCookie = await createValidCookie("pro");
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: proCookie, Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });

  it("allows /previews/ for free tier users", async () => {
    const freeCookie = await createValidCookie("free");
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });
    const request = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
      headers: { Cookie: freeCookie, Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });

  it("treats v1 tokens as free tier (backwards compat)", async () => {
    const v1Token = await signMediaSessionToken(
      { v: 1, host: "reflix.dev", exp: Date.now() + 60_000 },
      "test-secret"
    );
    const v1Cookie = `${MEDIA_SESSION_COOKIE_NAME}=${v1Token}`;
    const env = createEnv({
      MEDIA_BUCKET: { get: vi.fn(async () => createBucketObject({})), head: vi.fn() },
    });

    // v1 → free → videos blocked
    const videoReq = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: v1Cookie, Origin: "https://reflix.dev" },
    });
    const videoRes = await worker.fetch(videoReq, env);
    expect(videoRes.status).toBe(403);

    // v1 → free → previews allowed
    const previewReq = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
      headers: { Cookie: v1Cookie, Origin: "https://reflix.dev" },
    });
    const previewRes = await worker.fetch(previewReq, env);
    expect(previewRes.status).toBe(200);
  });
});
