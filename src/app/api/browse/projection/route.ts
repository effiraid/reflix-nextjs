import { NextResponse } from "next/server";
import { loadBrowseProjection } from "@/lib/data";
import { getServerViewerTier } from "@/lib/browseAccess";

export async function GET() {
  const [projection] = await Promise.all([
    loadBrowseProjection(),
    getServerViewerTier(),
  ]);

  return NextResponse.json(projection, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
