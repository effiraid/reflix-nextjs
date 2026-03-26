import {
  isProtectedMediaPath,
  MEDIA_SESSION_COOKIE_NAME,
  verifyMediaSessionToken,
} from "../../../src/lib/mediaSession";

type R2LikeObject = {
  body?: BodyInit | null;
  range?: R2LikeRange;
  httpEtag: string;
  size: number;
  writeHttpMetadata(headers: Headers): void;
};

type R2LikeRange =
  | {
      offset: number;
      length?: number;
    }
  | {
      offset?: number;
      length: number;
    }
  | {
      suffix: number;
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
  ALLOWED_ORIGINS: string;
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

const ALLOWED_HOSTNAMES = new Set(["reflix.dev", "www.reflix.dev"]);

function isAllowedOrigin(hostname: string, extraOrigins: string[]): boolean {
  if (ALLOWED_HOSTNAMES.has(hostname)) {
    return true;
  }
  return extraOrigins.includes(hostname);
}

function getOriginHostname(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {
      return null;
    }
  }

  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      return null;
    }
  }

  return null;
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Range");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function getRangedResponseMetadata(
  range: R2LikeRange | undefined,
  size: number
): { start: number; end: number; length: number } | null {
  if (!range || size <= 0) {
    return null;
  }

  if ("suffix" in range && typeof range.suffix === "number") {
    const length = Math.min(range.suffix, size);
    const start = Math.max(size - length, 0);
    return {
      start,
      end: size - 1,
      length,
    };
  }

  const rawStart = "offset" in range && typeof range.offset === "number" ? range.offset : 0;
  const start = Math.max(rawStart, 0);
  const available = Math.max(size - start, 0);
  const requestedLength =
    "length" in range && typeof range.length === "number" ? range.length : available;
  const length = Math.min(requestedLength, available);

  return {
    start,
    end: start + Math.max(length - 1, 0),
    length,
  };
}

async function serveR2Object(
  request: Request,
  env: Env,
  key: string,
  protectedPath: boolean
): Promise<Response> {
  const hasRange = request.headers.has("Range");
  const object =
    request.method === "HEAD"
      ? await env.MEDIA_BUCKET.head(key)
      : await env.MEDIA_BUCKET.get(key, hasRange ? { range: request.headers } : undefined);

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");

  if (protectedPath) {
    headers.set("cache-control", "private, no-store");
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Content-Security-Policy", "frame-ancestors 'self' https://reflix.dev");
  }

  const partial = hasRange ? getRangedResponseMetadata(object.range, object.size) : null;
  if (partial) {
    headers.set("content-range", `bytes ${partial.start}-${partial.end}/${object.size}`);
    headers.set("content-length", String(partial.length));
  }

  return new Response(request.method === "HEAD" ? null : object.body ?? null, {
    status: partial ? 206 : 200,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Parse extra allowed origins from env
    const extraOrigins = env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(",")
          .map((o) => {
            try {
              return new URL(o.trim()).hostname;
            } catch {
              return o.trim();
            }
          })
          .filter(Boolean)
      : [];

    // Origin/Referer validation
    const hostname = getOriginHostname(request);
    if (hostname !== null && !isAllowedOrigin(hostname, extraOrigins)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Handle OPTIONS preflight (Origin required — browsers always send it)
    if (request.method === "OPTIONS") {
      if (hostname === null) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" },
      });
    }

    // Thumbnails are public — no CORS headers needed
    if (url.pathname.startsWith("/thumbnails/")) {
      return serveR2Object(request, env, url.pathname.replace(/^\/+/, ""), false);
    }

    if (!isProtectedMediaPath(url.pathname)) {
      return new Response("Not Found", { status: 404 });
    }

    // Protected media requires Origin or Referer header.
    // Browsers always send one for sub-resource loads (<video src>, fetch()).
    // Missing both = direct URL access, curl, or suppressed Referer → block.
    if (hostname === null) {
      return new Response("Forbidden", { status: 403 });
    }

    const token = readCookie(request.headers.get("Cookie"), MEDIA_SESSION_COOKIE_NAME);
    const session = token
      ? await verifyMediaSessionToken(token, env.MEDIA_SESSION_SECRET, Date.now())
      : null;

    if (!session) {
      return new Response("Forbidden", { status: 403 });
    }

    const response = await serveR2Object(request, env, url.pathname.replace(/^\/+/, ""), true);

    // Add CORS headers to protected media responses
    const cors = corsHeaders(request);
    for (const [key, value] of cors.entries()) {
      response.headers.set(key, value);
    }

    return response;
  },
};

export default worker;
