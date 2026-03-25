import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FolderTree } from "./FolderTree";
import type { CategoryTree } from "@/lib/types";

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

const folderCounts: Record<string, number> = {
  movement: 1,
};

describe("FolderTree", () => {
  it("reports folder click modifier keys when clicking anywhere on the row", () => {
    const onFolderClick = vi.fn();
    const onFolderExpandToggle = vi.fn();

    render(
      <FolderTree
        categories={categories}
        folderCounts={folderCounts}
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
});
