import { NextRequest, NextResponse } from "next/server";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal paths and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/data/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check if locale is already in path
  const pathnameHasLocale = LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Detect preferred locale from Accept-Language header
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const preferred = acceptLanguage.includes("ko") ? "ko" : DEFAULT_LOCALE;

  // Redirect to locale-prefixed path
  return NextResponse.redirect(
    new URL(
      `/${preferred}${pathname === "/" ? "" : pathname}`,
      request.url
    )
  );
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|data|.*\\..*).*)", "/"],
};
