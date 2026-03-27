const INTERNAL_REDIRECT_ORIGIN = "https://reflix.dev";
const ALLOWED_NEXT_PATH = /^\/(?:ko|en)(?:\/|$)/;

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(value, INTERNAL_REDIRECT_ORIGIN);
    if (url.origin !== INTERNAL_REDIRECT_ORIGIN) {
      return null;
    }

    const normalizedPath = `${url.pathname}${url.search}${url.hash}`;
    return ALLOWED_NEXT_PATH.test(url.pathname) ? normalizedPath : null;
  } catch {
    return null;
  }
}

export function buildAuthCallbackUrl(
  lang: string,
  currentOrigin?: string,
  next?: string
): string | null {
  const origin =
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeOrigin(currentOrigin);

  if (!origin) return null;

  const url = new URL(`/${lang}/auth/callback`, `${origin}/`);

  if (next !== undefined) {
    url.searchParams.set(
      "next",
      sanitizePostAuthRedirect(next, `/${lang}/browse`)
    );
  }

  return url.toString();
}

export function sanitizePostAuthRedirect(
  value: string | null | undefined,
  fallback: string
): string {
  return (
    normalizeInternalPath(value) ?? normalizeInternalPath(fallback) ?? "/ko/browse"
  );
}
