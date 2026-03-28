import { NextResponse } from "next/server";
import { loadBrowseFilterIndex } from "@/lib/data";

export async function GET() {
  const filterIndex = await loadBrowseFilterIndex();

  return NextResponse.json(filterIndex, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
