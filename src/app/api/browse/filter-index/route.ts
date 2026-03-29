import { NextResponse } from "next/server";
import { loadBrowseFilterIndex } from "@/lib/data";
import { getServerViewerTier } from "@/lib/browseAccess";

export async function GET() {
  const [filterIndex] = await Promise.all([
    loadBrowseFilterIndex(),
    getServerViewerTier(),
  ]);
  const body = JSON.stringify(filterIndex);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
