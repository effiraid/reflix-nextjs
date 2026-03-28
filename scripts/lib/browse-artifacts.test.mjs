import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildBrowseArtifacts, writeBrowseArtifacts } from "./browse-artifacts.mjs";

const SAMPLE_ENTRY = {
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
  category: "combat",
  width: 1280,
  height: 720,
  duration: 2,
  previewUrl: "/previews/A.mp4",
  thumbnailUrl: "/thumbnails/A.webp",
  lqipBase64: "data:image/jpeg;base64,AAA",
};

test("buildBrowseArtifacts splits summary and projection fields", () => {
  const { summary, projection } = buildBrowseArtifacts([SAMPLE_ENTRY]);

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

test("buildBrowseArtifacts produces cards and filterIndex outputs", () => {
  const { cards, filterIndex } = buildBrowseArtifacts([SAMPLE_ENTRY]);

  // cards should have summary fields but no tags/folders/searchTokens
  assert.equal(cards[0].id, "A");
  assert.equal(cards[0].name, "Arcane Attack");
  assert.equal(cards[0].previewUrl, "/previews/A.mp4");
  assert.equal("searchTokens" in cards[0], false);
  assert.equal("folders" in cards[0], false);

  // filterIndex should keep only filter/search fields plus lightweight ranking metadata.
  assert.equal(filterIndex[0].id, "A");
  assert.equal(filterIndex[0].name, "Arcane Attack");
  assert.equal(filterIndex[0].category, "combat");
  assert.deepEqual(filterIndex[0].tags, ["arcane", "attack"]);
  assert.deepEqual(filterIndex[0].aiStructuredTags, [
    "attack",
    "anger",
    "close-up",
    "fast",
    "mage",
    "glow",
  ]);
  assert.deepEqual(filterIndex[0].folders, ["f1"]);
  assert.ok(filterIndex[0].searchTokens.includes("arcane"));
  assert.ok(filterIndex[0].searchTokens.includes("attack"));
  assert.ok(filterIndex[0].searchTokens.includes("detail"));
});

test("writeBrowseArtifacts writes summary, projection, cards, and filter-index json files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-browse-artifacts-"));

  try {
    const artifacts = buildBrowseArtifacts([SAMPLE_ENTRY]);
    writeBrowseArtifacts(artifacts, tmpDir);

    const browseDir = path.join(tmpDir, "public", "data", "browse");

    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(browseDir, "summary.json"), "utf-8")),
      artifacts.summary
    );
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(browseDir, "projection.json"), "utf-8")),
      artifacts.projection
    );
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(browseDir, "cards.json"), "utf-8")),
      artifacts.cards
    );
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(browseDir, "filter-index.json"), "utf-8")),
      artifacts.filterIndex
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
