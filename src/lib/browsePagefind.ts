type PagefindResultData = {
  url?: string;
  meta?: {
    clipId?: string;
    [key: string]: string | undefined;
  };
};

type PagefindSearchResult = {
  data: () => Promise<PagefindResultData>;
};

type PagefindSearchResponse = {
  results: PagefindSearchResult[];
};

export type PagefindModule = {
  init: () => Promise<void> | void;
  destroy?: () => Promise<void> | void;
  search: (
    query: string,
    options?: Record<string, unknown>
  ) => Promise<PagefindSearchResponse>;
};

export type BrowsePagefindOptions = {
  importPagefind?: () => Promise<PagefindModule>;
};

let loadedPagefind: PagefindModule | null = null;
let loadedPagefindPromise: Promise<PagefindModule> | null = null;
let pagefindActiveLang: string | null = null;
let pagefindInitialized = false;
let operationQueue: Promise<void> = Promise.resolve();

const PAGEFIND_BUNDLE_PATH = "/pagefind/pagefind.js";

async function defaultImportPagefind(): Promise<PagefindModule> {
  return import(
    /* webpackIgnore: true */
    PAGEFIND_BUNDLE_PATH
  ) as Promise<PagefindModule>;
}

async function loadPagefindModule(
  importPagefind: () => Promise<PagefindModule>
): Promise<PagefindModule> {
  if (loadedPagefind) {
    return loadedPagefind;
  }

  if (!loadedPagefindPromise) {
    loadedPagefindPromise = importPagefind().then((module) => {
      loadedPagefind = module;
      return module;
    }).catch((error) => {
      loadedPagefindPromise = null;
      throw error;
    });
  }

  return loadedPagefindPromise;
}

function serializeOperation<T>(task: () => Promise<T>): Promise<T> {
  const run = operationQueue.then(task, task);
  operationQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensurePagefindForLang(
  lang: string,
  importPagefind: () => Promise<PagefindModule>
): Promise<PagefindModule> {
  const pagefind = await loadPagefindModule(importPagefind);
  if (typeof document !== "undefined" && document.documentElement.lang !== lang) {
    document.documentElement.lang = lang;
  }

  if (!pagefindInitialized || pagefindActiveLang !== lang) {
    if (pagefindInitialized) {
      await pagefind.destroy?.();
      pagefindInitialized = false;
      pagefindActiveLang = null;
    }

    await pagefind.init();
    pagefindInitialized = true;
    pagefindActiveLang = lang;
  }

  return pagefind;
}

function extractClipId(result: PagefindResultData): string | null {
  const clipId = result.meta?.clipId;
  return typeof clipId === "string" && clipId.trim() ? clipId : null;
}

export async function prewarmBrowseSearch(
  lang: string,
  options: BrowsePagefindOptions = {}
): Promise<PagefindModule> {
  const importPagefind = options.importPagefind ?? defaultImportPagefind;
  return serializeOperation(() => ensurePagefindForLang(lang, importPagefind));
}

export async function searchBrowseClipIds(
  lang: string,
  query: string,
  options: BrowsePagefindOptions = {}
): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const importPagefind = options.importPagefind ?? defaultImportPagefind;

  return serializeOperation(async () => {
    const pagefind = await ensurePagefindForLang(lang, importPagefind);
    const search = await pagefind.search(trimmed);
    const results = await Promise.all(
      (search.results ?? []).map((result) => result.data())
    );

    return results
      .map(extractClipId)
      .filter((clipId): clipId is string => clipId !== null);
  });
}
