import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TagDetailView } from "./TagDetailView";
import { useUIStore } from "@/stores/uiStore";
import { useFilterStore } from "@/stores/filterStore";
import type { UseTagGroupsResult } from "@/hooks/useTagGroups";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const updateURL = vi.fn((updates: Partial<ReturnType<typeof useFilterStore.getState>>) => {
  useFilterStore.setState((state) => ({ ...state, ...updates }));
});

vi.mock("@/hooks/useFilterSync", () => ({
  useFilterSync: () => ({ updateURL }),
}));

const dict = { browse: koDict.browse } satisfies Pick<Dictionary, "browse">;

const tagData: UseTagGroupsResult = {
  mergedGroups: [
    { id: "emotion-joy", name: { ko: "기쁨", en: "Joy" }, parent: "emotion", color: "#22c55e", tags: ["기쁨", "웃음"] },
    { id: "emotion-sad", name: { ko: "슬픔", en: "Sadness" }, parent: "emotion", color: "#3b82f6", tags: ["슬픔"] },
  ],
  mergedParentGroups: [
    { id: "emotion", name: { ko: "감정", en: "Emotion" }, children: ["emotion-joy", "emotion-sad"] },
  ],
  tagCounts: { "기쁨": 5, "웃음": 3, "슬픔": 2 },
  groupTagCounts: { "emotion-joy": 2, "emotion-sad": 1 },
  totalTagCount: 3,
  ungroupedTags: ["외톨이"],
  filteredGroups: [
    { id: "emotion-joy", name: { ko: "기쁨", en: "Joy" }, parent: "emotion", color: "#22c55e", tags: ["기쁨", "웃음"] },
    { id: "emotion-sad", name: { ko: "슬픔", en: "Sadness" }, parent: "emotion", color: "#3b82f6", tags: ["슬픔"] },
  ],
  matchTag: null,
  allTags: ["기쁨", "슬픔", "웃음"],
};

describe("TagDetailView", () => {
  beforeEach(() => {
    useUIStore.setState({
      browseMode: "tags",
      selectedTagGroupId: null,
      tagSearchQuery: "",
    });
    useFilterStore.setState({
      selectedTags: [],
      excludedTags: [],
    });
    updateURL.mockClear();
  });

  it("renders all-tags view when no group is selected", () => {
    render(<TagDetailView tagData={tagData} lang="ko" tagI18n={{}} dict={dict} />);
    expect(screen.getAllByText(/모든 태그/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("(3)")).toBeInTheDocument();
    // tags rendered inside sections
    expect(screen.getAllByText("기쁨").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("슬픔").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a single group view when a group is selected", () => {
    useUIStore.setState({ selectedTagGroupId: "emotion-joy" });
    render(<TagDetailView tagData={tagData} lang="ko" tagI18n={{}} dict={dict} />);
    // "기쁨" appears both in header and tag list
    expect(screen.getAllByText("기쁨").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("웃음")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("shows breadcrumb in single group mode", () => {
    useUIStore.setState({ selectedTagGroupId: "emotion-joy" });
    render(<TagDetailView tagData={tagData} lang="ko" tagI18n={{}} dict={dict} />);
    expect(screen.getAllByText("모든 태그").length).toBeGreaterThanOrEqual(1);
  });

  it("switches back to grid mode and adds tag to filter when a tag is clicked", () => {
    useUIStore.setState({ selectedTagGroupId: "emotion-joy" });
    render(<TagDetailView tagData={tagData} lang="ko" tagI18n={{}} dict={dict} />);

    fireEvent.click(screen.getByText("웃음"));

    expect(updateURL).toHaveBeenCalledWith({ selectedTags: ["웃음"] });
    expect(useUIStore.getState().browseMode).toBe("grid");
  });

  it("shows empty state when group has no tags", () => {
    const emptyTagData: UseTagGroupsResult = {
      ...tagData,
      mergedGroups: [
        { id: "empty-group", name: { ko: "빈그룹", en: "Empty" }, parent: "emotion", tags: [] },
      ],
      filteredGroups: [
        { id: "empty-group", name: { ko: "빈그룹", en: "Empty" }, parent: "emotion", tags: [] },
      ],
    };
    useUIStore.setState({ selectedTagGroupId: "empty-group" });
    render(<TagDetailView tagData={emptyTagData} lang="ko" tagI18n={{}} dict={dict} />);
    expect(screen.getByText("이 그룹에 태그가 없습니다")).toBeInTheDocument();
  });

  it("shows search empty state when search yields no results", () => {
    const emptySearchData: UseTagGroupsResult = {
      ...tagData,
      filteredGroups: [],
    };
    useUIStore.setState({ tagSearchQuery: "없는태그" });
    render(<TagDetailView tagData={emptySearchData} lang="ko" tagI18n={{}} dict={dict} />);
    expect(screen.getByText(/없는태그/)).toBeInTheDocument();
  });

  it("renders ungrouped tags view", () => {
    useUIStore.setState({ selectedTagGroupId: "__ungrouped__" });
    render(<TagDetailView tagData={tagData} lang="ko" tagI18n={{}} dict={dict} />);
    expect(screen.getByText("외톨이")).toBeInTheDocument();
    // "미분류" may appear in breadcrumb and header
    expect(screen.getAllByText("미분류").length).toBeGreaterThanOrEqual(1);
  });
});
