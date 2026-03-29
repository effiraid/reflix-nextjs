import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type PagefindMock = {
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createPagefindMock(): PagefindMock {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    search: vi.fn(),
  };
}

function trackDocumentLang() {
  const element = document.documentElement;
  const originalDescriptor = Object.getOwnPropertyDescriptor(element, "lang");
  const events: string[] = [];
  let current = element.lang;

  Object.defineProperty(element, "lang", {
    configurable: true,
    enumerable: true,
    get() {
      return current;
    },
    set(value: string) {
      events.push(`lang:${value}`);
      current = value;
    },
  });

  return {
    events,
    restore() {
      if (originalDescriptor) {
        Object.defineProperty(element, "lang", originalDescriptor);
      } else {
        delete (element as HTMLElement & { lang?: string }).lang;
      }
    },
  };
}

async function loadAdapter() {
  return import("./browsePagefind");
}

describe("browsePagefind", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("prewarms Pagefind by setting document lang before the first init", async () => {
    const pagefindMock = createPagefindMock();
    const importPagefind = vi.fn(async () => pagefindMock);
    const langTracker = trackDocumentLang();
    pagefindMock.init.mockImplementation(async () => {
      langTracker.events.push("init");
    });
    const { prewarmBrowseSearch } = await loadAdapter();

    await prewarmBrowseSearch("ko", { importPagefind });

    expect(importPagefind).toHaveBeenCalledTimes(1);
    expect(pagefindMock.init).toHaveBeenCalledTimes(1);
    expect(pagefindMock.destroy).not.toHaveBeenCalled();
    expect(langTracker.events).toEqual(["lang:ko", "init"]);
    expect(document.documentElement.lang).toBe("ko");

    langTracker.restore();
  });

  it("updates document lang before destroy and re-init on locale switch", async () => {
    const pagefindMock = createPagefindMock();
    const importPagefind = vi.fn(async () => pagefindMock);
    const langTracker = trackDocumentLang();
    pagefindMock.init.mockImplementation(async () => {
      langTracker.events.push(`init:${document.documentElement.lang}`);
    });
    pagefindMock.destroy.mockImplementation(async () => {
      langTracker.events.push(`destroy:${document.documentElement.lang}`);
    });
    const { prewarmBrowseSearch } = await loadAdapter();

    await prewarmBrowseSearch("ko", { importPagefind });
    await prewarmBrowseSearch("en", { importPagefind });

    expect(importPagefind).toHaveBeenCalledTimes(1);
    expect(pagefindMock.init).toHaveBeenCalledTimes(2);
    expect(pagefindMock.destroy).toHaveBeenCalledTimes(1);
    expect(langTracker.events).toEqual([
      "lang:ko",
      "init:ko",
      "lang:en",
      "destroy:en",
      "init:en",
    ]);
    expect(document.documentElement.lang).toBe("en");

    langTracker.restore();
  });

  it("serializes concurrent mixed-language searches so results do not leak", async () => {
    const pagefindMock = createPagefindMock();
    const langTracker = trackDocumentLang();
    const koResult = createDeferred<{ url: string; meta: { clipId: string } }>();
    const enResult = createDeferred<{ url: string; meta: { clipId: string } }>();
    const searchEvents: string[] = [];

    pagefindMock.init.mockImplementation(async () => {
      langTracker.events.push(`init:${document.documentElement.lang}`);
    });
    pagefindMock.destroy.mockImplementation(async () => {
      langTracker.events.push(`destroy:${document.documentElement.lang}`);
    });
    pagefindMock.search
      .mockImplementationOnce(async () => {
        searchEvents.push(`search:${document.documentElement.lang}`);
        return {
          results: [
            {
              data: vi.fn(async () => koResult.promise),
            },
          ],
        };
      })
      .mockImplementationOnce(async () => {
        searchEvents.push(`search:${document.documentElement.lang}`);
        return {
          results: [
            {
              data: vi.fn(async () => enResult.promise),
            },
          ],
        };
      });

    const importPagefind = vi.fn(async () => pagefindMock);
    const { searchBrowseClipIds } = await loadAdapter();

    const koPromise = searchBrowseClipIds("ko", "alpha", { importPagefind });
    const enPromise = searchBrowseClipIds("en", "beta", { importPagefind });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pagefindMock.search).toHaveBeenCalledTimes(1);
    expect(searchEvents).toEqual(["search:ko"]);

    koResult.resolve({
      url: "/ko/clip/clip-ko",
      meta: { clipId: "clip-ko" },
    });

    await expect(koPromise).resolves.toEqual(["clip-ko"]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pagefindMock.search).toHaveBeenCalledTimes(2);
    expect(searchEvents).toEqual(["search:ko", "search:en"]);
    expect(langTracker.events).toEqual([
      "lang:ko",
      "init:ko",
      "lang:en",
      "destroy:en",
      "init:en",
    ]);

    enResult.resolve({
      url: "/en/clip/clip-en",
      meta: { clipId: "clip-en" },
    });

    await expect(enPromise).resolves.toEqual(["clip-en"]);
    expect(pagefindMock.init).toHaveBeenCalledTimes(2);
    expect(pagefindMock.destroy).toHaveBeenCalledTimes(1);

    langTracker.restore();
  });

  it("short-circuits empty queries without importing Pagefind", async () => {
    const pagefindMock = createPagefindMock();
    const importPagefind = vi.fn(async () => pagefindMock);
    const { searchBrowseClipIds } = await loadAdapter();

    await expect(
      searchBrowseClipIds("ko", "   ", { importPagefind })
    ).resolves.toEqual([]);

    expect(importPagefind).not.toHaveBeenCalled();
    expect(pagefindMock.init).not.toHaveBeenCalled();
    expect(pagefindMock.search).not.toHaveBeenCalled();
  });
});
