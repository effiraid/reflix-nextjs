import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchSuggestions, getSuggestionCount } from "./SearchSuggestions";
import type { TagSuggestionItem } from "@/lib/tagSuggestions";

const noop = () => {};

function makeItem(overrides: Partial<TagSuggestionItem> & { tag: string }): TagSuggestionItem {
  return { count: 0, ...overrides };
}

describe("SearchSuggestions", () => {
  it("renders rich tag items with group color dot and count", () => {
    const items: TagSuggestionItem[] = [
      makeItem({ tag: "힘듦", groupColor: "#ef4444", count: 3, aliases: ["힘겨움"] }),
      makeItem({ tag: "호흡", groupColor: "#06b6d4", count: 4 }),
    ];

    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={[]}
        matchedTags={items}
        query="힘"
        highlightIndex={null}
        onSelect={noop}
        onClearRecent={noop}
        onRemoveRecent={noop}
      />
    );

    expect(screen.getByText("힘듦")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("힘겨움 포함")).toBeInTheDocument();
    expect(screen.getByText("호흡")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows empty state when query present but no matches", () => {
    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={[]}
        matchedTags={[]}
        query="없는쿼리"
        highlightIndex={null}
        onSelect={noop}
        onClearRecent={noop}
        onRemoveRecent={noop}
      />
    );

    expect(screen.getByText(/없는쿼리.*일치하는 태그 없음/)).toBeInTheDocument();
  });

  it("hides popular tags when query is present", () => {
    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={["인기태그"]}
        matchedTags={[makeItem({ tag: "힘듦", count: 1 })]}
        query="힘"
        highlightIndex={null}
        onSelect={noop}
        onClearRecent={noop}
        onRemoveRecent={noop}
      />
    );

    expect(screen.queryByText("인기태그")).not.toBeInTheDocument();
  });

  it("calls onSelect with tag string when clicked", () => {
    const onSelect = vi.fn();
    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={[]}
        matchedTags={[makeItem({ tag: "달리기", count: 5 })]}
        query="달"
        highlightIndex={null}
        onSelect={onSelect}
        onClearRecent={noop}
        onRemoveRecent={noop}
      />
    );

    fireEvent.click(screen.getByText("달리기"));
    expect(onSelect).toHaveBeenCalledWith("달리기");
  });

  it("uses 추천 태그 label by default", () => {
    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={["태그A"]}
        matchedTags={[]}
        query=""
        highlightIndex={null}
        onSelect={noop}
        onClearRecent={noop}
        onRemoveRecent={noop}
      />
    );

    expect(screen.getByText("추천 태그")).toBeInTheDocument();
  });

  it("renders aria-label on tag items", () => {
    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={[]}
        matchedTags={[makeItem({ tag: "호흡", count: 4 })]}
        query="호"
        highlightIndex={null}
        onSelect={noop}
        onClearRecent={noop}
        onRemoveRecent={noop}
      />
    );

    expect(screen.getByRole("option", { name: "호흡 - 4개 클립" })).toBeInTheDocument();
  });

  it("localizes the empty state and aria labels in English", () => {
    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={[]}
        matchedTags={[makeItem({ tag: "Breath", count: 4, aliases: ["Respiration"] })]}
        query="unknown"
        highlightIndex={null}
        onSelect={noop}
        onClearRecent={noop}
        onRemoveRecent={noop}
        lang="en"
      />
    );

    expect(screen.getByRole("option", { name: "Breath - 4 clips" })).toBeInTheDocument();
  });

  it("renders the English no-match copy when lang is en", () => {
    render(
      <SearchSuggestions
        recentSearches={[]}
        popularTags={[]}
        matchedTags={[]}
        query="unknown"
        highlightIndex={null}
        onSelect={noop}
        onClearRecent={noop}
        onRemoveRecent={noop}
        lang="en"
      />
    );

    expect(screen.getByText("No tags match 'unknown'")).toBeInTheDocument();
  });
});

describe("getSuggestionCount", () => {
  it("returns matchedTags length when there is a query", () => {
    const items: TagSuggestionItem[] = [
      makeItem({ tag: "a", count: 1 }),
      makeItem({ tag: "b", count: 2 }),
    ];
    expect(getSuggestionCount(["recent"], ["pop"], items, "test")).toBe(2);
  });

  it("returns recent + popular count when no query", () => {
    expect(getSuggestionCount(["a", "b"], ["c"], [], "")).toBe(3);
  });
});
