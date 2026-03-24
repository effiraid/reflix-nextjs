import { describe, expect, it, vi } from "vitest";
import { MEDIA_SESSION_COOKIE_NAME, signMediaSessionToken } from "@/lib/mediaSession";
import worker from "./index";

function createBucketObject({
  body = "media-body",
  contentType = "video/mp4",
  etag = '"etag-123"',
  range = undefined,
}: {
  body?: string;
  contentType?: string;
  etag?: string;
  range?: { offset: number; length: number } | undefined;
}) {
  return {
    body,
    range,
    httpEtag: etag,
    writeHttpMetadata(headers: Headers) {
      headers.set("content-type", contentType);
    },
  };
}

async function createValidCookie() {
  const token = await signMediaSessionToken(
    {
      v: 1,
      host: "reflix.dev",
      exp: Date.now() + 60_000,
    },
    "test-secret"
  );

  return `${MEDIA_SESSION_COOKIE_NAME}=${token}`;
}

describe("media gateway worker", () => {
  it("rejects protected media requests without a valid cookie", async () => {
    const env = {
      MEDIA_SESSION_SECRET: "test-secret",
      MEDIA_BUCKET: {
        get: vi.fn(),
        head: vi.fn(),
      },
    };

    const request = new Request("https://media.reflix.dev/previews/clip-1.mp4");
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(403);
  });

  it("allows thumbnails without a media session cookie", async () => {
    const env = {
      MEDIA_SESSION_SECRET: "test-secret",
      MEDIA_BUCKET: {
        get: vi.fn(async () =>
          createBucketObject({
            body: "thumb-body",
            contentType: "image/webp",
          })
        ),
        head: vi.fn(),
      },
    };

    const request = new Request("https://media.reflix.dev/thumbnails/clip-1.webp");
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("thumb-body");
    expect(env.MEDIA_BUCKET.get).toHaveBeenCalledWith("thumbnails/clip-1.webp", {
      range: request.headers,
    });
  });

  it("forwards ranged preview requests to R2", async () => {
    const validCookie = await createValidCookie();
    const env = {
      MEDIA_SESSION_SECRET: "test-secret",
      MEDIA_BUCKET: {
        get: vi.fn(async () =>
          createBucketObject({
            range: { offset: 0, length: 1024 },
          })
        ),
        head: vi.fn(),
      },
    };

    const request = new Request("https://media.reflix.dev/previews/clip-1.mp4", {
      headers: {
        Range: "bytes=0-1023",
        Cookie: validCookie,
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(env.MEDIA_BUCKET.get).toHaveBeenCalledWith("previews/clip-1.mp4", {
      range: request.headers,
    });
  });

  it("supports HEAD for protected video objects", async () => {
    const validCookie = await createValidCookie();
    const env = {
      MEDIA_SESSION_SECRET: "test-secret",
      MEDIA_BUCKET: {
        get: vi.fn(),
        head: vi.fn(async () => createBucketObject({})),
      },
    };

    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      method: "HEAD",
      headers: {
        Cookie: validCookie,
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(env.MEDIA_BUCKET.head).toHaveBeenCalledWith("videos/clip-1.mp4");
  });
});
