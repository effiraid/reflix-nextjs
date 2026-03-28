import { Suspense } from "react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { ClipDetailView } from "@/components/clip/ClipDetailView";
import { Navbar } from "@/components/layout/Navbar";
import {
  getClip,
  getCategories,
  getDeploymentOrigin,
  getTagI18n,
} from "@/lib/data";
import type { Locale } from "@/lib/types";
import { getDictionary } from "../../dictionaries";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reflix.dev";

type ClipDetailPageProps = {
  params: Promise<{ lang: string; id: string }>;
};

async function getCachedClip(id: string) {
  "use cache";

  cacheLife("hours");
  return getClip(id);
}

export async function generateMetadata({
  params,
}: ClipDetailPageProps): Promise<Metadata> {
  const { lang, id } = await params;
  const clip = await getCachedClip(id);

  if (!clip) {
    return {
      title: "Clip Not Found | Reflix",
    };
  }

  const locale = lang as Locale;
  const title = clip.i18n.title[locale] || clip.name;
  const description =
    clip.aiTags?.description[locale] ||
    clip.aiTags?.description.ko ||
    `${clip.category} · ${clip.tags.join(", ")}`;

  const origin = getDeploymentOrigin() ?? BASE_URL;
  const thumbnailUrl = clip.thumbnailUrl.startsWith("http")
    ? clip.thumbnailUrl
    : `${origin}${clip.thumbnailUrl}`;

  return {
    title: `${title} | Reflix`,
    description,
    openGraph: {
      title,
      description,
      url: `${origin}/${locale}/clip/${id}`,
      siteName: "Reflix",
      type: "video.other",
      images: [{ url: thumbnailUrl, width: clip.width, height: clip.height }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [thumbnailUrl],
    },
  };
}

export default async function ClipDetailPage({ params }: ClipDetailPageProps) {
  return (
    <Suspense>
      <ClipDetailPageContent params={params} />
    </Suspense>
  );
}

function toISO8601Duration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `PT${m}M${rem}S` : `PT${rem}S`;
}

async function ClipDetailPageContent({ params }: ClipDetailPageProps) {
  const { lang, id } = await params;
  const locale = lang as Locale;
  const [clip, dict, categories, tagI18n] = await Promise.all([
    getCachedClip(id),
    getDictionary(locale),
    getCategories(),
    getTagI18n(),
  ]);

  if (!clip) {
    notFound();
  }

  const clipTitle = clip.i18n.title[locale] || clip.name;
  const clipDescription =
    clip.aiTags?.description[locale] ||
    clip.aiTags?.description.ko ||
    `${clip.category} · ${clip.tags.join(", ")}`;

  const origin = getDeploymentOrigin() ?? BASE_URL;
  const thumbnailUrl = clip.thumbnailUrl.startsWith("http")
    ? clip.thumbnailUrl
    : `${origin}${clip.thumbnailUrl}`;
  const videoUrl = clip.videoUrl.startsWith("http")
    ? clip.videoUrl
    : `${origin}${clip.videoUrl}`;

  const keywords = [
    ...(clip.aiTags?.actionType ?? []),
    ...(clip.aiTags?.emotion ?? []),
    ...(clip.aiTags?.effects ?? []),
    ...clip.tags,
  ];

  const videoObjectLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: clipTitle,
    description: clipDescription,
    thumbnailUrl,
    contentUrl: videoUrl,
    duration: toISO8601Duration(clip.duration),
    uploadDate: new Date(clip.btime).toISOString(),
    width: clip.width,
    height: clip.height,
    ...(keywords.length > 0 && { keywords: keywords.join(", ") }),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: locale === "ko" ? "홈" : "Home",
        item: `${origin}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: locale === "ko" ? "탐색" : "Browse",
        item: `${origin}/${locale}/browse`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: clipTitle,
        item: `${origin}/${locale}/clip/${id}`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoObjectLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <Suspense>
        <Navbar lang={locale} dict={dict} />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <ClipDetailView
          clip={clip}
          lang={locale}
          dict={dict}
          categories={categories}
          tagI18n={tagI18n}
        />
      </main>
    </div>
  );
}
