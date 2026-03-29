import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { loadEffectiveAccess } from "@/lib/supabase/access";
import {
  getMediaSessionConfig,
  MEDIA_SESSION_COOKIE_NAME,
  signMediaSessionToken,
} from "@/lib/mediaSession";

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

  // --- Auth session: create one Supabase client, propagate cookie updates ---
  // Tracking cookie updates and writing them to every response prevents stale
  // refresh-token cookies from reaching the browser client, which would cause
  // an uncatchable AuthApiError("Invalid Refresh Token") in the SDK internals.
  const authCookieUpdates: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [];

  let sessionAccess: {
    userId?: string;
    effectiveTier: "free" | "pro";
    accessSource: "free" | "paid" | "beta";
  } = { effectiveTier: "free", accessSource: "free" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            authCookieUpdates.length = 0;
            authCookieUpdates.push(...cookies);
            for (const { name, value } of cookies) {
              request.cookies.set(name, value);
            }
          },
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const access = await loadEffectiveAccess(supabase as never, user.id);
        sessionAccess = {
          userId: user.id,
          effectiveTier: access.effectiveTier,
          accessSource: access.accessSource,
        };
      }
    } catch {
      // Auth unavailable — continue as guest
    }
  }

  // Apply tracked auth cookie updates to any response
  function finalizeResponse(response: NextResponse): NextResponse {
    for (const { name, value, options } of authCookieUpdates) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.cookies.set(name, value, options as any);
    }
    return response;
  }

  async function addMediaSession(
    response: NextResponse
  ): Promise<NextResponse> {
    const config = getMediaSessionConfig(process.env);
    if (!config.enabled) return response;

    const now = Date.now();
    const token = await signMediaSessionToken(
      {
        v: 2,
        host: request.nextUrl.hostname,
        exp: now + config.ttlSeconds * 1000,
        userId: sessionAccess.userId,
        tier: sessionAccess.effectiveTier,
        accessSource: sessionAccess.accessSource,
      },
      config.secret
    );

    response.cookies.set({
      name: MEDIA_SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "none",
      // Keep the cookie domain explicit in env config (for example `.reflix.dev`).
      // Origin allowlisting is handled downstream, so avoid wildcard host logic
      // or localhost-only production exceptions in this proxy layer.
      domain: config.domain,
      path: "/",
      maxAge: config.ttlSeconds,
    });

    return response;
  }

  // --- Routing ---
  const pathnameHasLocale = LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    // Redirect removed /pricing route to /browse
    const pricingMatch = pathname.match(/^\/([a-z]{2})\/pricing\b/);
    if (pricingMatch) {
      const pricingLang = pricingMatch[1];
      return finalizeResponse(
        NextResponse.redirect(
          new URL(`/${pricingLang}/browse`, request.url),
          301
        )
      );
    }

    if (pathname.match(/^\/[a-z]{2}\/account(?:\/|$)/)) {
      if (!sessionAccess.userId) {
        const lang = pathname.split("/")[1] || "ko";
        return finalizeResponse(
          NextResponse.redirect(new URL(`/${lang}/login`, request.url))
        );
      }
    }

    return finalizeResponse(await addMediaSession(NextResponse.next()));
  }

  // Detect preferred locale from Accept-Language header
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const preferred = acceptLanguage.includes("ko") ? "ko" : DEFAULT_LOCALE;

  // Redirect to locale-prefixed path
  return finalizeResponse(
    await addMediaSession(
      NextResponse.redirect(
        new URL(
          `/${preferred}${pathname === "/" ? "" : pathname}`,
          request.url
        )
      )
    )
  );
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|data|.*\\..*).*)", "/"],
};
