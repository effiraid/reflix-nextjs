import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipDataProvider, useBrowseData } from "./ClipDataProvider";
import { useClipData } from "./ClipDataProvider";
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
    requestCardIndex?: () => void;
    requestDetailedIndex?: () => void;
  };

  return (
    <div>
      <button type="button" onClick={() => browseData.requestCardIndex?.()}>
        cards
      </button>
      <button type="button" onClick={() => browseData.requestDetailedIndex?.()}>
        detailed
      </button>
    </div>
  );
}

function CardsProbe() {
  const browseData = useBrowseData() as ReturnType<typeof useBrowseData> & {
    requestCardIndex?: () => void;
  };

  return (
    <button type="button" onClick={() => browseData.requestCardIndex?.()}>
      cards
    </button>
  );
}

function ClipDataProbe() {
  const clips = useClipData();
  const firstClip = clips[0];

  return (
    <div>
      <div data-testid="clip-id">{firstClip?.id ?? ""}</div>
      <div data-testid="clip-tags">{firstClip?.tags?.join(",") ?? ""}</div>
      <div data-testid="clip-folders">
        {firstClip?.folders?.join(",") ?? ""}
      </div>
      <div data-testid="clip-search-tokens">
        {firstClip?.searchTokens?.join(",") ?? ""}
      </div>
    </div>
  );
}

function MetadataProbe() {
  const { allTags, popularTags, tagCounts } = useBrowseData();

  return (
    <div>
      <div data-testid="all-tags">{allTags.join(",")}</div>
      <div data-testid="popular-tags">{popularTags.join(",")}</div>
      <div data-testid="tag-count-projection">
        {tagCounts["projection-tag"] ?? 0}
      </div>
      <div data-testid="tag-count-cards">{tagCounts["cards-tag"] ?? 0}</div>
    </div>
  );
}

function createAbortError() {
  return new DOMException("Aborted", "AbortError");
}

function createAbortableJson<T>(signal: AbortSignal, value: T) {
  let settled = false;
  let resolveFn!: (result: T) => void;
  let rejectFn!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const abort = () => {
    if (settled) return;
    settled = true;
    rejectFn(createAbortError());
  };

  if (signal.aborted) {
    abort();
  } else {
    signal.addEventListener("abort", abort, { once: true });
  }

  return {
    promise,
    resolve: () => {
      if (settled) return;
      settled = true;
      resolveFn(value);
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
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

  it("does not fetch detailed data for search-only state changes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <Probe />
      </ClipDataProvider>
    );

    useFilterStore.setState({ searchQuery: "alpha" });

    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches cards only when search surfaces request prewarm", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => cards,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <CardsProbe />
      </ClipDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "cards" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/browse/cards",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
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

    fireEvent.click(screen.getByRole("button", { name: "detailed" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/browse/cards",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/browse/filter-index",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("keeps cards prewarm alive when detailed loading is requested mid-flight", async () => {
    const requests: Array<{
      cards: ReturnType<typeof createAbortableJson<BrowseCardRecord[]>>;
      filterIndex?: ReturnType<typeof createAbortableJson<BrowseFilterIndexRecord[]>>;
    }> = [];

    const fetchMock = vi.fn().mockImplementation(
      async (url: string, options?: { signal?: AbortSignal }) => {
        if (url === "/api/browse/cards") {
          const cardsRequest = createAbortableJson(
            options?.signal ?? new AbortController().signal,
            cards
          );
          requests.push({ cards: cardsRequest });
          return {
            ok: true,
            json: () => cardsRequest.promise,
          };
        }

        if (url === "/api/browse/filter-index") {
          const filterRequest = createAbortableJson(
            options?.signal ?? new AbortController().signal,
            filterIndex
          );
          requests[requests.length - 1].filterIndex = filterRequest;
          return {
            ok: true,
            json: () => filterRequest.promise,
          };
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <DemandProbe />
        <Probe />
      </ClipDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "detailed" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      requests[0].cards.resolve();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      requests[0].filterIndex?.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("ready");
    });
    await waitFor(() => {
      expect(screen.getByTestId("projection-count")).toHaveTextContent("2");
    });
  });

  it("settles detailed loading when the shared cards request aborts", async () => {
    const cardsDeferred = createDeferred<BrowseCardRecord[]>();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/browse/cards") {
        return {
          ok: true,
          json: () => cardsDeferred.promise,
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <DemandProbe />
        <Probe />
      </ClipDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "detailed" }));

    await act(async () => {
      cardsDeferred.reject(new DOMException("Aborted", "AbortError"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("error");
    });
    expect(screen.getByTestId("projection-count")).toHaveTextContent("0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns projection records from useClipData after detailed loading completes", async () => {
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
        <ClipDataProbe />
      </ClipDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "detailed" }));

    await waitFor(() => {
      expect(screen.getByTestId("clip-tags")).toHaveTextContent("magic");
    });
    expect(screen.getByTestId("clip-folders")).toHaveTextContent("folder-1");
    expect(screen.getByTestId("clip-search-tokens")).toHaveTextContent("arcane,burst");
  });

  it("prefers projection metadata over cards metadata after detailed loading completes", async () => {
    const taggedCards: BrowseCardRecord[] = [
      {
        ...initialClips[0],
        tags: ["cards-tag"],
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
        category: "acting",
        tags: ["cards-tag"],
      },
    ];
    const projectionWithDifferentTags: BrowseFilterIndexRecord[] = [
      {
        id: "A",
        name: "Arcane",
        category: "action",
        tags: ["projection-tag"],
        aiStructuredTags: ["projection-structured"],
        folders: ["folder-1"],
        searchTokens: ["arcane", "projection"],
      },
      {
        id: "B",
        name: "Beta",
        category: "acting",
        tags: [],
        aiStructuredTags: [],
        folders: ["folder-2"],
        searchTokens: ["beta", "projection"],
      },
    ];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => taggedCards,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => projectionWithDifferentTags,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClipDataProvider clips={initialClips} initialTotalCount={42}>
        <DemandProbe />
        <MetadataProbe />
      </ClipDataProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "detailed" }));

    await waitFor(() => {
      expect(screen.getByTestId("all-tags")).toHaveTextContent("projection-tag");
    });
    expect(screen.getByTestId("all-tags")).not.toHaveTextContent("cards-tag");
    expect(screen.getByTestId("popular-tags")).toHaveTextContent("");
    expect(screen.getByTestId("tag-count-projection")).toHaveTextContent("1");
    expect(screen.getByTestId("tag-count-cards")).toHaveTextContent("0");
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

    useFilterStore.setState({ selectedTags: ["magic"] });

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
