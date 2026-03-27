import Link from "next/link";
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
  const freeFeatures = dict.pricingFreeFeatures.split(",");
  const proFeatures = dict.pricingProFeatures.split(",");

  return (
    <section className="px-6 py-20 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="text-[32px] font-bold text-white"
          style={{ letterSpacing: "-1px" }}
        >
          {dict.pricingTitle}
        </h2>
        <p className="mt-3 text-[15px] text-[#777]">{dict.pricingSub}</p>
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
            <p className="mt-2 text-[14px] text-[#777]">
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
                {dict.pricingProPrice}
              </span>
              {dict.pricingProPeriod && (
                <span className="text-[14px] text-[#777]">
                  {dict.pricingProPeriod}
                </span>
              )}
            </div>
            <p className="mt-2 text-[14px] text-[#777]">
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

          <Link
            href={`/${lang}/pricing`}
            className="mt-8 block rounded-full bg-white py-2.5 text-center text-[14px] font-medium text-black transition-opacity hover:opacity-80"
          >
            {dict.pricingProCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
