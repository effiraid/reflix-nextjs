import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingNavbar } from "./LandingNavbar";

describe("LandingNavbar", () => {
  it("smoothly scrolls to the pricing section when the pricing navigation item is clicked", () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(document, "getElementById").mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    render(
      <LandingNavbar
        lang="ko"
        dict={{ navCta: "탐색하기" }}
        navDict={{ browse: "둘러보기" }}
        authDict={{ signIn: "로그인", account: "계정" }}
        pricingDict={{ title: "요금제" }}
      />
    );

    const pricingLink = screen.getByRole("link", { name: "요금제" });

    expect(pricingLink).toHaveAttribute("href", "#pricing");

    fireEvent.click(pricingLink);

    expect(document.getElementById).toHaveBeenCalledWith("pricing");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
  });
});
