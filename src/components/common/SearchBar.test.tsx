import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
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
});
