import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagFilterPanel } from "./TagFilterPanel";
import { useFilterStore } from "@/stores/filterStore";

const clips = [
  {
    id: "clip-1",
    name: "슬픈 걷기",
    tags: ["걷기"],
    folders: [],
    star: 0,
    category: "acting",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/previews/clip-1.mp4",
    thumbnailUrl: "/thumbs/clip-1.webp",
    lqipBase64: "",
    aiTags: {
      actionType: ["걷기"],
      emotion: ["슬픔"],
      composition: ["풀샷"],
      pacing: "느림",
      characterType: ["전사"],
      effects: ["잔상"],
      description: {
        ko: "슬픈 장면에서 천천히 걷는 모션",
        en: "A sad walk cycle",
      },
      model: "gemini-2.5-flash",
      generatedAt: "2026-03-26T00:00:00.000Z",
    },
  },
];

let projectionStatus: "loading" | "ready" | "error" = "ready";

vi.mock("@/app/[lang]/browse/ClipDataProvider", () => ({
  useClipData: () => clips,
  useBrowseData: () => ({
    projectionStatus,
  }),
}));

describe("TagFilterPanel", () => {
  beforeEach(() => {
    projectionStatus = "ready";
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

  it("appends AI-generated groups under a dedicated section", () => {
    render(
      <TagFilterPanel
        tagGroups={{
          groups: [],
          parentGroups: [],
        }}
        lang="ko"
        tagI18n={{}}
        dict={{
          browse: {
            tagSearchPlaceholder: "태그 검색",
            allTags: "모든 태그",
            noResults: "결과 없음",
          },
          clip: {
            tags: "태그",
          },
          common: {
            select: "선택",
            exclude: "제외",
            close: "닫기",
          },
        }}
        updateURL={vi.fn()}
      />
    );

    expect(screen.getByText("AI 생성")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /감정/ })).toBeInTheDocument();
    expect(screen.getByText("슬픔")).toBeInTheDocument();
  });

  it("shows a loading state while browse projection is still preparing", () => {
    projectionStatus = "loading";

    render(
      <TagFilterPanel
        tagGroups={{
          groups: [],
          parentGroups: [],
        }}
        lang="ko"
        tagI18n={{}}
        dict={{
          browse: {
            tagSearchPlaceholder: "태그 검색",
            allTags: "모든 태그",
            noResults: "결과 없음",
          },
          clip: {
            tags: "태그",
          },
          common: {
            select: "선택",
            exclude: "제외",
            close: "닫기",
            loading: "로딩 중...",
          },
        }}
        updateURL={vi.fn()}
      />
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });
});
