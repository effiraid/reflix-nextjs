import { Suspense } from "react";
import { getDictionary } from "../dictionaries";
import { getClipIndex, getCategories, getTagGroups, getTagI18n } from "@/lib/data";
import { Navbar } from "@/components/layout/Navbar";
import { LeftPanel } from "@/components/layout/LeftPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import { BrowseClient } from "./BrowseClient";
import { LeftPanelContent } from "./LeftPanelContent";
import { FilterPanel } from "@/components/filter/FilterPanel";
import { SubToolbar } from "@/components/layout/SubToolbar";
import { RightPanelContent } from "@/components/layout/RightPanelContent";
import type { Locale } from "@/lib/types";

export default async function BrowsePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const [dict, clipIndex, categories, tagGroups, tagI18n] = await Promise.all([
    getDictionary(lang as Locale),
    getClipIndex(),
    getCategories(),
    getTagGroups(),
    getTagI18n(),
  ]);

  return (
    <div className="h-screen flex flex-col">
      <Suspense>
        <Navbar lang={lang as Locale} dict={dict} />
      </Suspense>
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel>
          <Suspense>
            <LeftPanelContent
              categories={categories}
              clips={clipIndex.clips}
              lang={lang as Locale}
              dict={dict}
            />
          </Suspense>
        </LeftPanel>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Suspense>
            <SubToolbar lang={lang as Locale} dict={dict} />
          </Suspense>
          <Suspense>
            <FilterPanel
              tagGroups={tagGroups}
              clips={clipIndex.clips}
              lang={lang as Locale}
              tagI18n={tagI18n}
              dict={dict}
            />
          </Suspense>
          <main className="flex-1 overflow-y-auto" data-masonry-scroll>
            <Suspense
              fallback={<div className="p-4">{dict.common.loading}</div>}
            >
              <BrowseClient
                initialClips={clipIndex.clips}
                categories={categories}
                tagI18n={tagI18n}
                dict={dict}
              />
            </Suspense>
          </main>
        </div>

        <RightPanel>
          <RightPanelContent
            categories={categories}
            lang={lang as Locale}
            dict={dict}
          />
        </RightPanel>
      </div>
    </div>
  );
}
