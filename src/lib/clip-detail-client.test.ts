import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearClipDetailCache,
  loadClipDetail,
} from "./clip-detail-client";

const remoteClip = {
  id: "REMOTE_CLIP_123",
  name: "Remote Clip",
  ext: "mp4",
  size: 123,
  width: 1920,
  height: 1080,
  duration: 3.2,
  tags: ["tag"],
  folders: ["folder"],
  star: 3,
  annotation: "annotation",
  url: "",
  palettes: [],
  btime: 0,
  mtime: 0,
  i18n: {
    title: { ko: "Remote Clip", en: "Remote Clip" },
    description: { ko: "", en: "" },
  },
  videoUrl: "/videos/REMOTE_CLIP_123.mp4",
  thumbnailUrl: "/thumbnails/REMOTE_CLIP_123.webp",
  previewUrl: "/previews/REMOTE_CLIP_123.mp4",
  lqipBase64: "data:image/jpeg;base64,abc",
  category: "direction-video",
  relatedClips: [],
};

describe("clip-detail-client", () => {
  afterEach(() => {
    clearClipDetailCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent detail requests for the same clip id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => remoteClip,
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      loadClipDetail("REMOTE_CLIP_123"),
      loadClipDetail("REMOTE_CLIP_123"),
    ]);

    expect(first).toEqual(remoteClip);
    expect(second).toEqual(remoteClip);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves repeated requests from cache after the first load", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => remoteClip,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadClipDetail("REMOTE_CLIP_123")).resolves.toEqual(remoteClip);
    await expect(loadClipDetail("REMOTE_CLIP_123")).resolves.toEqual(remoteClip);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses browser HTTP cache so refreshed clip detail is not served stale", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => remoteClip,
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadClipDetail("REMOTE_CLIP_123");

    expect(fetchMock).toHaveBeenCalledWith("/data/clips/REMOTE_CLIP_123.json", {
      cache: "no-store",
    });
  });
});
