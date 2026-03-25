import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeftPanelContent } from "./LeftPanelContent";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import type { CategoryTree } from "@/lib/types";

const updateURL = vi.fn((updates: Partial<ReturnType<typeof useFilterStore.getState>>) => {
  useFilterStore.setState((state) => ({ ...state, ...updates }));
});

vi.mock("@/hooks/useFilterSync", () => ({
  useFilterSync: () => ({
    updateURL,
  }),
}));

vi.mock("./ClipDataProvider", () => ({
  useClipData: () => clips,
}));

const categories: CategoryTree = {
  movement: {
    slug: "movement",
    i18n: { ko: "이동", en: "Movement" },
    children: {
      walk: {
        slug: "walk",
        i18n: { ko: "걷기", en: "Walking" },
        children: {
          slowWalk: {
            slug: "walk",
            i18n: { ko: "천천히 걷기", en: "Slow Walking" },
          },
        },
      },
      run: {
        slug: "run",
        i18n: { ko: "달리기", en: "Running" },
      },
    },
  },
};

const clips = [
  {
    id: "clip-1",
    name: "Clip 1",
    tags: ["combat"],
    folders: ["movement"],
    star: 0,
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/preview.mp4",
    thumbnailUrl: "/thumb.jpg",
    lqipBase64: "",
  },
];

const dict = {
  browse: {
    all: "전체",
    recentlyUsed: "최근 사용",
    random: "무작위",
    allTags: "모든 태그",
    community: "커뮤니티",
    expandAllFolders: "폴더 전체 펼치기",
    collapseAllFolders: "폴더 전체 접기",
  },
  clip: {
    folders: "폴더",
  },
};

describe("LeftPanelContent", () => {
  beforeEach(() => {
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      searchQuery: "",
      sortBy: "newest",
      starFilter: null,
    });
    useUIStore.setState({
      filterBarOpen: false,
      activeFilterTab: null,
      shuffleSeed: 0,
    });
    updateURL.mockClear();
  });

  it("toggles the folder tree when the folder label is clicked", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    expect(
      screen.getByRole("button", { name: dict.browse.expandAllFolders })
    ).toBeInTheDocument();
    expect(screen.getByText("이동")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: dict.clip.folders }));
    expect(screen.queryByText("이동")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: dict.clip.folders }));
    expect(screen.getByText("이동")).toBeInTheDocument();
  });

  it("opens the tag filter panel when the all tags shortcut is clicked", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /모든 태그/ }));

    expect(useUIStore.getState().filterBarOpen).toBe(true);
    expect(useUIStore.getState().activeFilterTab).toBe("tags");
  });

  it("does not render the tag filter section", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    expect(screen.queryAllByPlaceholderText("태그 검색...")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "감정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "클래스" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "무기" })).not.toBeInTheDocument();
  });

  it("uses a shared background container for the folder section without a divider line", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    const headerButton = screen.getByRole("button", { name: dict.clip.folders });
    const section = headerButton.closest(".rounded-xl");

    expect(section).toHaveClass("rounded-xl");
    expect(section).toHaveClass("border");
    expect(section).toHaveClass("bg-surface/40");
    expect(section?.querySelector(".border-t")).toBeNull();
  });

  it("uses an icon chevron instead of a text triangle in the folder header", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    expect(screen.queryByText("▶")).not.toBeInTheDocument();
  });

  it("replaces the folder selection on a plain click", () => {
    useFilterStore.setState((state) => ({
      ...state,
      selectedFolders: ["run"],
    }));

    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    fireEvent.click(screen.getByText("이동").parentElement!);

    expect(useFilterStore.getState().selectedFolders).toEqual(["movement"]);
    expect(updateURL).toHaveBeenLastCalledWith({ selectedFolders: ["movement"] });
  });

  it("toggles additive selection on cmd and ctrl click", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    fireEvent.click(screen.getByText("이동").parentElement!);
    fireEvent.click(screen.getByText("걷기").parentElement!, { metaKey: true });

    expect(useFilterStore.getState().selectedFolders).toEqual(["movement", "walk"]);

    fireEvent.click(screen.getByText("걷기").parentElement!, { ctrlKey: true });

    expect(useFilterStore.getState().selectedFolders).toEqual(["movement"]);
  });

  it("toggles the entire tree on cmd and alt click", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    expect(screen.queryByText("천천히 걷기")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("이동").parentElement!, { metaKey: true, altKey: true });

    expect(screen.getByText("천천히 걷기")).toBeInTheDocument();
    expect(useFilterStore.getState().selectedFolders).toEqual([]);

    fireEvent.click(screen.getByText("이동").parentElement!, { ctrlKey: true, altKey: true });

    expect(screen.queryByText("걷기")).not.toBeInTheDocument();
    expect(screen.queryByText("달리기")).not.toBeInTheDocument();
    expect(useFilterStore.getState().selectedFolders).toEqual([]);
  });

  it("toggles the entire tree from the header action button and swaps the action label", () => {
    render(
      <LeftPanelContent
        categories={categories}

        lang="ko"
        dict={dict}
      />
    );

    const expandAllButton = screen.getByRole("button", {
      name: dict.browse.expandAllFolders,
    });

    expect(screen.queryByText("천천히 걷기")).not.toBeInTheDocument();

    fireEvent.click(expandAllButton);

    expect(screen.getByText("천천히 걷기")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: dict.browse.collapseAllFolders })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: dict.browse.collapseAllFolders })
    );

    expect(screen.queryByText("걷기")).not.toBeInTheDocument();
    expect(screen.queryByText("달리기")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: dict.browse.expandAllFolders })
    ).toBeInTheDocument();
  });
});
