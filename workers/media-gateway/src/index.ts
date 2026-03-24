import {
  isProtectedMediaPath,
  MEDIA_SESSION_COOKIE_NAME,
  verifyMediaSessionToken,
} from "../../../src/lib/mediaSession";

type R2LikeObject = {
  body?: BodyInit | null;
  range?: unknown;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

type R2LikeBucket = {
  get(
    key: string,
    options?: {
      range?: Headers;
    }
  ): Promise<R2LikeObject | null> | R2LikeObject | null;
  head(key: string): Promise<R2LikeObject | null> | R2LikeObject | null;
};

type Env = {
  MEDIA_SESSION_SECRET: string;
  MEDIA_BUCKET: R2LikeBucket;
};

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name || rawValue.length === 0) {
      continue;
    }

    return rawValue.join("=");
  }

  return null;
}

async function serveR2Object(
  request: Request,
  env: Env,
  key: string,
  protectedPath: boolean
): Promise<Response> {
  const object =
    request.method === "HEAD"
      ? await env.MEDIA_BUCKET.head(key)
      : await env.MEDIA_BUCKET.get(key, { range: request.headers });

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");

  if (protectedPath) {
    headers.set("cache-control", "private, no-store");
  }

  return new Response(request.method === "HEAD" ? null : object.body ?? null, {
    status: object.range ? 206 : 200,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    if (url.pathname.startsWith("/thumbnails/")) {
      return serveR2Object(request, env, url.pathname.replace(/^\/+/, ""), false);
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

    return serveR2Object(request, env, url.pathname.replace(/^\/+/, ""), true);
  },
};

export default worker;
