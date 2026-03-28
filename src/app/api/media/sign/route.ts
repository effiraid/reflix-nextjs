import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { signMediaUrl, getMediaSessionConfig } from "@/lib/mediaSession";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const path = typeof body?.path === "string" ? body.path : "";

  if (!path.startsWith("/videos/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const config = getMediaSessionConfig(process.env);
  if (!config.secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { tok, sig } = await signMediaUrl(path, config.secret);
  const url = `${config.mediaBase}${path}?tok=${encodeURIComponent(tok)}&sig=${encodeURIComponent(sig)}`;

  return NextResponse.json({ url });
}
