import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClipMock, getDeploymentOriginMock } = vi.hoisted(() => ({
  getClipMock: vi.fn(),
  getDeploymentOriginMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getClip: getClipMock,
  getCategories: vi.fn(),
  getDeploymentOrigin: getDeploymentOriginMock,
  getTagI18n: vi.fn(),
}));

vi.mock("../../dictionaries", () => ({
  getDictionary: vi.fn(),
}));

import { generateMetadata } from "./page";

describe("clip detail metadata", () => {
  beforeEach(() => {
    getClipMock.mockReset();
    getDeploymentOriginMock.mockReset();

    getClipMock.mockResolvedValue({
      id: "clip-1",
      name: "Clip 1",
      category: "action",
      tags: ["태그"],
      width: 1280,
      height: 720,
      thumbnailUrl: "/thumbnails/clip-1.webp",
      i18n: {
        title: {
          ko: "클립 1",
          en: "Clip 1",
        },
      },
      aiTags: {
        description: {
          ko: "설명",
          en: "Description",
        },
      },
    });
  });

  it("falls back to the public site URL for OG images when no deployment origin is available", async () => {
    getDeploymentOriginMock.mockReturnValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ lang: "ko", id: "clip-1" }),
    });

    expect(metadata.openGraph?.url).toBe("https://reflix.dev/ko/clip/clip-1");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "https://reflix.dev/thumbnails/clip-1.webp",
        width: 1280,
        height: 720,
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      "https://reflix.dev/thumbnails/clip-1.webp",
    ]);
  });
});
