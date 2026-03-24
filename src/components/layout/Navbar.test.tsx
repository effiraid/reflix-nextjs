import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Navbar } from "./Navbar";

const push = vi.fn();
const setTheme = vi.fn();
const setLeftPanelOpen = vi.fn();
const setRightPanelOpen = vi.fn();
let uiState = {
  leftPanelOpen: true,
  rightPanelOpen: true,
};

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ko/browse",
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("q=search"),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme,
  }),
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: () => ({
    ...uiState,
    setLeftPanelOpen,
    setRightPanelOpen,
  }),
}));

vi.mock("@/components/common/SearchBar", () => ({
  SearchBar: ({
    initialQuery,
    onSearch,
  }: {
    initialQuery: string;
    onSearch: (value: string) => void;
  }) => (
    <button type="button" onClick={() => onSearch(initialQuery || "boss fight")}>
      Search mock
    </button>
  ),
}));

const dict = {
  nav: {
    home: "홈",
    browse: "둘러보기",
    search: "검색",
    searchPlaceholder: "검색",
  },
};

describe("Navbar", () => {
  beforeEach(() => {
    push.mockReset();
    setTheme.mockReset();
    setLeftPanelOpen.mockReset();
    setRightPanelOpen.mockReset();
    uiState = {
      leftPanelOpen: true,
      rightPanelOpen: true,
    };
  });

  it("renders the theme toggle with an icon instead of unicode text", () => {
    render(<Navbar lang="ko" dict={dict} />);

    const themeButton = screen.getByRole("button", {
      name: "다크 테마로 전환",
    });
    const panelButton = screen.getByRole("button", {
      name: "좌우 사이드바 접기",
    });

    expect(themeButton.querySelector("svg")).toBeInTheDocument();
    expect(themeButton).not.toHaveTextContent("☾");
    expect(themeButton).not.toHaveTextContent("☀");
    expect(panelButton.querySelector("svg")).toBeInTheDocument();
  });

  it("collapses both side panels when the panels toggle is clicked", () => {
    render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(
      screen.getByRole("button", { name: "좌우 사이드바 접기" })
    );

    expect(setLeftPanelOpen).toHaveBeenCalledWith(false);
    expect(setRightPanelOpen).toHaveBeenCalledWith(false);
  });

  it("expands both side panels when both are closed", () => {
    uiState = {
      leftPanelOpen: false,
      rightPanelOpen: false,
    };

    render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(
      screen.getByRole("button", { name: "좌우 사이드바 펼치기" })
    );

    expect(setLeftPanelOpen).toHaveBeenCalledWith(true);
    expect(setRightPanelOpen).toHaveBeenCalledWith(true);
  });

  it("pushes the shared search route when the search bar submits", () => {
    render(<Navbar lang="ko" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "Search mock" }));

    expect(push).toHaveBeenCalledWith("/ko/browse?q=search");
  });

  it("uses a centered desktop search slot and right-aligned control group", () => {
    render(<Navbar lang="ko" dict={dict} />);

    const header = screen.getByRole("banner");
    const searchSlot = screen.getByTestId("navbar-search");
    const controls = screen.getByTestId("navbar-controls");

    expect(header.className).toContain("grid");
    expect(header.className).toContain(
      "md:grid-cols-[minmax(0,1fr)_minmax(16rem,32rem)_minmax(0,1fr)]"
    );
    expect(searchSlot.className).toContain("md:justify-self-center");
    expect(controls.className).toContain("justify-self-end");
  });
});
