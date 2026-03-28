import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TagGroupList } from "./TagGroupList";
import { useUIStore } from "@/stores/uiStore";
import type { UseTagGroupsResult } from "@/hooks/useTagGroups";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const dict = { browse: koDict.browse } satisfies Pick<Dictionary, "browse">;

const tagData: UseTagGroupsResult = {
  mergedGroups: [
    { id: "emotion-joy", name: { ko: "기쁨", en: "Joy" }, parent: "emotion", color: "#22c55e", tags: ["기쁨", "웃음"] },
    { id: "emotion-sad", name: { ko: "슬픔", en: "Sadness" }, parent: "emotion", color: "#3b82f6", tags: ["슬픔"] },
    { id: "weapon-sword", name: { ko: "검", en: "Sword" }, parent: "weapon", tags: ["검", "대검"] },
  ],
  mergedParentGroups: [
    { id: "emotion", name: { ko: "감정", en: "Emotion" }, children: ["emotion-joy", "emotion-sad"] },
    { id: "weapon", name: { ko: "무기", en: "Weapon" }, children: ["weapon-sword"] },
  ],
  tagCounts: { "기쁨": 5, "웃음": 3, "슬픔": 2, "검": 8, "대검": 4 },
  groupTagCounts: { "emotion-joy": 2, "emotion-sad": 1, "weapon-sword": 2 },
  totalTagCount: 5,
  ungroupedTags: ["미분류태그"],
  filteredGroups: [
    { id: "emotion-joy", name: { ko: "기쁨", en: "Joy" }, parent: "emotion", color: "#22c55e", tags: ["기쁨", "웃음"] },
    { id: "emotion-sad", name: { ko: "슬픔", en: "Sadness" }, parent: "emotion", color: "#3b82f6", tags: ["슬픔"] },
    { id: "weapon-sword", name: { ko: "검", en: "Sword" }, parent: "weapon", tags: ["검", "대검"] },
  ],
  matchTag: null,
  allTags: ["검", "기쁨", "대검", "슬픔", "웃음"],
};

describe("TagGroupList", () => {
  beforeEach(() => {
    useUIStore.setState({
      browseMode: "tags",
      selectedTagGroupId: null,
      tagSearchQuery: "",
    });
  });

  it("renders the back button and group list", () => {
    render(<TagGroupList tagData={tagData} lang="ko" dict={dict} />);
    expect(screen.getByText("폴더 보기")).toBeInTheDocument();
    expect(screen.getByText("모든 태그")).toBeInTheDocument();
    expect(screen.getByText("기쁨")).toBeInTheDocument();
    expect(screen.getByText("슬픔")).toBeInTheDocument();
    expect(screen.getByText("검")).toBeInTheDocument();
  });

  it("renders parent group headers", () => {
    render(<TagGroupList tagData={tagData} lang="ko" dict={dict} />);
    expect(screen.getByText("감정")).toBeInTheDocument();
    expect(screen.getByText("무기")).toBeInTheDocument();
  });

  it("renders ungrouped item when ungrouped tags exist", () => {
    render(<TagGroupList tagData={tagData} lang="ko" dict={dict} />);
    expect(screen.getByText("미분류")).toBeInTheDocument();
  });

  it("selects a group on click", () => {
    render(<TagGroupList tagData={tagData} lang="ko" dict={dict} />);
    fireEvent.click(screen.getByText("기쁨"));
    expect(useUIStore.getState().selectedTagGroupId).toBe("emotion-joy");
  });

  it("switches back to grid mode on back button click", () => {
    render(<TagGroupList tagData={tagData} lang="ko" dict={dict} />);
    fireEvent.click(screen.getByText("폴더 보기"));
    expect(useUIStore.getState().browseMode).toBe("grid");
  });

  it("renders group tag counts", () => {
    render(<TagGroupList tagData={tagData} lang="ko" dict={dict} />);
    expect(screen.getByText("5")).toBeInTheDocument(); // totalTagCount
  });

  it("renders search input", () => {
    render(<TagGroupList tagData={tagData} lang="ko" dict={dict} />);
    expect(screen.getByPlaceholderText("태그 검색...")).toBeInTheDocument();
  });
});
