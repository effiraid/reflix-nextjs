import type { Locale } from "@/lib/types";
import type { ViewerTier } from "@/lib/accessPolicy";

interface FolderIndexedRecord {
  id: string;
  folders: string[];
}

function buildInitialFolderClipIds(
  filterIndex: FolderIndexedRecord[] | null
): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  for (const record of filterIndex ?? []) {
    for (const folderId of record.folders) {
      if (!map[folderId]) {
        map[folderId] = [];
      }
      map[folderId].push(record.id);
    }
  }

  return map;
}

interface LoadBrowsePageDataOptions {
  lang: Locale;
  shouldLoadDetailedIndex: boolean;
  shouldLoadFilterIndex?: boolean;
  viewerTier: ViewerTier;
}

interface LoadBrowsePageDataDeps<
  TDict,
  TCategories,
  TTagGroups,
  TTagI18n,
  TBrowseCards extends unknown[],
  TBrowseFilterIndex extends FolderIndexedRecord[],
> {
  getDictionary: (lang: Locale) => Promise<TDict>;
  getCategories: () => Promise<TCategories>;
  getTagGroups: () => Promise<TTagGroups>;
  getTagI18n: () => Promise<TTagI18n>;
  loadBrowseCards: () => Promise<TBrowseCards>;
  loadBrowseSummary?: () => Promise<unknown>;
  loadBrowseFilterIndex: () => Promise<TBrowseFilterIndex>;
}

export async function loadBrowsePageData<
  TDict,
  TCategories,
  TTagGroups,
  TTagI18n,
  TBrowseCards extends unknown[],
  TBrowseFilterIndex extends FolderIndexedRecord[],
>(
  {
    lang,
    shouldLoadDetailedIndex,
    shouldLoadFilterIndex = true,
    viewerTier,
  }: LoadBrowsePageDataOptions,
  deps: LoadBrowsePageDataDeps<
    TDict,
    TCategories,
    TTagGroups,
    TTagI18n,
    TBrowseCards,
    TBrowseFilterIndex
  >
) {
  const browseFilterIndexPromise = shouldLoadFilterIndex
    ? deps.loadBrowseFilterIndex()
    : Promise.resolve(null);
  const [dict, categories, tagGroups, tagI18n, browseCards, browseFilterIndex] =
    await Promise.all([
      deps.getDictionary(lang),
      deps.getCategories(),
      deps.getTagGroups(),
      deps.getTagI18n(),
      deps.loadBrowseCards(),
      browseFilterIndexPromise,
    ]);

  return {
    dict,
    categories,
    tagGroups,
    tagI18n,
    browseCards,
    browseFilterIndex: shouldLoadDetailedIndex ? browseFilterIndex : null,
    initialFolderClipIds: buildInitialFolderClipIds(browseFilterIndex),
  };
}
