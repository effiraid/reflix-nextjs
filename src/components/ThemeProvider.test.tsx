import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider";

vi.mock("@/stores/uiStore", () => ({
  useUIStore: {
    persist: {
      rehydrate: vi.fn(),
    },
  },
}));

function ThemeConsumer({ children }: { children?: ReactNode }) {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <span>{theme}</span>
      <button type="button" onClick={() => setTheme("light")}>
        Light
      </button>
      {children}
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render inline script tags", () => {
    const { container } = render(
      <ThemeProvider>
        <div>child</div>
      </ThemeProvider>
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("applies the stored theme and updates the document when toggled", () => {
    localStorage.setItem("theme", "dark");

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.cookie).toContain("theme=dark");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(screen.getByText("light")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.cookie).toContain("theme=light");
  });
});
