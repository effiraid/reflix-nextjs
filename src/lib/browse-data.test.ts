import { describe, expect, it } from "vitest";
import {
  buildBrowseArtifactsFromClipIndex,
  normalizeBrowseProjectionRecord,
} from "./browse-data";

describe("browse-data", () => {
  it("normalizes a projection record without detail-only fields", () => {
    const record = normalizeBrowseProjectionRecord({
      id: "clip-1",
      name: "Magic Attack",
      thumbnailUrl: "/thumbnails/clip-1.webp",
      previewUrl: "/previews/clip-1.mp4",
      lqipBase64: "data:image/jpeg;base64,AAA",
      width: 1280,
      height: 720,
      duration: 2.1,
      category: "combat",
      tags: ["magic"],
      aiStructuredTags: ["spell", "attack"],
      folders: ["folder-1"],
      searchTokens: ["magic", "spell", "attack"],
    });

    expect(record.id).toBe("clip-1");
    expect(record.searchTokens).toContain("magic");
    expect(record.aiStructuredTags).toEqual(["spell", "attack"]);
    expect("annotation" in record).toBe(false);
  });

  it("fills missing projection arrays with empty lists", () => {
    const record = normalizeBrowseProjectionRecord({
      id: "clip-2",
      name: "Idle",
      thumbnailUrl: "/thumbnails/clip-2.webp",
      previewUrl: "/previews/clip-2.mp4",
      lqipBase64: "",
      width: 640,
      height: 360,
      duration: 1,
      category: "idle",
    });

    expect(record.tags).toEqual([]);
    expect(record.aiStructuredTags).toEqual([]);
    expect(record.folders).toEqual([]);
    expect(record.searchTokens).toEqual([]);
  });

  it("builds browse artifacts from legacy clip index entries", () => {
    const { summary, projection } = buildBrowseArtifactsFromClipIndex([
      {
        id: "clip-3",
        name: "Arcane Clash",
        tags: ["magic"],
        folders: ["folder-1"],
        aiTags: {
          actionType: ["attack"],
          emotion: ["anger"],
          composition: ["close-up"],
          pacing: "fast",
          characterType: ["mage"],
          effects: ["glow"],
          description: {
            ko: "비전 충돌 장면",
            en: "Arcane collision scene",
          },
          model: "gemini",
          generatedAt: "2026-03-27T00:00:00.000Z",
        },
        width: 1280,
        height: 720,
        duration: 2.1,
        category: "combat",
        thumbnailUrl: "/thumbnails/clip-3.webp",
        previewUrl: "/previews/clip-3.mp4",
        lqipBase64: "",
      },
    ]);

    expect(summary[0]).toEqual(
      expect.objectContaining({
        id: "clip-3",
        name: "Arcane Clash",
        tags: ["magic"],
      })
    );
    expect(projection[0].aiStructuredTags).toEqual([
      "attack",
      "anger",
      "close-up",
      "fast",
      "mage",
      "glow",
    ]);
    expect(projection[0].searchTokens).toContain("arcane");
    expect(projection[0].searchTokens).toContain("충돌");
  });
});
