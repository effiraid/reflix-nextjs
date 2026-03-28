"use client";

import { useState } from "react";
import Link from "next/link";
import { useUIStore } from "@/stores/uiStore";
import type { Locale } from "@/lib/types";

interface LandingPricingProps {
  lang: Locale;
  dict: {
    pricingTitle: string;
    pricingSub: string;
    pricingFreeName: string;
    pricingFreePrice: string;
    pricingFreePeriod: string;
    pricingFreeDesc: string;
    pricingFreeFeatures: string;
    pricingFreeCta: string;
    pricingProName: string;
    pricingProPrice: string;
    pricingProPeriod: string;
    pricingProDesc: string;
    pricingProFeatures: string;
    pricingProCta: string;
    pricingProBadge: string;
    pricingToggleMonthly: string;
    pricingToggleYearly: string;
    pricingYearlyBadge: string;
    pricingProPriceYearly: string;
    pricingProPeriodYearly: string;
    pricingProPriceYearlyMonthly: string;
    [key: string]: string;
  };
}

function CheckIcon() {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: 15,
        height: 15,
        background: "#333",
      }}
    >
      <svg
        width="9"
        height="7"
        viewBox="0 0 9 7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 3.5L3.5 6L8 1"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function LandingPricing({ lang, dict }: LandingPricingProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const { openPricingModal } = useUIStore();
  const isYearly = billingInterval === "yearly";
  const yearlyDiscountRate = "-17%";
  const yearlyDiscountCapsuleStyle = {
    background: "rgba(34,197,94,0.12)",
    color: "#22c55e",
  } as const;
  const yearlyDiscountCapsuleSelectedStyle = {
    background: "rgba(22,101,52,0.12)",
    color: "#166534",
  } as const;

  const freeFeatures = dict.pricingFreeFeatures.split(",");
  const proFeatures = dict.pricingProFeatures.split(",");

  const proPrice = isYearly
    ? dict.pricingProPriceYearly
    : dict.pricingProPrice;
  const proPeriod = isYearly
    ? dict.pricingProPeriodYearly
    : dict.pricingProPeriod;

  const yearlyBillingNote = (
    <>
      <span
        className="text-[#555]"
        style={{ textDecoration: "line-through" }}
      >
        {dict.pricingProPrice}
      </span>{" "}
      <span className="text-[#aaa]">{dict.pricingProPriceYearlyMonthly}</span>
    </>
  );

  return (
    <section
      id="pricing"
      className="px-6 py-20 md:py-24"
      style={{ scrollMarginTop: 72 }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="whitespace-pre-line text-[32px] font-bold text-white"
          style={{ letterSpacing: "-1px", wordBreak: "keep-all" }}
        >
          {dict.pricingTitle}
        </h2>
        <p
          className="mt-3 whitespace-pre-line text-[15px] text-[#777]"
          style={{ wordBreak: "keep-all" }}
        >
          {dict.pricingSub}
        </p>
      </div>

      {/* Billing toggle */}
      <div className="mx-auto mt-8 flex items-center justify-center">
        <div
          className="inline-flex rounded-full p-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-all"
            style={{
              background: !isYearly ? "white" : "transparent",
              color: !isYearly ? "black" : "#666",
            }}
          >
            {dict.pricingToggleMonthly}
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("yearly")}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all"
            style={{
              background: isYearly ? "white" : "transparent",
              color: isYearly ? "black" : "#666",
            }}
          >
            <span>{dict.pricingToggleYearly}</span>
            <span
              aria-hidden="true"
              className="whitespace-nowrap rounded-full px-1.5 py-1 text-[10px] font-semibold leading-none"
              style={
                isYearly
                  ? yearlyDiscountCapsuleSelectedStyle
                  : yearlyDiscountCapsuleStyle
              }
            >
              {yearlyDiscountRate}
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-2xl flex-col md:flex-row">
        {/* Free plan */}
        <div className="flex flex-1 flex-col p-8">
          <div>
            <h3 className="text-[24px] font-semibold text-white">
              {dict.pricingFreeName}
            </h3>
            <div className="mt-3">
              <span className="text-[36px] font-bold text-white">
                {dict.pricingFreePrice}
              </span>
              {dict.pricingFreePeriod && (
                <span className="text-[14px] text-[#777]">
                  {dict.pricingFreePeriod}
                </span>
              )}
            </div>
            <p
              className="mt-2 whitespace-pre-line text-[14px] text-[#777]"
              style={{ wordBreak: "keep-all" }}
            >
              {dict.pricingFreeDesc}
            </p>
          </div>

          <div
            className="my-6"
            style={{
              height: 1,
              background: "rgba(255,255,255,0.06)",
            }}
          />

          <ul className="flex flex-1 flex-col gap-3">
            {freeFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2.5 text-[14px] text-[#999]"
              >
                <CheckIcon />
                {feature}
              </li>
            ))}
          </ul>

          <Link
            href={`/${lang}/browse`}
            className="mt-8 block rounded-full py-2.5 text-center text-[14px] font-medium text-white transition-colors hover:bg-white/10"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {dict.pricingFreeCta}
          </Link>
        </div>

        {/* Center divider */}
        <div
          className="hidden md:block"
          style={{
            width: 1,
            background: "rgba(255,255,255,0.06)",
            marginTop: 32,
            marginBottom: 32,
          }}
        />
        <div
          className="md:hidden"
          style={{
            height: 1,
            background: "rgba(255,255,255,0.06)",
            marginLeft: 32,
            marginRight: 32,
          }}
        />

        {/* Pro plan */}
        <div className="flex flex-1 flex-col p-8">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[24px] font-semibold text-white">
                {dict.pricingProName}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{
                  background: "rgba(99,102,241,0.25)",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              >
                {dict.pricingProBadge}
              </span>
            </div>
            <div className="mt-3">
              <span className="text-[36px] font-bold text-white">
                {proPrice}
              </span>
              {proPeriod && (
                <span className="text-[14px] text-[#777]">{proPeriod}</span>
              )}
            </div>
            <p
              data-testid="landing-pricing-pro-billing-note"
              aria-hidden={!isYearly}
              className="mt-1 text-[13px] text-[#999]"
              style={{ visibility: isYearly ? "visible" : "hidden" }}
            >
              {yearlyBillingNote}
            </p>
            <p
              className="mt-2 whitespace-pre-line text-[14px] text-[#777]"
              style={{ wordBreak: "keep-all" }}
            >
              {dict.pricingProDesc}
            </p>
          </div>

          <div
            className="my-6"
            style={{
              height: 1,
              background: "rgba(255,255,255,0.06)",
            }}
          />

          <ul className="flex flex-1 flex-col gap-3">
            {proFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2.5 text-[14px] text-[#999]"
              >
                <CheckIcon />
                {feature}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={openPricingModal}
            className="mt-8 w-full rounded-full bg-white py-2.5 text-center text-[14px] font-medium text-black transition-opacity hover:opacity-80"
          >
            {dict.pricingProCta}
          </button>
        </div>
      </div>
    </section>
  );
}
