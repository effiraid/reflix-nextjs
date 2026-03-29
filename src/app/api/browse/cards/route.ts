import { NextResponse } from "next/server";
import { loadBrowseCards } from "@/lib/data";
import { getServerViewerTier } from "@/lib/browseAccess";

export async function GET() {
  const [cards] = await Promise.all([
    loadBrowseCards(),
    getServerViewerTier(),
  ]);
  const body = JSON.stringify(cards);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
