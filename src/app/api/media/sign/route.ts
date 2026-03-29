import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { signMediaUrl, getMediaSessionConfig } from "@/lib/mediaSession";
import { getValidatedRequestOrigin } from "@/lib/requestOrigin";

function extractClipIdFromVideoPath(path: string): string | null {
  const match = path.match(/^\/videos\/([^/?#]+)\.mp4$/i);
  return match?.[1] ?? null;
}

function extractClipIdFromDetailReferer(
  referer: string | null,
  siteOrigin: string
): string | null {
  if (!referer) {
    return null;
  }

  try {
    const url = new URL(referer);
    if (url.origin !== siteOrigin) {
      return null;
    }

    const match = url.pathname.match(/^\/[a-z]{2}\/clip\/([^/?#]+)$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const originCheck = getValidatedRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      { error: originCheck.error },
      { status: originCheck.status }
    );
  }

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

  const body = await request.json();
  const path = typeof body?.path === "string" ? body.path : "";

  if (!path.startsWith("/videos/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const requestedClipId = extractClipIdFromVideoPath(path);
  const detailRefererClipId = extractClipIdFromDetailReferer(
    request.headers.get("referer"),
    originCheck.siteOrigin
  );
  const canGuestSignDetailVideo =
    !user &&
    requestedClipId !== null &&
    requestedClipId === detailRefererClipId;

  if (!user && !canGuestSignDetailVideo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getMediaSessionConfig(process.env);
  if (!config.secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { tok, sig } = await signMediaUrl(path, config.secret);
  const url = `${config.mediaBase}${path}?tok=${encodeURIComponent(tok)}&sig=${encodeURIComponent(sig)}`;

  return NextResponse.json({ url });
}
