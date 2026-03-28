import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingPricing } from "./LandingPricing";

const dict = {
  pricingTitle: "요금제",
  pricingSub: "무료로 시작.\n필요하면 Pro로.",
  pricingFreeName: "Free",
  pricingFreePrice: "₩0",
  pricingFreePeriod: "",
  pricingFreeDesc: "가입 없이 바로 시작",
  pricingFreeHighlights: "원본 영상 재생,탐색 결과 5개,보드 1개,태그 검색",
  pricingFreeCta: "무료로 시작",
  pricingProName: "Pro",
  pricingProPrice: "₩9,900",
  pricingProPeriod: "/월",
  pricingProDesc: "전체 라이브러리, AI 분석, 무제한",
  pricingProHighlights: "전체 결과 보기,다중 필터,무제한 보드,AI 검색",
  pricingProCta: "Pro 시작하기",
  pricingProBadge: "추천",
  pricingToggleMonthly: "월간",
  pricingToggleYearly: "연간",
  pricingYearlyBadge: "2개월 무료",
  pricingProPriceYearly: "₩99,000",
  pricingProPeriodYearly: "/년",
  pricingProPriceYearlyMonthly: "월 ₩8,250",
};

describe("LandingPricing", () => {
  it("exposes the pricing section as an in-page anchor below the fixed navbar", () => {
    const { container } = render(<LandingPricing lang="ko" dict={dict} />);

    expect(container.querySelector("section")).toHaveAttribute("id", "pricing");
    expect(container.querySelector("section")).toHaveStyle({
      scrollMarginTop: "72px",
    });
  });

  it("tones down the discount capsule slightly after switching to yearly", () => {
    render(<LandingPricing lang="ko" dict={dict} />);

    const yearlyButton = screen.getByRole("button", { name: /연간/ });
    fireEvent.click(yearlyButton);

    const discountCapsule = within(yearlyButton).getByText("-17%");
    expect(discountCapsule).toBeInTheDocument();
    expect(discountCapsule).toHaveClass("py-1");
    expect(discountCapsule).toHaveClass("bg-green-500/15");
    expect(discountCapsule).toHaveClass("dark:text-green-700");
  });
});
