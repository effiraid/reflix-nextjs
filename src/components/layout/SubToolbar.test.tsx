import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SubToolbar } from "./SubToolbar";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useFilterStore } from "@/stores/filterStore";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/ko/browse",
  useSearchParams: () => searchParams,
}));

const dict = {
  clip: koDict.clip,
} satisfies Pick<Dictionary, "clip">;

const categories = {
  movement: {
    slug: "movement",
    i18n: { ko: "이동", en: "Movement" },
  },
} as const;

describe("SubToolbar", () => {
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth"
  );

  beforeEach(() => {
    useUIStore.setState({
      filterBarOpen: false,
      thumbnailSize: 2,
      activeFilterTab: null,
      shuffleSeed: 0,
    });
    useFilterStore.setState({
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      starFilter: null,
      searchQuery: "",
      sortBy: "newest",
      category: null,
    });
    useAuthStore.setState({
      user: null,
      tier: "free",
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    }
  });

  it("does not render the random label in the top toolbar", () => {
    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);

    expect(screen.queryByText("무작위")).not.toBeInTheDocument();
  });

  it("hides the shuffle control for free users", () => {
    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);

    expect(
      screen.queryByRole("button", { name: "Pro 전용 기능" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("PRO")).not.toBeInTheDocument();
  });

  it("increments the shuffle seed when the Pro-only icon is clicked by a Pro user", () => {
    useAuthStore.setState({
      user: { id: "user-1" } as never,
      tier: "pro",
      isLoading: false,
    });

    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);

    fireEvent.click(screen.getByRole("button", { name: "무작위로 섞기" }));

    expect(useUIStore.getState().shuffleSeed).toBe(1);
  });

  it("extends the zoom control to the new 1-column terminal state", () => {
    useUIStore.setState({
      thumbnailSize: 3,
    });

    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);

    const slider = screen.getByRole("slider");
    const plusButton = screen.getByRole("button", { name: "+" });

    expect(slider).toHaveAttribute("max", "4");

    fireEvent.click(plusButton);

    expect(useUIStore.getState().thumbnailSize).toBe(4);
  });

  it("does not render the inline search field in the top toolbar", () => {
    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);

    expect(screen.queryByRole("textbox", { name: "검색" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "검색" })).not.toBeInTheDocument();
  });

  it("shows the current folder and tag filters in the center summary", () => {
    useFilterStore.setState({
      selectedFolders: ["movement"],
      excludedFolders: [],
      selectedTags: ["걷기"],
      excludedTags: ["마법"],
    });

    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);
    const badgeTrack = screen.getByTestId("toolbar-filter-badges");

    expect(within(badgeTrack).getByText("이동")).toBeInTheDocument();
    expect(within(badgeTrack).getByText("걷기")).toBeInTheDocument();
    expect(within(badgeTrack).getByText("-마법")).toBeInTheDocument();
    expect(
      within(badgeTrack).queryByText("폴더: 이동 · 태그: 걷기 · 제외: 마법")
    ).not.toBeInTheDocument();
  });

  it("clears a selected folder badge when clicked", () => {
    useFilterStore.setState({
      selectedFolders: ["movement"],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
    });

    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);
    const badgeTrack = screen.getByTestId("toolbar-filter-badges");

    fireEvent.click(within(badgeTrack).getByRole("button", { name: "이동" }));

    expect(useFilterStore.getState().selectedFolders).toEqual([]);
    expect(useFilterStore.getState().excludedFolders).toEqual([]);
    expect(screen.queryByTestId("toolbar-filter-badges")).not.toBeInTheDocument();
  });

  it("clears a selected tag badge when clicked", () => {
    useFilterStore.setState({
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: ["걷기"],
      excludedTags: [],
    });

    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);
    const badgeTrack = screen.getByTestId("toolbar-filter-badges");

    fireEvent.click(within(badgeTrack).getByRole("button", { name: "걷기" }));

    expect(useFilterStore.getState().selectedTags).toEqual([]);
    expect(useFilterStore.getState().excludedTags).toEqual([]);
    expect(screen.queryByTestId("toolbar-filter-badges")).not.toBeInTheDocument();
  });

  it("clears an excluded tag badge when clicked", () => {
    useFilterStore.setState({
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: ["마법"],
    });

    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);
    const badgeTrack = screen.getByTestId("toolbar-filter-badges");

    fireEvent.click(within(badgeTrack).getByRole("button", { name: "-마법" }));

    expect(useFilterStore.getState().excludedTags).toEqual([]);
    expect(screen.queryByTestId("toolbar-filter-badges")).not.toBeInTheDocument();
  });

  it("shows an overflow badge when the available width is narrow", () => {
    useFilterStore.setState({
      selectedFolders: ["movement"],
      excludedFolders: [],
      selectedTags: ["걷기", "달리기", "점프"],
      excludedTags: ["마법"],
    });

    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        const text = this.textContent?.trim() ?? "";

        if (this.getAttribute("data-testid") === "toolbar-filter-badges") {
          return 150;
        }

        if (text === "이동" || text === "걷기" || text === "점프") {
          return 40;
        }

        if (text === "달리기") {
          return 56;
        }

        if (text === "-마법") {
          return 44;
        }

        if (/^\+\d+$/.test(text)) {
          return 48;
        }

        return 0;
      },
    });

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(private readonly callback: ResizeObserverCallback) {}

        observe() {
          this.callback([], this);
        }

        disconnect() {}

        unobserve() {}
      }
    );

    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);
    const badgeTrack = screen.getByTestId("toolbar-filter-badges");

    expect(badgeTrack).toHaveClass("overflow-hidden");
    expect(within(badgeTrack).getByText("이동")).toBeInTheDocument();
    expect(within(badgeTrack).getByText("걷기")).toBeInTheDocument();
    expect(within(badgeTrack).getByText("+3")).toBeInTheDocument();
    expect(within(badgeTrack).queryByText("달리기")).not.toBeInTheDocument();
    expect(within(badgeTrack).queryByText("점프")).not.toBeInTheDocument();
    expect(within(badgeTrack).queryByText("-마법")).not.toBeInTheDocument();
  });

  it("anchors the zoom controls to the right side of the top toolbar", () => {
    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);

    expect(screen.getByRole("slider").parentElement).toHaveClass(
      "justify-self-end"
    );
  });
});
