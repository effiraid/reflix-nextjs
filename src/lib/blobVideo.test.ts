import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBlobUrl, _clearCache } from "./blobVideo";

const mockCreateObjectURL = vi.fn(() => "blob:https://reflix.dev/fake-uuid");
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  globalThis.URL.createObjectURL = mockCreateObjectURL;
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
  _clearCache();
  vi.restoreAllMocks();
});

describe("fetchBlobUrl", () => {
  it("fetches video and returns blob URL", async () => {
    const mockBlob = new Blob(["video-data"], { type: "video/mp4" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });
    globalThis.fetch = mockFetch;

    const result = await fetchBlobUrl("https://media.reflix.dev/videos/clip-1.mp4");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://media.reflix.dev/videos/clip-1.mp4",
      { credentials: "include" }
    );
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(result).toBe("blob:https://reflix.dev/fake-uuid");
  });

  it("throws on non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });
    globalThis.fetch = mockFetch;

    await expect(fetchBlobUrl("https://media.reflix.dev/videos/clip-1.mp4")).rejects.toThrow("Media fetch failed: 403");
  });

  it("returns cached blob URL on second call", async () => {
    const mockBlob = new Blob(["data"], { type: "video/mp4" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });
    globalThis.fetch = mockFetch;

    const url = "https://media.reflix.dev/videos/clip-cached.mp4";
    const first = await fetchBlobUrl(url);
    const second = await fetchBlobUrl(url);

    expect(first).toBe(second);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("uses cacheKey for cache lookup when provided", async () => {
    const mockBlob = new Blob(["data"], { type: "video/mp4" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });
    globalThis.fetch = mockFetch;

    const signedUrl1 = "https://media.reflix.dev/videos/clip-1.mp4?tok=aaa&sig=bbb";
    const signedUrl2 = "https://media.reflix.dev/videos/clip-1.mp4?tok=ccc&sig=ddd";
    const cacheKey = "/videos/clip-1.mp4";

    const first = await fetchBlobUrl(signedUrl1, cacheKey);
    const second = await fetchBlobUrl(signedUrl2, cacheKey);

    expect(first).toBe(second);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
