import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipDataProvider, useBrowseData } from "./ClipDataProvider";
import type { BrowseProjectionRecord, BrowseSummaryRecord } from "@/lib/types";

function Probe() {
  const {
    initialClips,
    projectionClips,
    projectionStatus,
    initialTotalCount,
    totalClipCount,
  } =
    useBrowseData();

  return (
    <div>
      <div data-testid="initial-count">{initialClips.length}</div>
      <div data-testid="projection-count">{projectionClips?.length ?? 0}</div>
      <div data-testid="status">{projectionStatus}</div>
      <div data-testid="total">{initialTotalCount}</div>
      <div data-testid="library-total">{totalClipCount}</div>
    </div>
  );
}

const initialClips: BrowseSummaryRecord[] = [
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
  },
];

const projectionClips: BrowseProjectionRecord[] = [
  {
    ...initialClips[0],
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
    star: 2,
    category: "acting",
    tags: ["walk"],
    aiStructuredTags: [],
    folders: ["folder-2"],
    searchTokens: ["beta", "walk"],
  },
];

describe("ClipDataProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps initial clips and then hydrates projection in the background", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => projectionClips,
      })
    );

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <Probe />
      </ClipDataProvider>
    );

    expect(screen.getByTestId("initial-count")).toHaveTextContent("1");
    expect(screen.getByTestId("projection-count")).toHaveTextContent("0");
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("total")).toHaveTextContent("42");
    expect(screen.getByTestId("library-total")).toHaveTextContent("42");

    await waitFor(() => {
      expect(screen.getByTestId("projection-count")).toHaveTextContent("2");
    });
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  it("can keep the full library count separate from the initial filtered result count", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => projectionClips,
      })
    );

    render(
      <ClipDataProvider
        clips={initialClips}
        initialTotalCount={1}
        totalClipCount={24}
      >
        <Probe />
      </ClipDataProvider>
    );

    expect(screen.getByTestId("total")).toHaveTextContent("1");
    expect(screen.getByTestId("library-total")).toHaveTextContent("24");
  });
});
