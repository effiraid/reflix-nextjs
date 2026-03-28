import type { Metadata } from "next";
import { getDictionary } from "./dictionaries";
import { getClipIndex, getTagGroups, getTagI18n, loadLandingStats } from "@/lib/data";
import { getStructuredAiTags } from "@/lib/aiTags";
import { LandingNavbar } from "./LandingNavbar";
import { LandingHero } from "./LandingHero";
import { LandingFeatures } from "./LandingFeatures";
import { LandingStats } from "./LandingStats";
import { LandingPricing } from "./LandingPricing";
import { LandingCTA } from "./LandingCTA";
import landingClips from "../../../config/landing-clips.json";
import type { Locale } from "@/lib/types";

function getLandingAiRecommendationCount(clips: Awaited<ReturnType<typeof getClipIndex>>["clips"]) {
  const uniqueTags = new Set<string>();

  for (const clip of clips) {
    const tags = clip.aiStructuredTags ?? getStructuredAiTags(clip.aiTags);
    for (const tag of tags) {
      uniqueTags.add(tag);
    }
  }

  return uniqueTags.size;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reflix.dev";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  const title = "Reflix — " + dict.landing.heroTitle.replace("\n", " ");
  const description = dict.landing.heroSub.replace("\n", " ");
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${lang}`,
      siteName: "Reflix",
      type: "website",
      images: [{ url: `${BASE_URL}/og-default.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/og-default.png`],
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const [dict, indexData, tagGroupData, tagI18n, landingStats] = await Promise.all([
    getDictionary(lang as Locale),
    getClipIndex(),
    getTagGroups(),
    getTagI18n(),
    loadLandingStats(),
  ]);

  const allClips = indexData.clips;
  const clipMap = new Map(allClips.map((c) => [c.id, c]));

  const heroClips = landingClips.heroClipIds
    .map((id) => clipMap.get(id))
    .filter((c) => c != null);

  const featureClips = landingClips.featureClipIds
    .map((id) => clipMap.get(id))
    .filter((c) => c != null)
    .slice(0, 3);

  // Use pre-computed landing stats when available, fall back to computing from index
  const clipCount = landingStats?.totalClips ?? indexData.totalCount;
  const aiRecommendationCount = landingStats?.aiRecommendationCount ?? getLandingAiRecommendationCount(allClips);
  const tagCount = tagGroupData.groups.reduce(
    (sum, g) => sum + g.tags.length,
    0
  );

  const dividerStyle = {
    borderTop: "1px solid rgba(255,255,255,0.06)",
    margin: "0 48px",
  };

  return (
    <div className="dark min-h-screen overflow-hidden bg-[#08090a] text-white" style={{ colorScheme: "dark" }}>
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

      <LandingFeatures
        lang={lang as Locale}
        tagI18n={tagI18n}
        featureClips={featureClips}
        dict={dict.landing}
      />

      <div style={dividerStyle} />

      <LandingStats
        clipCount={clipCount}
        aiRecommendationCount={aiRecommendationCount}
        tagCount={tagCount}
        dict={dict.landing}
      />

      <div style={dividerStyle} />

      <LandingPricing lang={lang as Locale} dict={dict.landing} />

      <LandingCTA lang={lang as Locale} dict={dict.landing} />
    </div>
  );
}
