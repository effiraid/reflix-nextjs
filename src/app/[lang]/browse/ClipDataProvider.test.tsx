import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipDataProvider, useBrowseData } from "./ClipDataProvider";
import type {
  BrowseCardRecord,
  BrowseFilterIndexRecord,
  BrowseSummaryRecord,
} from "@/lib/types";
import { useFilterStore } from "@/stores/filterStore";

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

function DemandProbe() {
  const browseData = useBrowseData() as ReturnType<typeof useBrowseData> & {
    requestDetailedIndex?: () => void;
  };

  return (
    <button type="button" onClick={() => browseData.requestDetailedIndex?.()}>
      demand
    </button>
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
    category: "action",
  },
];

const cards: BrowseCardRecord[] = [
  initialClips[0],
  {
    id: "B",
    name: "Beta",
    thumbnailUrl: "/thumbnails/B.webp",
    previewUrl: "/previews/B.mp4",
    lqipBase64: "",
    width: 640,
    height: 360,
    duration: 1,
    category: "acting",
  },
];

const filterIndex: BrowseFilterIndexRecord[] = [
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
    category: "acting",
    tags: ["walk"],
    aiStructuredTags: [],
    folders: ["folder-2"],
    searchTokens: ["beta", "walk"],
  },
];

describe("ClipDataProvider", () => {
  afterEach(() => {
    useFilterStore.getState().clearFilters();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps initial clips and hydrates projection when detailed data is preloaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => cards,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => filterIndex,
        })
    );

    render(
      <ClipDataProvider
        clips={initialClips}
        initialTotalCount={42}
        preloadDetailedIndex
      >
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

  it("does not auto-fetch detailed data on mount or idle when no detailed filter is active", async () => {
    const fetchMock = vi.fn();
    const requestIdleCallbackMock = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("requestIdleCallback", requestIdleCallbackMock);
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <Probe />
      </ClipDataProvider>
    );

    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches detailed data exactly once after an explicit request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => cards,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => filterIndex,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <DemandProbe />
      </ClipDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "demand" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("does not fetch detailed data until a detailed filter is activated", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => cards,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => filterIndex,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <Probe />
      </ClipDataProvider>
    );

    expect(fetchMock).not.toHaveBeenCalled();

    useFilterStore.setState({ searchQuery: "arcane" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/browse/cards",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/browse/filter-index",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("can keep the full library count separate from the initial filtered result count", () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => cards,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => filterIndex,
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
