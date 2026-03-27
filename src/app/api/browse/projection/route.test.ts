import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/data", () => ({
  loadBrowseProjection: vi.fn(async () => [
    {
      id: "A",
      name: "Arcane",
      thumbnailUrl: "/thumbnails/A.webp",
      previewUrl: "/previews/A.mp4",
      lqipBase64: "",
      width: 640,
      height: 360,
      duration: 1,
      star: 4,
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-1"],
      searchTokens: ["arcane", "burst"],
    },
  ]),
}));

describe("browse projection route", () => {
  it("returns browse projection data with cache headers", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual([
      expect.objectContaining({
        id: "A",
        searchTokens: ["arcane", "burst"],
      }),
    ]);
    expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate");
  });
});
