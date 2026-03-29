import { Suspense, use } from "react";
import type { Metadata } from "next";
import { getDictionary } from "../dictionaries";
import {
  getCategories,
  getTagAliases,
  getTagGroups,
  getTagI18n,
  loadBrowseCards,
  loadBrowseFilterIndex,
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
import type { TagAliasConfig } from "@/lib/data";
import {
  listBrowseResults,
  parseBrowsePageQuery,
  requiresDetailedBrowseIndex,
} from "@/lib/browse-service";
import { BrandSplash } from "@/components/splash/BrandSplash";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadBrowsePageData } from "./browseBootstrap";

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

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reflix.dev";

async function loadInitialBoardClipIds(boardId: string | null) {
  if (!boardId) {
    return null;
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("board_clips")
    .select("clip_id")
    .eq("board_id", boardId);

  return new Set((data ?? []).map((row) => row.clip_id));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  const title = `${dict.nav.browse} | Reflix`;
  const description = dict.landing.heroSub;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${lang}/browse`,
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
  const filters = parseBrowsePageQuery(toURLSearchParams(rawSearchParams));
  const shouldLoadDetailedIndex = requiresDetailedBrowseIndex(filters);
  const [
    {
      dict,
      categories,
      tagGroups,
      tagI18n,
      browseCards,
      browseFilterIndex,
      initialFolderClipIds,
    },
    initialBoardClipIds,
    tagAliases,
  ] = use(
    Promise.all([
      loadBrowsePageData({
        lang,
        shouldLoadDetailedIndex,
      }, {
        getDictionary,
        getCategories,
        getTagGroups,
        getTagI18n,
        loadBrowseCards,
        loadBrowseFilterIndex,
      }),
      loadInitialBoardClipIds(filters.boardId),
      getTagAliases(),
    ])
  );

  return (
    <BrowsePageShell
      lang={lang}
      dict={dict}
      categories={categories}
      tagGroups={tagGroups}
      tagI18n={tagI18n}
      tagAliases={tagAliases}
      browseCards={browseCards}
      browseFilterIndex={browseFilterIndex}
      initialBoardClipIds={initialBoardClipIds}
      initialFolderClipIds={initialFolderClipIds}
      preloadDetailedIndex={shouldLoadDetailedIndex}
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
  tagAliases = null,
  browseCards,
  browseFilterIndex,
  initialBoardClipIds = null,
  initialFolderClipIds = {},
  preloadDetailedIndex = false,
  rawSearchParams,
}: {
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
  tagGroups: Awaited<ReturnType<typeof getTagGroups>>;
  tagI18n: Awaited<ReturnType<typeof getTagI18n>>;
  tagAliases?: TagAliasConfig | null;
  browseCards: Awaited<ReturnType<typeof loadBrowseCards>>;
  browseFilterIndex: Awaited<ReturnType<typeof loadBrowseFilterIndex>> | null;
  initialBoardClipIds?: Set<string> | null;
  initialFolderClipIds?: Record<string, string[]>;
  preloadDetailedIndex?: boolean;
  rawSearchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseBrowsePageQuery(toURLSearchParams(rawSearchParams));
  const initialBrowseResults = listBrowseResults({
    cards: browseCards,
    summary: browseCards,
    projection: browseFilterIndex ?? browseCards,
    filters,
    boardClipIds: initialBoardClipIds,
    categories,
    tagI18n,
    lang,
  });

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: lang === "ko" ? "애니메이션 레퍼런스 탐색" : "Browse Animation References",
    description:
      lang === "ko"
        ? "태그 기반 검색으로 게임 애니메이션 레퍼런스를 탐색하세요."
        : "Browse game animation references with tag-based search.",
    url: `${BASE_URL}/${lang}/browse`,
    isPartOf: { "@type": "WebSite", name: "Reflix", url: BASE_URL },
    numberOfItems: browseCards.length,
  };

  return (
    <ClipDataProvider
      clips={initialBrowseResults.items}
      initialTotalCount={initialBrowseResults.totalCount}
      totalClipCount={browseCards.length}
      preloadDetailedIndex={preloadDetailedIndex}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <div className="h-screen flex flex-col">
        <Suspense>
          <Navbar lang={lang} dict={dict} tagI18n={tagI18n} tagGroups={tagGroups} tagAliases={tagAliases} />
        </Suspense>
        <div className="flex-1 flex overflow-hidden">
          <LeftPanel>
            <Suspense>
              <LeftPanelContent
                categories={categories}
                tagGroups={tagGroups}
                tagI18n={tagI18n}
                initialFolderClipIds={initialFolderClipIds}
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
              tagGroups={tagGroups}
              tagI18n={tagI18n}
              lang={lang}
              dict={dict}
              initialBoardClipIds={initialBoardClipIds}
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
