import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders a leading search icon inside the field", () => {
    const { container } = render(
      <SearchBar
        initialQuery=""
        placeholder="Search clips"
        onSearch={vi.fn()}
      />
    );

    const form = container.querySelector("form");
    expect(form?.querySelector("svg")).toBeInTheDocument();
  });

  it("reflects the current query and emits updates on submit", () => {
    const onSearch = vi.fn();

    render(
      <SearchBar
        initialQuery="boss"
        placeholder="Search clips"
        onSearch={onSearch}
      />
    );

    const input = screen.getByRole("searchbox", { name: "Search clips" });
    expect(input).toHaveValue("boss");

    fireEvent.change(input, { target: { value: " final boss " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(onSearch).toHaveBeenCalledWith("final boss");
  });

  it("debounces change events before triggering search updates", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();

    render(
      <SearchBar
        initialQuery=""
        placeholder="Search clips"
        onSearch={onSearch}
      />
    );

    const input = screen.getByRole("searchbox", { name: "Search clips" });
    fireEvent.change(input, { target: { value: "sad" } });

    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(149);
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSearch).toHaveBeenCalledWith("sad");
  });

  it("shows a loading indicator and polite status text while searching", () => {
    render(
      <SearchBar
        initialQuery="sad"
        placeholder="Search clips"
        onSearch={vi.fn()}
        isSearching
        statusText="검색 준비 중..."
      />
    );

    expect(screen.getByTestId("search-spinner")).toBeInTheDocument();
    expect(screen.getByText("검색 준비 중...")).toHaveAttribute("aria-live", "polite");
  });

  it("updates the visible input when the initial query changes", () => {
    const { rerender } = render(
      <SearchBar initialQuery="alpha" placeholder="Search clips" onSearch={vi.fn()} />
    );

    rerender(
      <SearchBar initialQuery="beta" placeholder="Search clips" onSearch={vi.fn()} />
    );

    expect(
      screen.getByRole("searchbox", { name: "Search clips" })
    ).toHaveValue("beta");
  });

  it("calls onActivate when the input receives focus", () => {
    const onActivate = vi.fn();

    render(
      <SearchBar
        initialQuery=""
        placeholder="Search clips"
        onSearch={vi.fn()}
        onActivate={onActivate}
      />
    );

    fireEvent.focus(screen.getByRole("searchbox", { name: "Search clips" }));

    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
