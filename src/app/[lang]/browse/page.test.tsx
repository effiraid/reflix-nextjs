import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowsePageShell } from "./page";

const dict = {
  nav: {
    browse: "Browse",
    searchPlaceholder: "Search clips",
  },
  common: {
    loading: "로딩 중...",
  },
} as const;

vi.mock("../dictionaries", () => ({
  getDictionary: vi.fn(async () => dict),
}));

vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock("@/components/layout/LeftPanel", () => ({
  LeftPanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="left-panel">{children}</div>
  ),
}));

vi.mock("@/components/layout/RightPanel", () => ({
  RightPanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="right-panel">{children}</div>
  ),
}));

vi.mock("./BrowseClient", () => ({
  BrowseClient: () => <div>Browse Client</div>,
}));

vi.mock("./ClipDataProvider", () => ({
  ClipDataProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="clip-data-provider">{children}</div>
  ),
}));

vi.mock("./LeftPanelContent", () => ({
  LeftPanelContent: () => <div>Left Panel Content</div>,
}));

vi.mock("@/components/filter/FilterPanel", () => ({
  FilterPanel: () => <div>Filter Panel</div>,
}));

vi.mock("@/components/layout/SubToolbar", () => ({
  SubToolbar: () => <div>Sub Toolbar</div>,
}));

const pendingRightPanel = new Promise<never>(() => {});

vi.mock("@/components/layout/RightPanelContent", () => ({
  RightPanelContent: () => {
    throw pendingRightPanel;
  },
}));

describe("BrowsePage", () => {
  it("shows a Suspense fallback for the right panel when it blocks on navigation data", async () => {
    render(
      <BrowsePageShell
        lang="ko"
        dict={dict as never}
        categories={{}}
        tagGroups={{}}
        tagI18n={{}}
        browseSummary={[]}
        browseProjection={[]}
        rawSearchParams={{}}
      />
    );

    expect(screen.getByTestId("right-panel")).toBeInTheDocument();
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });
});
