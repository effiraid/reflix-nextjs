import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClip, loadBrowseProjection, loadBrowseSummary } from "./data";

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

describe("getClip", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.VERCEL_URL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to the deployment asset URL when the local public file is unavailable", async () => {
    process.env.VERCEL_URL = "reflix.dev";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => remoteClip,
    });
    vi.stubGlobal("fetch", fetchMock);

    const clip = await (getClip as typeof getClip & ((id: string) => Promise<typeof remoteClip | null>))(
      "REMOTE_CLIP_123"
    );

    expect(clip).toEqual(remoteClip);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://reflix.dev/data/clips/REMOTE_CLIP_123.json",
      expect.objectContaining({
        cache: "force-cache",
      })
    );
  });

  it("loads browse summary and projection from public browse artifacts", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-browse-data-"));
    fs.mkdirSync(path.join(tempDir, "public", "data", "browse"), {
      recursive: true,
    });

    fs.writeFileSync(
      path.join(tempDir, "public", "data", "browse", "summary.json"),
      JSON.stringify([
        {
          id: "A",
          name: "Arcane",
          thumbnailUrl: "/thumbnails/A.webp",
          previewUrl: "/previews/A.mp4",
          lqipBase64: "",
          width: 640,
          height: 360,
          duration: 1,
          star: 3,
          category: "direction-video",
        },
      ])
    );
    fs.writeFileSync(
      path.join(tempDir, "public", "data", "browse", "projection.json"),
      JSON.stringify([
        {
          id: "A",
          name: "Arcane",
          thumbnailUrl: "/thumbnails/A.webp",
          previewUrl: "/previews/A.mp4",
          lqipBase64: "",
          width: 640,
          height: 360,
          duration: 1,
          star: 3,
          category: "direction-video",
          tags: ["magic"],
          aiStructuredTags: ["attack"],
          folders: ["folder-1"],
          searchTokens: ["arcane", "attack"],
        },
      ])
    );

    process.chdir(tempDir);

    await expect(loadBrowseSummary()).resolves.toEqual([
      expect.objectContaining({ id: "A", name: "Arcane" }),
    ]);
    await expect(loadBrowseProjection()).resolves.toEqual([
      expect.objectContaining({
        id: "A",
        tags: ["magic"],
        aiStructuredTags: ["attack"],
      }),
    ]);
  });
});
