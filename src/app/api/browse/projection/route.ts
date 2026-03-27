import { NextResponse } from "next/server";
import { loadBrowseProjection } from "@/lib/data";

export async function GET() {
  const projection = await loadBrowseProjection();

  return NextResponse.json(projection, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
