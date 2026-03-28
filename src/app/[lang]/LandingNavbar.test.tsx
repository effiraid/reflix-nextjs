import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingNavbar } from "./LandingNavbar";

const defaultProps = {
  lang: "ko" as const,
  dict: { navCta: "탐색하기" },
  navDict: { browse: "둘러보기" },
  authDict: { signIn: "로그인", account: "계정" },
  pricingDict: { title: "요금제" },
};

describe("LandingNavbar", () => {
  it("smoothly scrolls to the pricing section when the desktop pricing link is clicked", () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(document, "getElementById").mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    render(<LandingNavbar {...defaultProps} />);

    const pricingLinks = screen.getAllByRole("link", { name: "요금제" });
    // Desktop pricing link has the "hidden md:flex" class
    const desktopPricing = pricingLinks.find((el) => el.className.includes("hidden"));
    expect(desktopPricing).toBeDefined();
    expect(desktopPricing!).toHaveAttribute("href", "#pricing");

    fireEvent.click(desktopPricing!);

    expect(document.getElementById).toHaveBeenCalledWith("pricing");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("keeps auth text links hidden on mobile so only the CTA and hamburger stay visible", () => {
    render(<LandingNavbar {...defaultProps} />);

    const signInLinks = screen.getAllByRole("link", { name: "로그인" });
    // Desktop login link should have hidden class
    const desktopLink = signInLinks.find((el) => el.className.includes("hidden"));
    expect(desktopLink).toBeDefined();
  });

  it("renders a hamburger button for mobile menu", () => {
    render(<LandingNavbar {...defaultProps} />);

    const hamburger = screen.getByRole("button", { name: "메뉴 열기" });
    expect(hamburger).toBeDefined();
  });

  it("opens the bottom sheet when hamburger is clicked", () => {
    render(<LandingNavbar {...defaultProps} />);

    const hamburger = screen.getByRole("button", { name: "메뉴 열기" });
    fireEvent.click(hamburger);

    const sheet = screen.getByRole("dialog", { name: "메뉴" });
    expect(sheet.style.transform).toBe("translateY(0)");
  });

  it("closes the bottom sheet on ESC key", () => {
    render(<LandingNavbar {...defaultProps} />);

    const hamburger = screen.getByRole("button", { name: "메뉴 열기" });
    fireEvent.click(hamburger);

    const sheet = screen.getByRole("dialog", { name: "메뉴" });
    expect(sheet.style.transform).toBe("translateY(0)");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(sheet.style.transform).toBe("translateY(100%)");
  });

  it("closes the sheet then scrolls when pricing is tapped in the sheet", () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    vi.spyOn(document, "getElementById").mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    render(<LandingNavbar {...defaultProps} />);

    // Open sheet
    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));

    // Find pricing link inside the sheet (dialog)
    const sheet = screen.getByRole("dialog", { name: "메뉴" });
    const sheetPricing = sheet.querySelector('a[href="#pricing"]') as HTMLElement;
    expect(sheetPricing).not.toBeNull();

    fireEvent.click(sheetPricing);

    // Sheet should close immediately
    expect(sheet.style.transform).toBe("translateY(100%)");

    // Scroll fires after 250ms delay
    vi.advanceTimersByTime(250);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });

    vi.useRealTimers();
  });
});
