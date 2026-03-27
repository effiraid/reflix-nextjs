import { filterClips, type FilterState } from "./filter";
import type {
  BrowseProjectionRecord,
  BrowseSummaryRecord,
  CategoryTree,
  Locale,
  SortBy,
} from "./types";

interface ListBrowseResultsOptions {
  summary: BrowseSummaryRecord[];
  projection: BrowseProjectionRecord[];
  filters: FilterState;
  categories?: CategoryTree;
  tagI18n?: Record<string, string>;
  lang?: Locale;
  offset?: number;
  pageSize?: number;
}

interface BrowseResultsPage {
  items: BrowseSummaryRecord[];
  totalCount: number;
  nextOffset: number | null;
}

export function parseBrowsePageQuery(
  searchParams: URLSearchParams
): FilterState {
  const rawSort = searchParams.get("sort");
  const sortBy: SortBy =
    rawSort === "rating" || rawSort === "name" || rawSort === "newest"
      ? rawSort
      : "newest";
  const rawStar = searchParams.get("star");
  const parsedStar = rawStar ? Number(rawStar) : null;

  return {
    category: searchParams.get("category"),
    selectedFolders: searchParams.getAll("folder"),
    excludedFolders: searchParams.getAll("excludeFolder"),
    selectedTags: searchParams.getAll("tag"),
    excludedTags: searchParams.getAll("exclude"),
    starFilter:
      parsedStar !== null && Number.isFinite(parsedStar) ? parsedStar : null,
    searchQuery: searchParams.get("q") ?? "",
    sortBy,
    contentMode: null,
  };
}

export function listBrowseResults({
  summary,
  projection,
  filters,
  categories,
  tagI18n = {},
  lang = "ko",
  offset = 0,
  pageSize = 60,
}: ListBrowseResultsOptions): BrowseResultsPage {
  const summaryById = new Map(summary.map((record) => [record.id, record]));
  const filtered = filterClips(
    projection,
    filters,
    categories,
    tagI18n,
    lang
  );
  const page = filtered
    .slice(offset, offset + pageSize)
    .map((record) => summaryById.get(record.id))
    .filter((record): record is BrowseSummaryRecord => Boolean(record));
  const nextOffset =
    offset + pageSize < filtered.length ? offset + pageSize : null;

  return {
    items: page,
    totalCount: filtered.length,
    nextOffset,
  };
}
