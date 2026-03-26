import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SubToolbar } from "./SubToolbar";
import { useUIStore } from "@/stores/uiStore";

const dict = {
  clip: {
    tags: "태그",
  },
} as const;

describe("SubToolbar", () => {
  beforeEach(() => {
    useUIStore.setState({
      filterBarOpen: false,
      thumbnailSize: 2,
      activeFilterTab: null,
      shuffleSeed: 0,
    });
  });

  it("does not render the random label in the top toolbar", () => {
    render(<SubToolbar lang="ko" dict={dict} />);

    expect(screen.queryByText("무작위")).not.toBeInTheDocument();
  });

  it("increments the shuffle seed when the shuffle icon is clicked", () => {
    render(<SubToolbar lang="ko" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "무작위로 섞기" }));

    expect(useUIStore.getState().shuffleSeed).toBe(1);
  });

  it("extends the zoom control to the new 1-column terminal state", () => {
    useUIStore.setState({
      thumbnailSize: 3,
    });

    render(<SubToolbar lang="ko" dict={dict} />);

    const slider = screen.getByRole("slider");
    const plusButton = screen.getByRole("button", { name: "+" });

    expect(slider).toHaveAttribute("max", "4");

    fireEvent.click(plusButton);

    expect(useUIStore.getState().thumbnailSize).toBe(4);
  });

  it("does not render the inline search field in the top toolbar", () => {
    render(<SubToolbar lang="ko" dict={dict} />);

    expect(screen.queryByRole("textbox", { name: "검색" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "검색" })).not.toBeInTheDocument();
  });
});
