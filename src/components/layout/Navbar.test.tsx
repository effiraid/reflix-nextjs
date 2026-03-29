import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { useAuthStore } from "@/stores/authStore";
import { prewarmBrowseSearch } from "@/lib/browsePagefind";

const push = vi.fn();
const setTheme = vi.fn();
const setLeftPanelOpen = vi.fn();
const setRightPanelOpen = vi.fn();
const setSelectedClipId = vi.fn();
const requestCardIndex = vi.fn();
const requestDetailedIndex = vi.fn();
let browseDataState = {
  allCards: [] as Array<Record<string, unknown>>,
  cardsStatus: "ready" as "loading" | "ready" | "error",
  projectionClips: [] as Array<Record<string, unknown>>,
  projectionStatus: "ready" as "loading" | "ready" | "error",
};
let uiState = {
  leftPanelOpen: true,
  rightPanelOpen: true,
  mobileSearchOpen: false,
};
let searchBarProps: Record<string, unknown> | null = null;
let mobileSearchOverlayProps: Record<string, unknown> | null = null;
let isMobileViewport = false;

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ko/browse",
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("q=search"),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme,
  }),
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: () => ({
    ...uiState,
    setLeftPanelOpen,
    setRightPanelOpen,
    setMobileSearchOpen: (open: boolean) => {
      uiState.mobileSearchOpen = open;
    },
  }),
}));

vi.mock("@/components/common/SearchBar", () => ({
  SearchBar: (props: {
    initialQuery: string;
    onSearch: (value: string) => void;
  }) => {
    searchBarProps = props as unknown as Record<string, unknown>;
    return (
      <button type="button" onClick={() => props.onSearch(props.initialQuery || "boss fight")}>
      Search mock
      </button>
    );
  },
}));

vi.mock("@/app/[lang]/browse/ClipDataProvider", () => ({
  useClipData: () => [],
  useBrowseData: () => ({
    ...browseDataState,
    initialClips: [],
    initialTotalCount: 0,
    allTags: [],
    popularTags: [],
    requestDetailedIndex,
    requestCardIndex,
  }),
}));

vi.mock("@/lib/browsePagefind", () => ({
  prewarmBrowseSearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/stores/clipStore", () => ({
  useClipStore: () => ({
    setSelectedClipId,
  }),
}));

vi.mock("./MobileSearchOverlay", () => ({
  MobileSearchOverlay: ({
    open,
    onRequestSearchReady,
    ...props
  }: {
    open: boolean;
    onRequestSearchReady?: () => void;
  }) => {
    mobileSearchOverlayProps = { open, onRequestSearchReady, ...props };

    useEffect(() => {
      if (open) {
        onRequestSearchReady?.();
      }
    }, [open, onRequestSearchReady]);

    return open ? <div>Mobile search overlay</div> : null;
  },
}));

const dict = {
  nav: {
    home: "홈",
    browse: "둘러보기",
    search: "검색",
    searchPlaceholder: "검색",
  },
};

