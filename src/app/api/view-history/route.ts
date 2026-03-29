import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getValidatedRequestOrigin } from "@/lib/requestOrigin";

const MAX_VIEW_HISTORY_ITEMS = 50;

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_view_history")
    .select("clip_id, viewed_at")
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .limit(MAX_VIEW_HISTORY_ITEMS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: (data ?? []).map((row) => ({
      clipId: row.clip_id,
      viewedAt: row.viewed_at,
    })),
  });
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

  const body = (await request.json()) as {
    clipId?: string;
    clipIds?: string[];
  };
  const clipIds = (
    Array.isArray(body.clipIds) ? body.clipIds : body.clipId ? [body.clipId] : []
  )
    .map((clipId) => clipId.trim())
    .filter(Boolean)
    .slice(0, MAX_VIEW_HISTORY_ITEMS);

  if (clipIds.length === 0) {
    return NextResponse.json({ error: "clipIds required" }, { status: 400 });
  }

  const baseTime = Date.now() - clipIds.length;
  const rows = clipIds.map((clipId, index) => ({
    user_id: user.id,
    clip_id: clipId,
    viewed_at: new Date(baseTime + index).toISOString(),
  }));

  const { error } = await supabase
    .from("user_view_history")
    .upsert(rows, { onConflict: "user_id,clip_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: staleRows, error: staleRowsError } = await supabase
    .from("user_view_history")
    .select("clip_id")
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .range(MAX_VIEW_HISTORY_ITEMS, MAX_VIEW_HISTORY_ITEMS + 500);

  if (staleRowsError) {
    return NextResponse.json({ error: staleRowsError.message }, { status: 500 });
  }

  const staleClipIds = (staleRows ?? []).map((row) => row.clip_id);
  if (staleClipIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("user_view_history")
      .delete()
      .eq("user_id", user.id)
      .in("clip_id", staleClipIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
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

  const clipId = request.nextUrl.searchParams.get("clipId")?.trim();
  let query = supabase.from("user_view_history").delete().eq("user_id", user.id);

  if (clipId) {
    query = query.eq("clip_id", clipId);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
