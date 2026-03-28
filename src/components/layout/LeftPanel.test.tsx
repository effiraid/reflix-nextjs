import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeftPanel } from "./LeftPanel";
import { useUIStore } from "@/stores/uiStore";

describe("LeftPanel", () => {
  beforeEach(() => {
    useUIStore.setState((state) => ({
      ...state,
      leftPanelOpen: true,
    }));
  });

  it("uses the thin panel scrollbar style while keeping vertical scrolling available", () => {
    render(
      <LeftPanel>
        <div>content</div>
      </LeftPanel>
    );

    const content = screen.getByText("content");
    const scrollContainer = content.parentElement;

    expect(scrollContainer).toHaveClass("overflow-y-auto");
    expect(scrollContainer).toHaveClass("scrollbar-thin");
    expect(scrollContainer).not.toHaveClass("scrollbar-hidden");
  });
});
