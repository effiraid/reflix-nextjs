import { Suspense } from "react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { ClipDetailView } from "@/components/clip/ClipDetailView";
import { Navbar } from "@/components/layout/Navbar";
import { getClip, getDeploymentOrigin } from "@/lib/data";
import type { Locale } from "@/lib/types";
import { getDictionary } from "../../dictionaries";

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
  const description = clip.annotation || clip.tags.join(", ");

  const origin = getDeploymentOrigin();
  const thumbnailUrl = clip.thumbnailUrl.startsWith("http")
    ? clip.thumbnailUrl
    : origin
      ? `${origin}${clip.thumbnailUrl}`
      : null;

  return {
    title: `${title} | Reflix`,
    description,
    openGraph: {
      title,
      description,
      images: thumbnailUrl
        ? [{ url: thumbnailUrl, width: clip.width, height: clip.height }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: thumbnailUrl ? [thumbnailUrl] : undefined,
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

async function ClipDetailPageContent({ params }: ClipDetailPageProps) {
  const { lang, id } = await params;
  const locale = lang as Locale;
  const [clip, dict] = await Promise.all([
    getCachedClip(id),
    getDictionary(locale),
  ]);

  if (!clip) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <Suspense>
        <Navbar lang={locale} dict={dict} />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <ClipDetailView clip={clip} lang={locale} dict={dict} />
      </main>
    </div>
  );
}
