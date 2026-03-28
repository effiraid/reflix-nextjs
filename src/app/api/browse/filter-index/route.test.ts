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
  ]),
}));

describe("browse filter-index route", () => {
  it("returns filter-index data with cache headers", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual([
      expect.objectContaining({
        id: "A",
        searchTokens: ["arcane", "burst"],
      }),
    ]);
    expect(response.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate"
    );
  });
});
