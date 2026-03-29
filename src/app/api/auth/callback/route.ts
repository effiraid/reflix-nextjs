import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sanitizePostAuthRedirect } from "@/lib/authRedirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizePostAuthRedirect(
    searchParams.get("next"),
    "/ko/browse"
  );

  if (code) {
    const cookieStore = await cookies();
    const responseCookies: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
              responseCookies.push({ name, value, options });
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    } else {
      console.log("[auth/callback] session exchanged, redirecting to", next);
      const response = NextResponse.redirect(new URL(next, origin));
      for (const { name, value, options } of responseCookies) {
        response.cookies.set(name, value, options);
      }
      return response;
    }
  } else {
    console.warn("[auth/callback] no code param in URL");
  }

  return NextResponse.redirect(new URL("/ko/login?error=auth", origin));
}
