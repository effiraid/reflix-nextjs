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

describe("browse cards route", () => {
  it("returns the full card payload for guest-side search hydration", async () => {
    getServerViewerTierMock.mockResolvedValueOnce("guest");

    const response = await GET();
    const body = await response.json();

    expect(body).toHaveLength(4);
    expect(body.map((clip: { id: string }) => clip.id)).toEqual(["A", "B", "C", "D"]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns browse cards with cache headers", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "A",
          thumbnailUrl: "/thumbnails/A.webp",
        }),
      ])
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
