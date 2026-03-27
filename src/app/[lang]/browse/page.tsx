import { Suspense, use } from "react";
import type { Metadata } from "next";
import { getDictionary } from "../dictionaries";
import {
  getCategories,
  getTagGroups,
  getTagI18n,
  loadBrowseProjection,
  loadBrowseSummary,
} from "@/lib/data";
import { Navbar } from "@/components/layout/Navbar";
import { LeftPanel } from "@/components/layout/LeftPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import { BrowseClient } from "./BrowseClient";
import { ClipDataProvider } from "./ClipDataProvider";
import { LeftPanelContent } from "./LeftPanelContent";
import { FilterPanel } from "@/components/filter/FilterPanel";
import { SubToolbar } from "@/components/layout/SubToolbar";
import { RightPanelContent } from "@/components/layout/RightPanelContent";
import type { Locale } from "@/lib/types";
import { listBrowseResults, parseBrowsePageQuery } from "@/lib/browse-service";
import { BrandSplash } from "@/components/splash/BrandSplash";

function toURLSearchParams(
  rawSearchParams: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (typeof value === "string") {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  return {
    title: `${dict.nav.browse} | Reflix`,
    description: dict.landing.heroSub,
  };
}

export default function BrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<BrandSplash persistent />}>
      {Promise.all([params, searchParams]).then(
        ([{ lang }, rawSearchParams]) => (
          <BrowsePageContent
            lang={lang as Locale}
            rawSearchParams={rawSearchParams}
          />
        )
      )}
    </Suspense>
  );
}

function BrowsePageContent({
  lang,
  rawSearchParams,
}: {
  lang: Locale;
  rawSearchParams: Record<string, string | string[] | undefined>;
}) {
  const [
    dict,
    categories,
    tagGroups,
    tagI18n,
    browseSummary,
    browseProjection,
  ] = use(
    Promise.all([
      getDictionary(lang as Locale),
      getCategories(),
      getTagGroups(),
      getTagI18n(),
      loadBrowseSummary(),
      loadBrowseProjection(),
    ])
  );

  return (
    <BrowsePageShell
      lang={lang}
      dict={dict}
      categories={categories}
      tagGroups={tagGroups}
      tagI18n={tagI18n}
      browseSummary={browseSummary}
      browseProjection={browseProjection}
      rawSearchParams={rawSearchParams}
    />
  );
}

export function BrowsePageShell({
  lang,
  dict,
  categories,
  tagGroups,
  tagI18n,
  browseSummary,
  browseProjection,
  rawSearchParams,
}: {
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
  tagGroups: Awaited<ReturnType<typeof getTagGroups>>;
  tagI18n: Awaited<ReturnType<typeof getTagI18n>>;
  browseSummary: Awaited<ReturnType<typeof loadBrowseSummary>>;
  browseProjection: Awaited<ReturnType<typeof loadBrowseProjection>>;
  rawSearchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseBrowsePageQuery(toURLSearchParams(rawSearchParams));
  const initialBrowseResults = listBrowseResults({
    summary: browseSummary,
    projection: browseProjection,
    filters,
    categories,
    tagI18n,
    lang,
  });

  return (
    <ClipDataProvider
      clips={initialBrowseResults.items}
      initialTotalCount={initialBrowseResults.totalCount}
      totalClipCount={browseSummary.length}
    >
      <div className="h-screen flex flex-col">
        <Suspense>
          <Navbar lang={lang} dict={dict} tagI18n={tagI18n} />
        </Suspense>
        <div className="flex-1 flex overflow-hidden">
          <LeftPanel>
            <Suspense>
              <LeftPanelContent
                categories={categories}
                lang={lang}
                dict={dict}
              />
            </Suspense>
          </LeftPanel>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="relative z-20 shrink-0">
              <Suspense>
                <SubToolbar
                  categories={categories}
                  lang={lang}
                  dict={dict}
                  tagI18n={tagI18n}
                />
              </Suspense>
              <Suspense>
                <FilterPanel
                  tagGroups={tagGroups}
                  lang={lang}
                  tagI18n={tagI18n}
                  dict={dict}
                />
              </Suspense>
            </div>
            <main className="flex-1 overflow-y-auto" data-masonry-scroll>
              <Suspense fallback={<div className="flex flex-1 items-center justify-center p-4"><span className="text-sm font-bold tracking-tight"><span className="text-brand">Ref</span><span className="text-foreground">lix</span></span></div>}>
                <BrowseClient
                  categories={categories}
                  tagI18n={tagI18n}
                  lang={lang}
                  dict={dict}
                />
              </Suspense>
            </main>
          </div>

          <RightPanel>
            <Suspense
              fallback={<div className="p-4 text-sm text-muted">{dict.common.loading}</div>}
            >
              <RightPanelContent
                categories={categories}
                lang={lang}
                dict={dict}
                tagI18n={tagI18n}
              />
            </Suspense>
          </RightPanel>
        </div>
      </div>
    </ClipDataProvider>
  );
}
