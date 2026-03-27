import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SubToolbar } from "./SubToolbar";
import { useUIStore } from "@/stores/uiStore";
import { useFilterStore } from "@/stores/filterStore";

const dict = {
  clip: {
    tags: "태그",
  },
} as const;

const categories = {
  movement: {
    slug: "movement",
    i18n: { ko: "이동", en: "Movement" },
  },
} as const;

describe("SubToolbar", () => {
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

    expect(
      screen.getByText("폴더: 이동 · 태그: 걷기 · 제외: 마법")
    ).toBeInTheDocument();
  });

  it("anchors the zoom controls to the right side of the top toolbar", () => {
    render(<SubToolbar lang="ko" dict={dict} categories={categories} />);

    expect(screen.getByRole("slider").parentElement).toHaveClass(
      "justify-self-end"
    );
  });
});
