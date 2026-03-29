import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getValidatedRequestOrigin } from "@/lib/requestOrigin";

export async function GET(request: NextRequest) {
  const clipId = request.nextUrl.searchParams.get("clipId");
  if (!clipId) {
    return NextResponse.json({ error: "clipId required" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_clip_ratings")
    .select("rating, memo")
    .eq("user_id", user.id)
    .eq("clip_id", clipId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? { rating: null, memo: null });
}

export async function PUT(request: NextRequest) {
  const originCheck = getValidatedRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      { error: originCheck.error },
      { status: originCheck.status }
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { clipId, rating, memo } = body as {
    clipId: string;
    rating: number | null;
    memo: string | null;
  };

  if (!clipId) {
    return NextResponse.json({ error: "clipId required" }, { status: 400 });
  }

  if (rating !== null && (rating < 1 || rating > 5)) {
    return NextResponse.json(
      { error: "rating must be 1-5 or null" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("user_clip_ratings")
    .upsert(
      {
        user_id: user.id,
        clip_id: clipId,
        rating,
        memo: memo ?? null,
      },
      { onConflict: "user_id,clip_id" }
    )
    .select("rating, memo")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const originCheck = getValidatedRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      { error: originCheck.error },
      { status: originCheck.status }
    );
  }

  const clipId = request.nextUrl.searchParams.get("clipId");
  if (!clipId) {
    return NextResponse.json({ error: "clipId required" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("user_clip_ratings")
    .delete()
    .eq("user_id", user.id)
    .eq("clip_id", clipId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
