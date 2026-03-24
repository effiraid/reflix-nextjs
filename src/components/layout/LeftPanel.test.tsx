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

    const panel = screen.getByText("content").closest("aside");

    expect(panel).toHaveClass("overflow-y-auto");
    expect(panel).toHaveClass("scrollbar-thin");
    expect(panel).not.toHaveClass("scrollbar-hidden");
  });
});
