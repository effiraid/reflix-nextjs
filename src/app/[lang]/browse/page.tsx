import { Suspense } from "react";
import { getDictionary } from "../dictionaries";
import { getClipIndex, getCategories, getTagGroups } from "@/lib/data";
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
  const [dict, clipIndex, categories, tagGroups] = await Promise.all([
    getDictionary(lang as Locale),
    getClipIndex(),
    getCategories(),
    getTagGroups(),
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
          <SubToolbar />
          <Suspense>
            <FilterPanel tagGroups={tagGroups} clips={clipIndex.clips} lang={lang as Locale} />
          </Suspense>
          <main className="flex-1 overflow-y-auto" data-masonry-scroll>
            <Suspense
              fallback={<div className="p-4">{dict.common.loading}</div>}
            >
              <BrowseClient
                initialClips={clipIndex.clips}
                categories={categories}
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
