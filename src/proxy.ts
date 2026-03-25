import { NextRequest, NextResponse } from "next/server";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import {
  getMediaSessionConfig,
  MEDIA_SESSION_COOKIE_NAME,
  signMediaSessionToken,
} from "@/lib/mediaSession";

async function withMediaSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const config = getMediaSessionConfig(process.env);
  if (!config.enabled) {
    return response;
  }

  const now = Date.now();
  const token = await signMediaSessionToken(
    {
      v: 1,
      host: request.nextUrl.hostname,
      exp: now + config.ttlSeconds * 1000,
    },
    config.secret
  );

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

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal paths and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/data/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check if locale is already in path
  const pathnameHasLocale = LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return withMediaSession(request, NextResponse.next());
  }

  // Detect preferred locale from Accept-Language header
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const preferred = acceptLanguage.includes("ko") ? "ko" : DEFAULT_LOCALE;

  // Redirect to locale-prefixed path
  return withMediaSession(
    request,
    NextResponse.redirect(
      new URL(
        `/${preferred}${pathname === "/" ? "" : pathname}`,
        request.url
      )
    )
  );
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|data|.*\\..*).*)", "/"],
};
