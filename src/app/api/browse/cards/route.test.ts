import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/data", () => ({
  loadBrowseCards: vi.fn(async () => [
    {
      id: "A",
      name: "Arcane",
      thumbnailUrl: "/thumbnails/A.webp",
      previewUrl: "/previews/A.mp4",
      lqipBase64: "",
      width: 640,
      height: 360,
      duration: 1,
      category: "action",
    },
  ]),
}));

describe("browse cards route", () => {
  it("returns browse cards with cache headers", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual([
      expect.objectContaining({
        id: "A",
        thumbnailUrl: "/thumbnails/A.webp",
      }),
    ]);
    expect(response.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate"
    );
  });
});
