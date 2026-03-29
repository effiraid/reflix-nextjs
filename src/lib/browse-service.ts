import { filterClips, type FilterState } from "./filter";
import type {
  BrowseCardRecord,
  BrowseFilterIndexRecord,
  BrowseProjectionRecord,
  BrowseSummaryRecord,
  CategoryTree,
  Locale,
  SortBy,
} from "./types";

type BrowseFilterableRecord =
  | BrowseProjectionRecord
  | BrowseFilterIndexRecord
  | BrowseSummaryRecord;

interface ListBrowseResultsOptions {
  cards?: BrowseCardRecord[];
  summary: BrowseSummaryRecord[];
  projection: BrowseFilterableRecord[];
  filters: FilterState;
  boardClipIds?: Set<string> | null;
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
    rawSort === "name" || rawSort === "newest"
      ? rawSort
      : "newest";

  return {
    category: searchParams.get("category"),
    selectedFolders: searchParams.getAll("folder"),
    excludedFolders: searchParams.getAll("excludeFolder"),
    selectedTags: searchParams.getAll("tag"),
    excludedTags: searchParams.getAll("exclude"),
    searchQuery: searchParams.get("q") ?? "",
    sortBy,
    contentMode: null,
    boardId: searchParams.get("board"),
  };
}

export function requiresDetailedBrowseIndex(
  filters: Pick<FilterState, "selectedFolders" | "excludedFolders" | "selectedTags" | "excludedTags" | "searchQuery">,
  options: { includeSearchQuery?: boolean } = {}
): boolean {
  const includeSearchQuery = options.includeSearchQuery ?? true;

  return (
    filters.selectedFolders.length > 0 ||
    filters.excludedFolders.length > 0 ||
    filters.selectedTags.length > 0 ||
    filters.excludedTags.length > 0 ||
    (includeSearchQuery && filters.searchQuery.trim().length > 0)
  );
}

export function listBrowseResults({
  cards,
  summary,
  projection,
  filters,
  boardClipIds,
  categories,
  tagI18n = {},
  lang = "ko",
  offset = 0,
  pageSize = 60,
}: ListBrowseResultsOptions): BrowseResultsPage {
  const filtered = filterClips(
    projection,
    filters,
    categories,
    tagI18n,
    lang,
    boardClipIds
  );

  // When cards are provided, use them for output (lighter weight)
  const lookup = cards
    ? new Map(cards.map((record) => [record.id, record]))
    : new Map(summary.map((record) => [record.id, record]));

  const page = filtered
    .slice(offset, offset + pageSize)
    .map((record) => lookup.get(record.id))
    .filter((record): record is BrowseSummaryRecord => Boolean(record));
  const nextOffset =
    offset + pageSize < filtered.length ? offset + pageSize : null;

  return {
    items: page,
    totalCount: filtered.length,
    nextOffset,
  };
}
