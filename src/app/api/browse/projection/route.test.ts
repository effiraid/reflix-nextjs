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
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-1"],
      searchTokens: ["arcane", "burst"],
    },
    {
      id: "B",
      name: "Beta",
      thumbnailUrl: "/thumbnails/B.webp",
      previewUrl: "/previews/B.mp4",
      lqipBase64: "",
      width: 640,
      height: 360,
      duration: 1,
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-2"],
      searchTokens: ["beta"],
    },
    {
      id: "C",
      name: "Gamma",
      thumbnailUrl: "/thumbnails/C.webp",
      previewUrl: "/previews/C.mp4",
      lqipBase64: "",
      width: 640,
      height: 360,
      duration: 1,
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-3"],
      searchTokens: ["gamma"],
    },
    {
      id: "D",
      name: "Delta",
      thumbnailUrl: "/thumbnails/D.webp",
      previewUrl: "/previews/D.mp4",
      lqipBase64: "",
      width: 640,
      height: 360,
      duration: 1,
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-4"],
      searchTokens: ["delta"],
    },
  ]),
}));

const { getServerViewerTierMock } = vi.hoisted(() => ({
  getServerViewerTierMock: vi.fn(
    async (): Promise<"guest" | "free" | "pro"> => "pro"
  ),
}));

vi.mock("@/lib/browseAccess", () => ({
  getServerViewerTier: getServerViewerTierMock,
}));

describe("browse projection route", () => {
  it("returns the full projection payload for guest-side search hydration", async () => {
    getServerViewerTierMock.mockResolvedValueOnce("guest");

    const response = await GET();
    const body = await response.json();

    expect(body).toHaveLength(4);
    expect(body.map((clip: { id: string }) => clip.id)).toEqual(["A", "B", "C", "D"]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns browse projection data with cache headers", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "A",
          searchTokens: ["arcane", "burst"],
        }),
      ])
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
