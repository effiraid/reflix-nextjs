import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type {
  BrowseCardRecord,
  BrowseFilterIndexRecord,
  BrowseSummaryRecord,
} from "@/lib/types";

const pageMocks = vi.hoisted(() => ({
  getServerViewerTier: vi.fn(),
  getTagAliases: vi.fn(),
  loadBrowsePageData: vi.fn(),
}));

const dict = {
  ...koDict,
} as const;

vi.mock("@/lib/data", () => ({
  getCategories: vi.fn(async () => ({})),
  getTagAliases: pageMocks.getTagAliases,
  getTagGroups: vi.fn(async () => ({ groups: [], parentGroups: [] })),
  getTagI18n: vi.fn(async () => ({})),
  loadBrowseCards: vi.fn(async () => []),
  loadBrowseFilterIndex: vi.fn(async () => []),
}));

vi.mock("./browseBootstrap", () => ({
  loadBrowsePageData: pageMocks.loadBrowsePageData,
}));

vi.mock("@/lib/browseAccess", () => ({
  getServerViewerTier: pageMocks.getServerViewerTier,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({})),
}));

vi.mock("@/lib/boardData", () => ({
  loadBoardClipIds: vi.fn(async () => []),
}));

vi.mock("../dictionaries", () => ({
  getDictionary: vi.fn(async () => dict),
}));

vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock("@/components/layout/LeftPanel", () => ({
  LeftPanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="left-panel">{children}</div>
  ),
}));

vi.mock("@/components/layout/RightPanel", () => ({
  RightPanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="right-panel">{children}</div>
  ),
}));

vi.mock("./BrowseClient", () => ({
  BrowseClient: () => <div>Browse Client</div>,
}));

let clipDataProviderProps: Record<string, unknown> | null = null;

vi.mock("./ClipDataProvider", () => ({
  ClipDataProvider: (props: { children: React.ReactNode }) => {
    clipDataProviderProps = props;
    return <div data-testid="clip-data-provider">{props.children}</div>;
  },
}));

vi.mock("./LeftPanelContent", () => ({
  LeftPanelContent: () => <div>Left Panel Content</div>,
}));

vi.mock("@/components/filter/FilterPanel", () => ({
  FilterPanel: () => <div>Filter Panel</div>,
}));

vi.mock("@/components/layout/SubToolbar", () => ({
  SubToolbar: () => <div>Sub Toolbar</div>,
}));

const pendingRightPanel = new Promise<never>(() => {});

vi.mock("@/components/layout/RightPanelContent", () => ({
  RightPanelContent: () => {
    throw pendingRightPanel;
  },
}));

import BrowsePage, { BrowsePageShell } from "./page";

