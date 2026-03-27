import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SubToolbar } from "./SubToolbar";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { useUIStore } from "@/stores/uiStore";
import { useFilterStore } from "@/stores/filterStore";

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
      selectedTags: [],
      excludedTags: [],
      starFilter: null,
      searchQuery: "",
      sortBy: "newest",
      category: null,
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

  it("increments the shuffle seed when the shuffle icon is clicked", () => {
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

  it("shows an overflow badge when the available width is narrow", () => {
    useFilterStore.setState({
      selectedFolders: ["movement"],
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

        if (/^외 \d+건$/.test(text)) {
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
    expect(within(badgeTrack).getByText("외 3건")).toBeInTheDocument();
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
