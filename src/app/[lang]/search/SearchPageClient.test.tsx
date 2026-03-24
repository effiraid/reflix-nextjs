import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchPageClient } from "./SearchPageClient";
import type { ClipIndex } from "@/lib/types";

vi.mock("@/components/clip/MasonryGrid", () => ({
  MasonryGrid: ({ clips }: { clips: ClipIndex[] }) => (
    <div data-testid="clip-order">{clips.map((clip) => clip.id).join(",")}</div>
  ),
}));

const clips: ClipIndex[] = [
  {
    id: "clip-a",
    name: "Alpha Strike",
    tags: ["hero"],
    folders: [],
    star: 4,
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/a.mp4",
    thumbnailUrl: "/a.webp",
    lqipBase64: "",
  },
  {
    id: "clip-b",
    name: "Boss Arena",
    tags: ["monster"],
    folders: [],
    star: 5,
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/b.mp4",
    thumbnailUrl: "/b.webp",
    lqipBase64: "",
  },
];

describe("SearchPageClient", () => {
  it("filters clips using the existing search logic", () => {
    render(
      <SearchPageClient
        initialClips={clips}
        categories={{}}
        tagI18n={{ monster: "boss" }}
        query="boss"
        dict={{
          nav: { searchPlaceholder: "Search clips" },
          browse: { noResults: "No results" },
        }}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b");
  });

  it("shows a non-error empty state when no query is present", () => {
    render(
      <SearchPageClient
        initialClips={clips}
        categories={{}}
        tagI18n={{}}
        query=""
        dict={{
          nav: { searchPlaceholder: "Search clips" },
          browse: { noResults: "No results" },
        }}
      />
    );

    expect(screen.getByText("Search clips")).toBeInTheDocument();
    expect(screen.queryByTestId("clip-order")).not.toBeInTheDocument();
  });
});
