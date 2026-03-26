import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MasonryGrid } from "./MasonryGrid";
import { useUIStore } from "@/stores/uiStore";
import type { ClipIndex } from "@/lib/types";

type VirtualizerStub = {
  measure: ReturnType<typeof vi.fn>;
  measureElement: ReturnType<typeof vi.fn>;
  getTotalSize: ReturnType<typeof vi.fn>;
  getVirtualItems: ReturnType<typeof vi.fn>;
};

type ResizeObserverStub = {
  callback: ResizeObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  elements: Element[];
};

const { clipCardProps, resizeObserverStubs, virtualizerStubs, virtualizerOptions } =
  vi.hoisted(() => ({
    clipCardProps: [] as Array<Record<string, unknown>>,
    resizeObserverStubs: [] as ResizeObserverStub[],
    virtualizerStubs: [] as VirtualizerStub[],
    virtualizerOptions: [] as Array<Record<string, unknown>>,
  }));

vi.mock("@/components/clip/ClipCard", () => ({
  ClipCard: (props: { clip: ClipIndex }) => {
    clipCardProps.push(props);
    return <div data-testid={`clip-card-${props.clip.id}`}>{props.clip.name}</div>;
  },
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn((options: Record<string, unknown>) => {
    const count = Number(options.count ?? 0);
    const stub: VirtualizerStub = {
      measure: vi.fn(),
      measureElement: vi.fn(),
      getTotalSize: vi.fn(() => 240),
      getVirtualItems: vi.fn(() =>
        Array.from({ length: Math.min(2, count) }, (_, index) => ({
          index,
          start: index * 120,
        }))
      ),
    };

    virtualizerStubs.push(stub);
    virtualizerOptions.push(options);
    return stub;
  }),
}));

const clips: ClipIndex[] = [
  {
    id: "clip-a",
    name: "Alpha",
    tags: [],
    folders: [],
    star: 0,
    category: "action",
    width: 100,
    height: 160,
    duration: 1,
    previewUrl: "/a.mp4",
    thumbnailUrl: "/a.webp",
    lqipBase64: "",
  },
  {
    id: "clip-b",
    name: "Beta",
    tags: [],
    folders: [],
    star: 0,
    category: "action",
    width: 100,
    height: 120,
    duration: 1,
    previewUrl: "/b.mp4",
    thumbnailUrl: "/b.webp",
    lqipBase64: "",
  },
  {
    id: "clip-c",
    name: "Gamma",
    tags: [],
    folders: [],
    star: 0,
    category: "action",
    width: 100,
    height: 140,
    duration: 1,
    previewUrl: "/c.mp4",
    thumbnailUrl: "/c.webp",
    lqipBase64: "",
  },
  {
    id: "clip-d",
    name: "Delta",
    tags: [],
    folders: [],
    star: 0,
    category: "action",
    width: 100,
    height: 180,
    duration: 1,
    previewUrl: "/d.mp4",
    thumbnailUrl: "/d.webp",
    lqipBase64: "",
  },
  {
    id: "clip-e",
    name: "Epsilon",
    tags: [],
    folders: [],
    star: 0,
    category: "action",
    width: 100,
    height: 200,
    duration: 1,
    previewUrl: "/e.mp4",
    thumbnailUrl: "/e.webp",
    lqipBase64: "",
  },
  {
    id: "clip-f",
    name: "Zeta",
    tags: [],
    folders: [],
    star: 0,
    category: "action",
    width: 100,
    height: 220,
    duration: 1,
    previewUrl: "/f.mp4",
    thumbnailUrl: "/f.webp",
    lqipBase64: "",
  },
];

function triggerResize(stub: ResizeObserverStub, width: number) {
  stub.callback(
    [
      {
        contentRect: { width, height: 0 } as DOMRectReadOnly,
        target: stub.elements[0],
      } as ResizeObserverEntry,
    ],
    {
      disconnect: stub.disconnect,
      observe: () => {},
      unobserve: () => {},
    } as ResizeObserver
  );
}

