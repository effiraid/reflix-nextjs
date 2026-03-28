import { describe, it, expect } from "vitest";
import { buildRelatedInput, computeRelatedClips, computeRelatedClipsForSubset } from "./similarity.mjs";

function makeClip(id, tags = [], folders = []) {
  return { id, tags, folders };
}

describe("computeRelatedClips", () => {
  it("returns empty array for clip with no overlaps", () => {
    const clips = [
      makeClip("a", ["x"], ["f1"]),
      makeClip("b", ["y"], ["f2"]),
    ];
    const result = computeRelatedClips(clips);
    expect(result.get("a")).toEqual([]);
    expect(result.get("b")).toEqual([]);
  });

  it("ranks by tag overlap count", () => {
    const clips = [
      makeClip("a", ["x", "y", "z"], []),
      makeClip("b", ["x", "y"], []),       // 2 shared tags
      makeClip("c", ["x"], []),             // 1 shared tag
    ];
    const result = computeRelatedClips(clips);
    expect(result.get("a")).toEqual(["b", "c"]);
  });

  it("adds folder bonus (+2) for shared folders", () => {
    const clips = [
      makeClip("a", ["x"], ["f1"]),
      makeClip("b", ["x"], ["f1"]),  // 1 tag + 2 folder = 3
      makeClip("c", ["x", "y", "z"], []),  // 3 tags
    ];
    const result = computeRelatedClips(clips);
    // b: score 3, c: score 1 for clip a
    expect(result.get("a")).toEqual(["b", "c"]);
  });

  it("includes folder-only candidates (no tag overlap)", () => {
    const clips = [
      makeClip("a", ["x"], ["f1"]),
      makeClip("b", [], ["f1"]),  // folder only, score 2
    ];
    const result = computeRelatedClips(clips);
    expect(result.get("a")).toEqual(["b"]);
  });

  it("respects topN limit", () => {
    const clips = [
      makeClip("a", ["x"], []),
      makeClip("b", ["x"], []),
      makeClip("c", ["x"], []),
      makeClip("d", ["x"], []),
    ];
    const result = computeRelatedClips(clips, 2);
    expect(result.get("a")).toHaveLength(2);
  });

  it("handles clips with no tags and no folders", () => {
    const clips = [
      makeClip("a", [], []),
      makeClip("b", [], []),
    ];
    const result = computeRelatedClips(clips);
    expect(result.get("a")).toEqual([]);
    expect(result.get("b")).toEqual([]);
  });

  it("ignores tags whose fanout exceeds the safety limit", () => {
    const clips = Array.from({ length: 502 }, (_, index) =>
      makeClip(`clip-${index}`, ["crowded"], [])
    );

    const result = computeRelatedClips(clips);

    expect(result.get("clip-0")).toEqual([]);
  });

  it("produces same results as naive O(N²) for small dataset", () => {
    const clips = [
      makeClip("a", ["t1", "t2", "t3"], ["f1", "f2"]),
      makeClip("b", ["t1", "t2"], ["f1"]),
      makeClip("c", ["t3", "t4"], ["f2"]),
      makeClip("d", ["t5"], ["f3"]),
      makeClip("e", ["t1", "t3"], ["f1", "f2"]),
    ];

    // Naive O(N²) implementation for comparison
    function naiveRelated(clips, topN = 5) {
      const result = new Map();
      for (const clip of clips) {
        const scores = [];
        for (const other of clips) {
          if (other.id === clip.id) continue;
          const tagOverlap = clip.tags.filter((t) => other.tags.includes(t)).length;
          const sameFolderBonus = clip.folders.some((f) => other.folders.includes(f)) ? 2 : 0;
          const score = tagOverlap + sameFolderBonus;
          if (score > 0) scores.push({ id: other.id, score });
        }
        scores.sort((a, b) => b.score - a.score);
        result.set(clip.id, scores.slice(0, topN).map((s) => s.id));
      }
      return result;
    }

    const optimized = computeRelatedClips(clips);
    const naive = naiveRelated(clips);

    for (const clip of clips) {
      expect(optimized.get(clip.id)).toEqual(naive.get(clip.id));
    }
  });

  it("computes the same rankings as the full map for a target subset", () => {
    const clips = [
      makeClip("a", ["t1", "t2"], ["f1"]),
      makeClip("b", ["t1"], ["f1"]),
      makeClip("c", ["t2"], ["f2"]),
      makeClip("d", ["t3"], ["f3"]),
    ];

    const full = computeRelatedClips(clips);
    const subset = computeRelatedClipsForSubset(clips, ["a", "c"]);

    expect(subset.get("a")).toEqual(full.get("a"));
    expect(subset.get("c")).toEqual(full.get("c"));
    expect(subset.has("b")).toBe(false);
  });

  it("normalizes related inputs into sorted tags folders and category", () => {
    expect(
      buildRelatedInput({
        tags: ["guard", "blade"],
        folders: ["F2", "F1"],
        category: "combat",
      })
    ).toEqual({
      tags: ["blade", "guard"],
      folders: ["F1", "F2"],
      category: "combat",
    });
  });
});
