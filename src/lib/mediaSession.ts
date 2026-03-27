export const MEDIA_SESSION_COOKIE_NAME = "reflix-media-session";

const DEFAULT_TTL_SECONDS = 21_600;
const PROTECTED_PREFIXES = ["/videos/", "/previews/"] as const;

type MediaSessionPayloadV1 = {
  v: 1;
  host: string;
  exp: number;
};

type MediaSessionPayloadV2 = {
  v: 2;
  host: string;
  exp: number;
  userId?: string;
  tier: "free" | "pro";
};

export type MediaSessionPayload = MediaSessionPayloadV1 | MediaSessionPayloadV2;

type MediaSessionEnv = Record<string, string | undefined>;

type MediaSessionConfig = {
  enabled: boolean;
  mediaBase: string;
  secret: string;
  domain: string;
  ttlSeconds: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const nodeBuffer = (globalThis as {
  Buffer?: {
    from(
      value: Uint8Array | string,
      encoding?: string
    ): ArrayLike<number> & {
      toString(encoding: string): string;
    };
  };
}).Buffer;

function encodeBase64Url(bytes: Uint8Array): string {
  if (nodeBuffer) {
    return nodeBuffer
      .from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${"=".repeat(paddingLength)}`;

  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(padded, "base64"));
  }

  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signBody(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return encodeBase64Url(new Uint8Array(signature));
}

export function isProtectedMediaPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function signMediaSessionToken(
  payload: MediaSessionPayload,
  secret: string
): Promise<string> {
  const body = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signBody(body, secret);

  return `${body}.${signature}`;
}

export async function verifyMediaSessionToken(
  token: string,
  secret: string,
  now: number
): Promise<MediaSessionPayload | null> {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) {
    return null;
  }

  try {
    const expectedSignature = await signBody(body, secret);
    if (expectedSignature !== signature) {
      return null;
    }

    const raw = JSON.parse(decoder.decode(decodeBase64Url(body)));
    if (
      typeof raw.v !== "number" ||
      typeof raw.host !== "string" ||
      typeof raw.exp !== "number"
    ) {
      return null;
    }

    if (raw.exp <= now) return null;

    // Normalize v1 → v2 compatible shape
    if (raw.v === 1) {
      return { v: 1, host: raw.host, exp: raw.exp } as MediaSessionPayload;
    }

    return raw as MediaSessionPayload;
  } catch {
    return null;
  }
}

/** Extract tier from a verified payload. V1 tokens default to "free". */
export function getPayloadTier(payload: MediaSessionPayload): "free" | "pro" {
  return payload.v === 2 ? payload.tier : "free";
}

export function getMediaSessionConfig(env: MediaSessionEnv): MediaSessionConfig {
  const mediaBase = (env.NEXT_PUBLIC_MEDIA_URL ?? "").trim();
  const secret = (env.MEDIA_SESSION_SECRET ?? "").trim();
  const domain = (env.MEDIA_SESSION_COOKIE_DOMAIN ?? "").trim();
  const ttlSeconds = Number.parseInt(env.MEDIA_SESSION_TTL_SECONDS ?? `${DEFAULT_TTL_SECONDS}`, 10);

  return {
    enabled: Boolean(mediaBase && secret && domain),
    mediaBase,
    secret,
    domain,
    ttlSeconds: Number.isNaN(ttlSeconds) ? DEFAULT_TTL_SECONDS : ttlSeconds,
  };
}
