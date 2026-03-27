import type { Metadata } from "next";
import { getDictionary } from "./dictionaries";
import { getClipIndex, getTagGroups } from "@/lib/data";
import { LandingNavbar } from "./LandingNavbar";
import { LandingHero } from "./LandingHero";
import { LandingFeatures } from "./LandingFeatures";
import { LandingStats } from "./LandingStats";
import { LandingPricing } from "./LandingPricing";
import { LandingCTA } from "./LandingCTA";
import landingClips from "../../../config/landing-clips.json";
import type { Locale } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  return {
    title: "Reflix — " + dict.landing.heroTitle.replace("\n", " "),
    description: dict.landing.heroSub.replace("\n", " "),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const [dict, indexData, tagGroupData] = await Promise.all([
    getDictionary(lang as Locale),
    getClipIndex(),
    getTagGroups(),
  ]);

  const allClips = indexData.clips;

  const heroClips = landingClips.heroClipIds
    .map((id) => allClips.find((c) => c.id === id))
    .filter((c) => c != null);

  const featureClips = landingClips.featureClipIds
    .map((id) => allClips.find((c) => c.id === id))
    .filter((c) => c != null)
    .slice(0, 3);

  const clipCount = indexData.totalCount;
  const tagGroupCount = tagGroupData.groups.length;
  const tagCount = tagGroupData.groups.reduce(
    (sum, g) => sum + g.tags.length,
    0
  );

  const dividerStyle = {
    borderTop: "1px solid rgba(255,255,255,0.06)",
    margin: "0 48px",
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#08090a] text-white">
      <LandingNavbar
        lang={lang as Locale}
        dict={dict.landing}
        navDict={dict.nav}
        authDict={dict.auth}
        pricingDict={dict.pricing}
      />
      <LandingHero
        lang={lang as Locale}
        clips={heroClips}
        dict={dict.landing}
      />

      <div style={dividerStyle} />

      <LandingFeatures featureClips={featureClips} dict={dict.landing} />

      <div style={dividerStyle} />

      <LandingStats
        clipCount={clipCount}
        tagGroupCount={tagGroupCount}
        tagCount={tagCount}
        dict={dict.landing}
      />

      <div style={dividerStyle} />

      <LandingPricing lang={lang as Locale} dict={dict.landing} />

      <LandingCTA lang={lang as Locale} dict={dict.landing} />
    </div>
  );
}
