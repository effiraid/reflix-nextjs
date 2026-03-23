import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SubToolbar } from "./SubToolbar";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";

const updateURL = vi.fn((updates: Partial<ReturnType<typeof useFilterStore.getState>>) => {
  useFilterStore.setState((state) => ({ ...state, ...updates }));
});

vi.mock("@/hooks/useFilterSync", () => ({
  useFilterSync: () => ({
    updateURL,
  }),
}));

const dict = {
  nav: {
    search: "검색",
    searchPlaceholder: "태그, 카테고리, 키워드 검색...",
  },
  browse: {
    random: "무작위",
  },
  clip: {
    tags: "태그",
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
      category: null,
      selectedFolders: [],
      selectedTags: [],
      searchQuery: "",
      sortBy: "newest",
      starFilter: null,
    });
    updateURL.mockClear();
  });

  it("does not render the random label in the top toolbar", () => {
    render(<SubToolbar lang="ko" dict={dict} />);

    expect(screen.queryByText("무작위")).not.toBeInTheDocument();
  });

  it("increments the shuffle seed when the shuffle icon is clicked", () => {
    render(<SubToolbar lang="ko" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "무작위로 섞기" }));

    expect(useUIStore.getState().shuffleSeed).toBe(1);
  });

  it("extends the zoom control to the new 1-column terminal state", () => {
    useUIStore.setState({
      thumbnailSize: 3,
    });

    render(<SubToolbar lang="ko" dict={dict} />);

    const slider = screen.getByRole("slider");
    const buttons = screen.getAllByRole("button");
    const plusButton = buttons[1];

    expect(slider).toHaveAttribute("max", "4");

    fireEvent.click(plusButton);

    expect(useUIStore.getState().thumbnailSize).toBe(4);
  });

  it("writes the search query into the filter store via URL sync", () => {
    render(<SubToolbar lang="ko" dict={dict} />);

    fireEvent.change(screen.getByRole("textbox", { name: "검색" }), {
      target: { value: "sword" },
    });

    expect(useFilterStore.getState().searchQuery).toBe("sword");
  });
});
