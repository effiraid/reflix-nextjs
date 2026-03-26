import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBlobUrl } from "./blobVideo";

const mockCreateObjectURL = vi.fn(() => "blob:https://reflix.dev/fake-uuid");
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  globalThis.URL.createObjectURL = mockCreateObjectURL;
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
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
      { credentials: "include", signal: undefined }
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

  it("passes AbortSignal to fetch", async () => {
    const mockBlob = new Blob(["data"], { type: "video/mp4" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });
    globalThis.fetch = mockFetch;
    const controller = new AbortController();

    await fetchBlobUrl("https://media.reflix.dev/videos/clip-1.mp4", controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://media.reflix.dev/videos/clip-1.mp4",
      { credentials: "include", signal: controller.signal }
    );
  });
});
