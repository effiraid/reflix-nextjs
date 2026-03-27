import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildBrowseArtifacts, writeBrowseArtifacts } from "./browse-artifacts.mjs";

test("buildBrowseArtifacts splits summary and projection fields", () => {
  const { summary, projection } = buildBrowseArtifacts([
    {
      id: "A",
      name: "Arcane Attack",
      tags: ["arcane", "attack"],
      aiTags: {
        actionType: ["attack"],
        emotion: ["anger"],
        composition: ["close-up"],
        pacing: "fast",
        characterType: ["mage"],
        effects: ["glow"],
        description: {
          ko: "비전 마법 공격 장면",
          en: "detail description",
        },
        model: "gemini",
        generatedAt: "2026-03-27T00:00:00.000Z",
      },
      folders: ["f1"],
      star: 4,
      category: "combat",
      width: 1280,
      height: 720,
      duration: 2,
      previewUrl: "/previews/A.mp4",
      thumbnailUrl: "/thumbnails/A.webp",
      lqipBase64: "data:image/jpeg;base64,AAA",
    },
  ]);

  assert.equal(summary[0].id, "A");
  assert.equal("tags" in summary[0], false);
  assert.deepEqual(projection[0].aiStructuredTags, [
    "attack",
    "anger",
    "close-up",
    "fast",
    "mage",
    "glow",
  ]);
  assert.ok(projection[0].searchTokens.includes("arcane"));
  assert.ok(projection[0].searchTokens.includes("attack"));
  assert.ok(projection[0].searchTokens.includes("detail"));
  assert.equal("aiTags" in projection[0], false);
});

test("writeBrowseArtifacts writes summary and projection json files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-browse-artifacts-"));

  try {
    writeBrowseArtifacts(
      {
        summary: [{ id: "A", name: "Arcane" }],
        projection: [{ id: "A", name: "Arcane", searchTokens: ["arcane"] }],
      },
      tmpDir
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          path.join(tmpDir, "public", "data", "browse", "summary.json"),
          "utf-8"
        )
      ),
      [{ id: "A", name: "Arcane" }]
    );
    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          path.join(tmpDir, "public", "data", "browse", "projection.json"),
          "utf-8"
        )
      ),
      [{ id: "A", name: "Arcane", searchTokens: ["arcane"] }]
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
