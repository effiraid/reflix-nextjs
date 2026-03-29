import { getTrustedSiteOrigin } from "@/lib/siteOrigin";

type OriginValidationSuccess = {
  ok: true;
  siteOrigin: string;
  requestOrigin: string;
};

type OriginValidationFailure = {
  ok: false;
  error: "invalid_origin" | "origin_not_configured";
  status: 403 | 500;
};

export type OriginValidationResult =
  | OriginValidationSuccess
  | OriginValidationFailure;

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(request: Request): string | null {
  return (
    normalizeOrigin(request.headers.get("origin")) ??
    normalizeOrigin(request.headers.get("referer"))
  );
}

export function getValidatedRequestOrigin(
  request: Request
): OriginValidationResult {
  const runtimeOrigin = normalizeOrigin(new URL(request.url).origin);
  const siteOrigin = getTrustedSiteOrigin(runtimeOrigin);

  if (!siteOrigin) {
    return {
      ok: false,
      error: "origin_not_configured",
      status: 500,
    };
  }

  const requestOrigin = getRequestOrigin(request);
  if (!requestOrigin || requestOrigin !== siteOrigin) {
    return {
      ok: false,
      error: "invalid_origin",
      status: 403,
    };
  }

  return {
    ok: true,
    siteOrigin,
    requestOrigin,
  };
}
