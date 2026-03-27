import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingPricing } from "./LandingPricing";

const dict = {
  pricingTitle: "요금제",
  pricingSub: "무료로 시작.\n필요하면 Pro로.",
  pricingFreeName: "Free",
  pricingFreePrice: "₩0",
  pricingFreePeriod: "",
  pricingFreeDesc: "가입 없이 바로 시작",
  pricingFreeFeatures: "50 무료 클립,일 20회 조회,보드 1개,태그 검색",
  pricingFreeCta: "무료로 시작",
  pricingProName: "Pro",
  pricingProPrice: "₩9,900",
  pricingProPeriod: "/월",
  pricingProDesc: "전체 라이브러리, AI 분석, 무제한",
  pricingProFeatures: "전체 라이브러리,무제한 조회,무제한 보드,AI 분석,프레임 재생",
  pricingProCta: "Pro 시작하기",
  pricingProBadge: "추천",
  pricingToggleMonthly: "월간",
  pricingToggleYearly: "연간",
  pricingYearlyBadge: "2개월 무료",
  pricingProPriceYearly: "₩99,000",
  pricingProPeriodYearly: "/년",
  pricingProPriceYearlyMonthly: "월 ₩8,250",
};

describe("LandingPricing billing note", () => {
  it("keeps the yearly billing note slot reserved in monthly mode", () => {
    render(<LandingPricing lang="ko" dict={dict} />);

    const billingNote = screen.getByTestId("landing-pricing-pro-billing-note");

    expect(billingNote).toHaveTextContent("₩9,900");
    expect(billingNote).toHaveTextContent("월 ₩8,250");
    expect(billingNote).toHaveStyle({ visibility: "hidden" });

    fireEvent.click(screen.getByRole("button", { name: "연간" }));

    expect(billingNote).toHaveStyle({ visibility: "visible" });
  });
});
