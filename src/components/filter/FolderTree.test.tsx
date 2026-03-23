import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FolderTree } from "./FolderTree";
import type { CategoryTree, ClipIndex } from "@/lib/types";

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

const clips: ClipIndex[] = [
  {
    id: "clip-1",
    name: "Clip 1",
    tags: [],
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

describe("FolderTree", () => {
  it("reports folder click modifier keys when clicking anywhere on the row", () => {
    const onFolderClick = vi.fn();
    const onFolderExpandToggle = vi.fn();

    render(
      <FolderTree
        categories={categories}
        clips={clips}
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
