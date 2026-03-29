import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/data", () => ({
  loadBrowseFilterIndex: vi.fn(async () => [
    {
      id: "A",
      name: "Arcane",
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-1"],
      searchTokens: ["arcane", "burst"],
    },
    {
      id: "B",
      name: "Beta",
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-2"],
      searchTokens: ["beta"],
    },
    {
      id: "C",
      name: "Gamma",
      category: "action",
      tags: ["magic"],
      aiStructuredTags: ["burst"],
      folders: ["folder-3"],
      searchTokens: ["gamma"],
    },
    {
      id: "D",
      name: "Delta",
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

describe("browse filter-index route", () => {
  it("returns the full filter index for guest-side search hydration", async () => {
    getServerViewerTierMock.mockResolvedValueOnce("guest");

    const response = await GET();
    const body = await response.json();

    expect(body).toHaveLength(4);
    expect(body.map((clip: { id: string }) => clip.id)).toEqual(["A", "B", "C", "D"]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns filter-index data with cache headers", async () => {
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