describe("BrowsePage", () => {
  beforeEach(() => {
    clipDataProviderProps = null;
    vi.clearAllMocks();
    pageMocks.getServerViewerTier.mockResolvedValue("guest");
    pageMocks.getTagAliases.mockResolvedValue(null);
    pageMocks.loadBrowsePageData.mockResolvedValue({
      dict,
      categories: {},
      tagGroups: { groups: [], parentGroups: [] },
      tagI18n: {},
      browseCards: [],
      browseFilterIndex: null,
      initialFolderClipIds: {},
    });
  });

  it("does not ask bootstrap to load the detailed filter index for search-only deep links", async () => {
    await act(async () => {
      render(
        <BrowsePage
          params={Promise.resolve({ lang: "ko" })}
          searchParams={Promise.resolve({ q: "Alpha" })}
        />
      );
    });

    await waitFor(() => {
      expect(pageMocks.loadBrowsePageData).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: "ko",
          shouldLoadDetailedIndex: false,
          shouldLoadFilterIndex: false,
          viewerTier: "guest",
        }),
        expect.any(Object)
      );
    });
  });

  it("still asks bootstrap to load the detailed filter index for tag deep links", async () => {
    await act(async () => {
      render(
        <BrowsePage
          params={Promise.resolve({ lang: "ko" })}
          searchParams={Promise.resolve({ tag: "마법" })}
        />
      );
    });

    await waitFor(() => {
      expect(pageMocks.loadBrowsePageData).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: "ko",
          shouldLoadDetailedIndex: true,
          shouldLoadFilterIndex: true,
          viewerTier: "guest",
        }),
        expect.any(Object)
      );
    });
  });

  it("passes filtered result count and full library count separately to the clip data provider", async () => {
    const browseSummary: BrowseSummaryRecord[] = [
      {
        id: "clip-a",
        name: "Alpha",
        thumbnailUrl: "/a.jpg",
        previewUrl: "/a.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
      {
        id: "clip-b",
        name: "Beta",
        thumbnailUrl: "/b.jpg",
        previewUrl: "/b.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
      {
        id: "clip-c",
        name: "Gamma",
        thumbnailUrl: "/c.jpg",
        previewUrl: "/c.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
    ];
    const browseFilterIndex: BrowseFilterIndexRecord[] = browseSummary.map((clip) => ({
      id: clip.id,
      name: clip.name,
      category: clip.category,
      tags: [],
      folders: [],
      aiStructuredTags: [],
      searchTokens: [clip.name.toLowerCase()],
    }));

    clipDataProviderProps = null;

    render(
      <BrowsePageShell
        lang="ko"
        dict={dict as never}
        categories={{}}
        tagGroups={{ groups: [], parentGroups: [] }}
        tagI18n={{}}
        browseCards={browseSummary as BrowseCardRecord[]}
        browseFilterIndex={browseFilterIndex}
        rawSearchParams={{ q: "Alpha" }}
      />
    );

    expect(clipDataProviderProps).toMatchObject({
      initialTotalCount: 1,
      totalClipCount: 3,
    });
  });

  it("does not preload the detailed index in the shell for search-only deep links", () => {
    const browseSummary: BrowseSummaryRecord[] = [
      {
        id: "clip-a",
        name: "Alpha",
        thumbnailUrl: "/a.jpg",
        previewUrl: "/a.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
      {
        id: "clip-b",
        name: "Beta",
        thumbnailUrl: "/b.jpg",
        previewUrl: "/b.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
    ];

    render(
      <BrowsePageShell
        lang="ko"
        dict={dict as never}
        categories={{}}
        tagGroups={{ groups: [], parentGroups: [] }}
        tagI18n={{}}
        browseCards={browseSummary as BrowseCardRecord[]}
        browseFilterIndex={null}
        preloadDetailedIndex={false}
        rawSearchParams={{ q: "Alpha" }}
      />
    );

    expect(clipDataProviderProps).toMatchObject({
      initialTotalCount: 1,
      totalClipCount: 2,
      preloadDetailedIndex: false,
    });
  });

  it("shows a Suspense fallback for the right panel when it blocks on navigation data", async () => {
    render(
      <BrowsePageShell
        lang="ko"
        dict={dict as never}
        categories={{}}
        tagGroups={{ groups: [], parentGroups: [] }}
        tagI18n={{}}
        browseCards={[]}
        browseFilterIndex={[]}
        rawSearchParams={{}}
      />
    );

    expect(screen.getByTestId("right-panel")).toBeInTheDocument();
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("filters the initial payload when a board deep link provides clip ids", () => {
    const browseSummary: BrowseSummaryRecord[] = [
      {
        id: "clip-a",
        name: "Alpha",
        thumbnailUrl: "/a.jpg",
        previewUrl: "/a.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
      {
        id: "clip-b",
        name: "Beta",
        thumbnailUrl: "/b.jpg",
        previewUrl: "/b.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
    ];

    clipDataProviderProps = null;

    const props = {
      lang: "ko",
      dict: dict as never,
      categories: {},
      tagGroups: { groups: [], parentGroups: [] },
      tagI18n: {},
      browseCards: browseSummary as BrowseCardRecord[],
      browseFilterIndex: browseSummary.map((clip) => ({
        id: clip.id,
        name: clip.name,
        category: clip.category,
        tags: [],
        folders: [],
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      rawSearchParams: { board: "board-1" },
      initialBoardClipIds: new Set(["clip-b"]),
    } as unknown as ComponentProps<typeof BrowsePageShell>;

    render(<BrowsePageShell {...props} />);

    expect(clipDataProviderProps).toMatchObject({
      clips: [expect.objectContaining({ id: "clip-b" })],
      initialTotalCount: 1,
      totalClipCount: 2,
    });
  });
});
