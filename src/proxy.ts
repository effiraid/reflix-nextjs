import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import {
  getMediaSessionConfig,
  MEDIA_SESSION_COOKIE_NAME,
  signMediaSessionToken,
} from "@/lib/mediaSession";

async function getSessionTier(request: NextRequest): Promise<{
  userId?: string;
  tier: "free" | "pro";
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { tier: "free" };
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { tier: "free" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    return {
      userId: user.id,
      tier: profile?.tier === "pro" ? "pro" : "free",
    };
  } catch {
    return { tier: "free" };
  }
}

async function withMediaSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const config = getMediaSessionConfig(process.env);
  if (!config.enabled) {
    return response;
  }

  const { userId, tier } = await getSessionTier(request);

  const now = Date.now();
  const token = await signMediaSessionToken(
    {
      v: 2,
      host: request.nextUrl.hostname,
      exp: now + config.ttlSeconds * 1000,
      userId,
      tier,
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
    // Redirect removed /pricing route to /browse
    const pricingMatch = pathname.match(/^\/([a-z]{2})\/pricing\b/);
    if (pricingMatch) {
      const pricingLang = pricingMatch[1];
      return NextResponse.redirect(new URL(`/${pricingLang}/browse`, request.url), 301);
    }

    if (pathname.match(/^\/[a-z]{2}\/account(?:\/|$)/)) {
      const { userId } = await getSessionTier(request);
      if (!userId) {
        const lang = pathname.split("/")[1] || "ko";
        return NextResponse.redirect(new URL(`/${lang}/login`, request.url));
      }
    }

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