describe("MasonryGrid", () => {
  beforeEach(() => {
    clipCardProps.length = 0;
    resizeObserverStubs.length = 0;
    virtualizerStubs.length = 0;
    virtualizerOptions.length = 0;

    class MockResizeObserver {
      callback: ResizeObserverCallback;
      disconnect = vi.fn();
      elements: Element[] = [];

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeObserverStubs.push(this);
      }

      observe = (element: Element) => {
        this.elements.push(element);
      };

      unobserve = vi.fn();
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    useUIStore.setState({
      thumbnailSize: 2,
      shuffleSeed: 0,
      quickViewOpen: false,
      filterBarOpen: false,
      activeFilterTab: null,
      leftPanelOpen: true,
      rightPanelOpen: true,
      viewMode: "masonry",
    });
  });

  it("recreates each virtualized column when the grid width changes", () => {
    render(
      <main data-masonry-scroll>
        <MasonryGrid clips={clips} />
      </main>
    );

    const activeVirtualizers = virtualizerStubs.slice(-3);
    const gridObserver = resizeObserverStubs.find((stub) =>
      (stub.elements[0] as HTMLElement | undefined)?.className.includes(
        "flex gap-3 p-3"
      )
    );

    expect(activeVirtualizers).toHaveLength(3);
    expect(gridObserver).toBeDefined();

    const virtualizerCountBeforeResize = virtualizerStubs.length;

    act(() => {
      triggerResize(gridObserver!, 960);
    });

    expect(virtualizerStubs).toHaveLength(virtualizerCountBeforeResize);

    act(() => {
      triggerResize(gridObserver!, 1280);
    });

    expect(virtualizerStubs).toHaveLength(virtualizerCountBeforeResize + 3);
  });

  it("keys virtualized measurements by clip id instead of column index", () => {
    render(
      <main data-masonry-scroll>
        <MasonryGrid clips={clips} />
      </main>
    );

    const activeOptions = virtualizerOptions.slice(-3) as Array<{
      getItemKey?: (index: number) => string;
    }>;

    expect(activeOptions).toHaveLength(3);
    expect(activeOptions[0]?.getItemKey?.(0)).toBe("clip-a");
    expect(activeOptions[0]?.getItemKey?.(1)).toBe("clip-d");
    expect(activeOptions[1]?.getItemKey?.(0)).toBe("clip-b");
    expect(activeOptions[1]?.getItemKey?.(1)).toBe("clip-e");
    expect(activeOptions[2]?.getItemKey?.(0)).toBe("clip-c");
    expect(activeOptions[2]?.getItemKey?.(1)).toBe("clip-f");
  });

  it("switches zoomed-out grids to hover-triggered previews", () => {
    useUIStore.setState({
      thumbnailSize: 0,
      shuffleSeed: 0,
      quickViewOpen: false,
      filterBarOpen: false,
      activeFilterTab: null,
      leftPanelOpen: true,
      rightPanelOpen: true,
      viewMode: "masonry",
    });

    render(
      <main data-masonry-scroll>
        <MasonryGrid clips={clips} />
      </main>
    );

    expect(clipCardProps.length).toBeGreaterThan(0);
    expect(clipCardProps[0]).toMatchObject({
      enablePreview: true,
      previewOnHover: true,
      showInfo: false,
    });
  });

  it("suspends grid previews while quick view is open", () => {
    useUIStore.setState({
      thumbnailSize: 2,
      shuffleSeed: 0,
      quickViewOpen: true,
      filterBarOpen: false,
      activeFilterTab: null,
      leftPanelOpen: true,
      rightPanelOpen: true,
      viewMode: "masonry",
    });

    render(
      <main data-masonry-scroll>
        <MasonryGrid clips={clips} />
      </main>
    );

    expect(clipCardProps.length).toBeGreaterThan(0);
    expect(clipCardProps[0]).toMatchObject({
      enablePreview: false,
    });
  });

  it("prioritizes above-the-fold thumbnails in each column", () => {
    render(
      <main data-masonry-scroll>
        <MasonryGrid clips={clips} />
      </main>
    );

    expect(clipCardProps.find((props) => props.clip === clips[0])).toMatchObject({
      prioritizeThumbnail: true,
    });
    expect(clipCardProps.find((props) => props.clip === clips[1])).toMatchObject({
      prioritizeThumbnail: true,
    });
    expect(clipCardProps.find((props) => props.clip === clips[2])).toMatchObject({
      prioritizeThumbnail: true,
    });
    expect(clipCardProps.find((props) => props.clip === clips[5])).toMatchObject({
      prioritizeThumbnail: false,
    });
  });
});
