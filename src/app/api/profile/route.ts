import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getValidatedRequestOrigin } from "@/lib/requestOrigin";

export async function PUT(request: Request) {
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
  const displayName =
    typeof body.display_name === "string" ? body.display_name.trim() : undefined;

  if (displayName !== undefined && displayName.length > 30) {
    return NextResponse.json(
      { error: "Display name must be 30 characters or less" },
      { status: 400 }
    );
  }

  const updates: Record<string, string | null> = {};
  if (displayName !== undefined) {
    updates.display_name = displayName || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ display_name: updates.display_name });
}
