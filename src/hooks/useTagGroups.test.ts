import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTagGroups } from "./useTagGroups";
import type { TagGroupData } from "@/lib/types";
import { useUIStore } from "@/stores/uiStore";

const mockClips = [
  {
    id: "c1",
    name: "Clip 1",
    tags: ["기쁨", "검"],
    folders: [],
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "",
    thumbnailUrl: "",
    lqipBase64: "",
  },
  {
    id: "c2",
    name: "Clip 2",
    tags: ["슬픔"],
    folders: [],
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "",
    thumbnailUrl: "",
    lqipBase64: "",
  },
];

vi.mock("@/app/[lang]/browse/ClipDataProvider", () => ({
  useClipData: () => mockClips,
}));

const tagGroups: TagGroupData = {
  groups: [
    { id: "emotion-joy", name: { ko: "기쁨", en: "Joy" }, parent: "emotion", color: "#22c55e", tags: ["기쁨", "웃음"] },
    { id: "emotion-sad", name: { ko: "슬픔", en: "Sadness" }, parent: "emotion", color: "#3b82f6", tags: ["슬픔"] },
    { id: "weapon-sword", name: { ko: "검", en: "Sword" }, parent: "weapon", tags: ["검", "대검"] },
  ],
  parentGroups: [
    { id: "emotion", name: { ko: "감정", en: "Emotion" }, children: ["emotion-joy", "emotion-sad"] },
    { id: "weapon", name: { ko: "무기", en: "Weapon" }, children: ["weapon-sword"] },
  ],
};

describe("useTagGroups", () => {
  beforeEach(() => {
    useUIStore.setState({ tagSearchQuery: "" });
  });

  it("merges tag groups correctly", () => {
    const { result } = renderHook(() => useTagGroups(tagGroups, "ko", {}));
    expect(result.current.mergedGroups.length).toBeGreaterThanOrEqual(3);
  });

  it("computes tag counts from clips", () => {
    const { result } = renderHook(() => useTagGroups(tagGroups, "ko", {}));
    expect(result.current.tagCounts["기쁨"]).toBe(1);
    expect(result.current.tagCounts["슬픔"]).toBe(1);
    expect(result.current.tagCounts["검"]).toBe(1);
  });

  it("computes group tag counts", () => {
    const { result } = renderHook(() => useTagGroups(tagGroups, "ko", {}));
    expect(result.current.groupTagCounts["emotion-joy"]).toBe(2);
    expect(result.current.groupTagCounts["emotion-sad"]).toBe(1);
  });

  it("computes total tag count", () => {
    const { result } = renderHook(() => useTagGroups(tagGroups, "ko", {}));
    // 기쁨, 웃음, 슬픔, 검, 대검 = 5
    expect(result.current.totalTagCount).toBe(5);
  });

  it("filters groups by search query", () => {
    useUIStore.setState({ tagSearchQuery: "기쁨" });
    const { result } = renderHook(() => useTagGroups(tagGroups, "ko", {}));
    expect(result.current.filteredGroups.length).toBe(1);
    expect(result.current.filteredGroups[0].id).toBe("emotion-joy");
  });

  it("returns empty filtered groups for unmatched search", () => {
    useUIStore.setState({ tagSearchQuery: "없는태그" });
    const { result } = renderHook(() => useTagGroups(tagGroups, "ko", {}));
    expect(result.current.filteredGroups.length).toBe(0);
    expect(result.current.totalTagCount).toBe(0);
  });

  it("returns all tags sorted", () => {
    const { result } = renderHook(() => useTagGroups(tagGroups, "ko", {}));
    expect(result.current.allTags).toContain("기쁨");
    expect(result.current.allTags).toContain("검");
    expect(result.current.allTags.length).toBe(5);
  });

  it("handles empty tag groups", () => {
    const empty: TagGroupData = { groups: [], parentGroups: [] };
    const { result } = renderHook(() => useTagGroups(empty, "ko", {}));
    expect(result.current.mergedGroups.length).toBe(0);
    expect(result.current.totalTagCount).toBe(0);
    expect(result.current.allTags.length).toBe(0);
  });
});
