import { NextResponse } from "next/server";
import { loadBrowseCards } from "@/lib/data";

export async function GET() {
  const cards = await loadBrowseCards();
  const body = JSON.stringify(cards);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