describe("Navbar", () => {
  beforeEach(() => {
    push.mockReset();
    setTheme.mockReset();
    setLeftPanelOpen.mockReset();
    setRightPanelOpen.mockReset();
    setSelectedClipId.mockReset();
    requestCardIndex.mockReset();
    requestDetailedIndex.mockReset();
    vi.mocked(prewarmBrowseSearch).mockReset();
    vi.mocked(prewarmBrowseSearch).mockResolvedValue(undefined);
    searchBarProps = null;
    mobileSearchOverlayProps = null;
    browseDataState = {
      allCards: [],
      cardsStatus: "ready",
      projectionClips: [],
      projectionStatus: "ready",
    };
    useAuthStore.setState({
      user: null,
      tier: "free",
      planTier: "free",
      accessSource: "free",
      betaEndsAt: null,
      isLoading: false,
    });
    uiState = {
      leftPanelOpen: true,
      rightPanelOpen: true,
      mobileSearchOpen: false,
    };
    isMobileViewport = false;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: isMobileViewport,
        media: "(max-width: 767px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders the theme toggle with an icon instead of unicode text", () => {
    render(<Navbar lang="ko" dict={dict} />);

    const themeButton = screen.getByRole("button", {
      name: "다크 테마로 전환",
    });
    const panelButton = screen.getByRole("button", {
      name: "좌우 사이드바 접기",
    });

    expect(themeButton.querySelector("svg")).toBeInTheDocument();
    expect(themeButton).not.toHaveTextContent("☾");
    expect(themeButton).not.toHaveTextContent("☀");
    expect(panelButton.querySelector("svg")).toBeInTheDocument();
  });

  it("collapses both side panels when the panels toggle is clicked", () => {
    render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(
      screen.getByRole("button", { name: "좌우 사이드바 접기" })
    );

    expect(setLeftPanelOpen).toHaveBeenCalledWith(false);
    expect(setRightPanelOpen).toHaveBeenCalledWith(false);
  });

  it("auto-collapses both panels when the mobile browse view mounts", () => {
    isMobileViewport = true;

    render(<Navbar lang="ko" dict={dict} />);

    expect(setLeftPanelOpen).toHaveBeenCalledWith(false);
    expect(setRightPanelOpen).toHaveBeenCalledWith(false);
  });

  it("uses a mobile-only panel toggle that opens the left panel without reopening the right panel", () => {
    isMobileViewport = true;
    uiState = {
      leftPanelOpen: false,
      rightPanelOpen: false,
      mobileSearchOpen: false,
    };

    render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(
      screen.getByRole("button", { name: "탐색 패널 열기" })
    );

    expect(setLeftPanelOpen).toHaveBeenCalledWith(true);
    expect(setRightPanelOpen).toHaveBeenCalledWith(false);
  });

  it("expands both side panels when both are closed", () => {
    uiState = {
      leftPanelOpen: false,
      rightPanelOpen: false,
    };

    render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(
      screen.getByRole("button", { name: "좌우 사이드바 펼치기" })
    );

    expect(setLeftPanelOpen).toHaveBeenCalledWith(true);
    expect(setRightPanelOpen).toHaveBeenCalledWith(true);
  });

  it("pushes the shared search route when the search bar submits", () => {
    render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "Search mock" }));

    expect(push).toHaveBeenCalledWith("/ko/browse?q=search");
  });

  it("prewarms browse search on desktop activation by requesting cards and Pagefind", async () => {
    render(<Navbar lang="ko" dict={dict} />);

    const onActivate = searchBarProps?.onActivate as (() => void) | undefined;

    expect(onActivate).toBeTypeOf("function");
    onActivate?.();

    expect(requestCardIndex).toHaveBeenCalledTimes(1);
    expect(prewarmBrowseSearch).toHaveBeenCalledWith("ko");
    expect(requestDetailedIndex).not.toHaveBeenCalled();
  });

  it("uses a centered desktop search slot and right-aligned control group", () => {
    render(<Navbar lang="ko" dict={dict} />);

    const header = screen.getByRole("banner");
    const searchSlot = screen.getByTestId("navbar-search");
    const controls = screen.getByTestId("navbar-controls");

    expect(header.className).toContain("grid");
    expect(header.className).toContain(
      "md:grid-cols-[minmax(0,1fr)_minmax(16rem,32rem)_minmax(0,1fr)]"
    );
    expect(searchSlot.className).toContain("md:justify-self-center");
    expect(controls.className).toContain("justify-self-end");
  });

  it("opens the mobile search overlay from the search icon button", () => {
    const view = render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "모바일 검색 열기" }));
    view.rerender(<Navbar lang="ko" dict={dict} />);

    expect(screen.getByText("Mobile search overlay")).toBeInTheDocument();
  });

  it("keeps the mobile search overlay open across a navbar remount", () => {
    const firstRender = render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "모바일 검색 열기" }));
    firstRender.rerender(<Navbar lang="ko" dict={dict} />);
    expect(screen.getByText("Mobile search overlay")).toBeInTheDocument();

    firstRender.unmount();
    render(<Navbar lang="ko" dict={dict} />);

    expect(screen.getByText("Mobile search overlay")).toBeInTheDocument();
  });

  it("prewarms shared mobile search when opening the overlay from the navbar", () => {
    const view = render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "모바일 검색 열기" }));
    view.rerender(<Navbar lang="ko" dict={dict} />);

    expect(screen.getByText("Mobile search overlay")).toBeInTheDocument();
    expect(requestCardIndex).toHaveBeenCalledTimes(1);
    expect(prewarmBrowseSearch).toHaveBeenCalledWith("ko");
  });

  it("prefers projection clips and projection readiness for the mobile fallback path", () => {
    const projectionClip = {
      id: "projection-1",
      name: "Projection clip",
      thumbnailUrl: "/projection.webp",
      previewUrl: "/projection.mp4",
      lqipBase64: "",
      width: 100,
      height: 100,
      duration: 1,
      category: "acting",
      tags: ["projection"],
      folders: ["hero"],
      aiStructuredTags: ["rich"],
      searchTokens: ["projection"],
    };
    const cardClip = {
      id: "card-1",
      name: "Card clip",
      thumbnailUrl: "/card.webp",
      previewUrl: "/card.mp4",
      lqipBase64: "",
      width: 100,
      height: 100,
      duration: 1,
      category: "acting",
      tags: ["card"],
    };

    browseDataState = {
      allCards: [cardClip],
      cardsStatus: "loading",
      projectionClips: [projectionClip],
      projectionStatus: "ready",
    };

    render(<Navbar lang="ko" dict={dict} />);

    expect(mobileSearchOverlayProps?.clips).toEqual([projectionClip]);
    expect(mobileSearchOverlayProps?.searchReady).toBe(true);
  });

  it("shows Upgrade to Pro for beta users instead of Manage subscription", () => {
    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "pro",
      planTier: "free",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
      isLoading: false,
    });

    render(<Navbar lang="ko" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: "프로필" }));

    expect(screen.getByText("Pro 업그레이드")).toBeInTheDocument();
    expect(screen.queryByText("구독 관리")).toBeNull();
  });
});
