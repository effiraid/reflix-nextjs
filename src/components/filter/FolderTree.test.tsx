import { Profiler } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FolderTree } from "./FolderTree";
import type { CategoryTree } from "@/lib/types";
import { useFilterStore } from "@/stores/filterStore";

const categories: CategoryTree = {
  movement: {
    slug: "movement",
    i18n: { ko: "이동", en: "Movement" },
    children: {
      walk: {
        slug: "walk",
        i18n: { ko: "걷기", en: "Walking" },
      },
    },
  },
};

const folderClipIds: Record<string, string[]> = {
  movement: ["clip1"],
};

describe("FolderTree", () => {
  beforeEach(() => {
    useFilterStore.setState({
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      category: null,
      contentMode: null,
    });
  });

  it("reports folder click modifier keys when clicking anywhere on the row", () => {
    const onFolderClick = vi.fn();
    const onFolderExpandToggle = vi.fn();

    render(
      <FolderTree
        categories={categories}
        folderClipIds={folderClipIds}
        lang="ko"
        expandedFolderIds={["movement"]}
        onFolderClick={onFolderClick}
        onFolderExpandToggle={onFolderExpandToggle}
      />
    );

    const folderLabel = screen.getByText("이동");
    const folderRow = folderLabel.parentElement;

    expect(folderRow).not.toBeNull();

    fireEvent.click(folderRow!, { metaKey: true, altKey: true });

    expect(onFolderClick).toHaveBeenCalledWith({
      folderId: "movement",
      metaKey: true,
      ctrlKey: false,
      altKey: true,
    });
  });

  it("does not re-render folder nodes when unrelated filter state changes", () => {
    const commits: string[] = [];

    render(
      <Profiler id="FolderTree" onRender={(_, phase) => commits.push(phase)}>
        <FolderTree
          categories={categories}
          folderClipIds={folderClipIds}
          lang="ko"
          expandedFolderIds={["movement"]}
          onFolderClick={vi.fn()}
          onFolderExpandToggle={vi.fn()}
        />
      </Profiler>
    );

    expect(commits).toEqual(["mount"]);

    act(() => {
      useFilterStore.setState({ searchQuery: "dash" });
    });

    expect(commits).toEqual(["mount"]);
  });
});
