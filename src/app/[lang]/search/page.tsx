import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { getCategories, getClipIndex, getTagI18n } from "@/lib/data";
import type { Locale } from "@/lib/types";
import { getDictionary } from "../dictionaries";
import { SearchPageClient } from "./SearchPageClient";

type SearchPageProps = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
  return (
    <Suspense>
      <SearchPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchPageContent({
  params,
  searchParams,
}: SearchPageProps) {
  const { lang } = await params;
  const locale = lang as Locale;
  const resolvedSearchParams = await searchParams;
  const queryValue = resolvedSearchParams.q;
  const query = Array.isArray(queryValue) ? queryValue[0] ?? "" : queryValue ?? "";
  const [dict, clipIndex, categories, tagI18n] = await Promise.all([
    getDictionary(locale),
    getClipIndex(),
    getCategories(),
    getTagI18n(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Suspense>
        <Navbar lang={locale} dict={dict} />
      </Suspense>
      <main className="mx-auto w-full max-w-7xl px-3 py-4">
        <SearchPageClient
          initialClips={clipIndex.clips}
          categories={categories}
          tagI18n={tagI18n}
          query={query}
          dict={dict}
        />
      </main>
    </div>
  );
}
