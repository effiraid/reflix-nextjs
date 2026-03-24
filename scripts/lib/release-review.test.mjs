import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import categories from "../../src/data/categories.json" with { type: "json" };
import {
  buildReviewSuggestion,
  buildReviewSummary,
  classifyReviewItemStatus,
  renderReviewReport,
} from "./release-review.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLIP_FIXTURE_DIR = path.join(REPO_ROOT, "public", "data", "clips");

function readClipFixture(id) {
  return JSON.parse(fs.readFileSync(path.join(CLIP_FIXTURE_DIR, `${id}.json`), "utf8"));
}

function createTempClipFixture(id) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-review-clip-"));
  const targetPath = path.join(tempDir, `${id}.json`);
  fs.copyFileSync(path.join(CLIP_FIXTURE_DIR, `${id}.json`), targetPath);
  return JSON.parse(fs.readFileSync(targetPath, "utf8"));
}

function makeItem(overrides = {}) {
  return {
    id: "ITEM1",
    name: "연출 아케인 힘듦 비틀비틀",
    tags: ["아케인", "힘듦", "비틀비틀", "reflix:approved"],
    folders: ["L475K68YP1NH3"],
    annotation: "작품",
    star: 3,
    mtime: 1669363438000,
    ...overrides,
  };
}

test("classifyReviewItemStatus distinguishes held, changed, approved, and review-needed items", () => {
  const exportedClip = readClipFixture("L3TR52T22TPVR");

  const held = classifyReviewItemStatus({
    item: makeItem({ tags: ["아케인", "reflix:hold"] }),
    exportedClip,
  });
  const alreadyApproved = classifyReviewItemStatus({
    item: makeItem({
      duration: exportedClip.duration,
      width: exportedClip.width,
      height: exportedClip.height,
      star: exportedClip.star,
      annotation: exportedClip.annotation,
      tags: ["아케인", "힘듦", "비틀비틀", "reflix:approved"],
    }),
    exportedClip: {
      name: "연출 아케인 힘듦 비틀비틀",
      tags: ["아케인", "힘듦", "비틀비틀"],
      folders: ["L475K68YP1NH3"],
      annotation: exportedClip.annotation,
      star: exportedClip.star,
      duration: exportedClip.duration,
      width: exportedClip.width,
      height: exportedClip.height,
    },
  });
  const changed = classifyReviewItemStatus({
    item: makeItem({ name: "연출 아케인 힘듦 비틀비틀 changed" }),
    exportedClip,
  });
  const reviewNeeded = classifyReviewItemStatus({
    item: makeItem({ tags: ["아케인", "힘듦"] }),
    exportedClip,
  });

  assert.equal(held, "held");
  assert.equal(alreadyApproved, "already_approved");
  assert.equal(changed, "review_needed_changed");
  assert.equal(reviewNeeded, "review_needed");
});

test("classifyReviewItemStatus ignores media and thumbnail paths for matching approved metadata", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-review-metadata-only-"));
  const mediaPath = path.join(tempDir, "clip.mp4");
  const thumbnailPath = path.join(tempDir, "clip_thumbnail.png");
  fs.writeFileSync(mediaPath, "media");
  fs.writeFileSync(thumbnailPath, "thumb");

  const status = classifyReviewItemStatus({
    item: makeItem({
      tags: ["아케인", "힘듦", "비틀비틀", "reflix:approved"],
      duration: 8.555,
      width: 640,
      height: 360,
      _mediaPath: mediaPath,
      _thumbnailPath: thumbnailPath,
    }),
    exportedClip: {
      name: "연출 아케인 힘듦 비틀비틀",
      tags: ["아케인", "힘듦", "비틀비틀"],
      folders: ["L475K68YP1NH3"],
      annotation: "작품",
      star: 3,
      duration: 8.555,
      width: 640,
      height: 360,
    },
  });

  assert.equal(status, "already_approved");
});

test("classifyReviewItemStatus ignores duplicate content tags for matching approved metadata", () => {
  const status = classifyReviewItemStatus({
    item: makeItem({
      name: "Arcane Pose",
      tags: ["Arcane", "Arcane", "Pose", "reflix:approved"],
      folders: ["folder-1"],
      annotation: "",
      star: 0,
      duration: 3.2,
      width: 1280,
      height: 720,
    }),
    exportedClip: {
      name: "Arcane Pose",
      tags: ["Arcane", "Pose"],
      folders: ["folder-1"],
      annotation: "",
      star: 0,
      duration: 3.2,
      width: 1280,
      height: 720,
    },
  });

  assert.equal(status, "already_approved");
});

test("buildReviewSuggestion ignores reflix tags and numeric tokens", () => {
  const item = makeItem({
    name: "연출 아케인 힘듦 (2) 03",
    tags: ["아케인", "2", "(2)", "03", "reflix:approved", "reflix:review-requested"],
  });
  const exportedClip = readClipFixture("L3TR52T22TPVR");

  const suggestion = buildReviewSuggestion({ item, exportedClip, taxonomy: categories });

  assert.deepEqual(suggestion.currentTags, ["아케인"]);
  assert.equal(suggestion.suggestedTagsToAdd.includes("2"), false);
  assert.equal(suggestion.suggestedTagsToAdd.includes("(2)"), false);
  assert.equal(suggestion.suggestedTagsToAdd.includes("03"), false);
  assert.equal(suggestion.suggestedTagsToAdd.some((tag) => tag.startsWith("reflix:")), false);
  assert.equal(suggestion.suggestedTagsToRemove.some((tag) => tag.startsWith("reflix:")), false);
});

test("buildReviewSuggestion keeps the current name when no deterministic improvement exists", () => {
  const item = makeItem({
    name: "연출 아케인 힘듦 비틀비틀",
    tags: ["아케인", "힘듦", "비틀비틀"],
  });

  const suggestion = buildReviewSuggestion({
    item,
    exportedClip: createTempClipFixture("L3TR52T22TPVR"),
    taxonomy: categories,
  });

  assert.equal(suggestion.nameDecision, "keep");
  assert.equal(suggestion.suggestedName, item.name);
});

test("buildReviewSuggestion deduplicates and stabilizes tag suggestions", () => {
  const item = makeItem({
    tags: ["아케인", "아케인", "힘듦", "힘듦", "reflix:approved"],
  });

  const first = buildReviewSuggestion({
    item,
    exportedClip: createTempClipFixture("L3TR52T2BJCOW"),
    taxonomy: categories,
  });
  const second = buildReviewSuggestion({
    item,
    exportedClip: createTempClipFixture("L3TR52T2BJCOW"),
    taxonomy: categories,
  });

  assert.deepEqual(first.suggestedTagsToAdd, second.suggestedTagsToAdd);
  assert.deepEqual(first.suggestedTagsToRemove, second.suggestedTagsToRemove);
  assert.deepEqual(first.suggestedTagsToAdd, [...new Set(first.suggestedTagsToAdd)]);
  assert.deepEqual(first.suggestedTagsToRemove, [...new Set(first.suggestedTagsToRemove)]);
});

test("buildReviewSuggestion preserves user-facing casing in suggested names and tags", () => {
  const suggestion = buildReviewSuggestion({
    item: makeItem({
      name: "Arcane Arcane",
      tags: ["reflix:approved"],
      folders: ["folder-1"],
      annotation: "",
      star: 0,
      duration: 3.2,
      width: 1280,
      height: 720,
    }),
    exportedClip: {
      name: "",
      tags: [],
      folders: [],
      annotation: "",
      star: 0,
      duration: 0,
      width: 0,
      height: 0,
    },
    taxonomy: {
      ARCANE: {
        slug: "arcane",
        i18n: { en: "Arcane" },
      },
    },
  });

  assert.equal(suggestion.suggestedName, "Arcane");
  assert.equal(suggestion.suggestedTagsToAdd.includes("Arcane"), true);
  assert.equal(suggestion.suggestedTagsToAdd.includes("arcane"), false);
});

test("buildReviewSuggestion reuses taxonomy as atomic tag terms before new tag candidates", () => {
  const taxonomySuggestion = buildReviewSuggestion({
    item: makeItem({
      name: "연출 아케인 일어나기 고통",
      tags: ["아케인"],
    }),
    exportedClip: {
      name: "",
      tags: [],
      annotation: "",
      folders: [],
    },
    taxonomy: categories,
  });

  const newTagSuggestion = buildReviewSuggestion({
    item: makeItem({
      name: "연출 아케인 번쩍임",
      tags: ["아케인"],
    }),
    exportedClip: {
      name: "",
      tags: [],
      annotation: "",
      folders: [],
    },
    taxonomy: categories,
  });

  assert.equal(taxonomySuggestion.newTagCandidates.length, 0);
  assert.ok(taxonomySuggestion.suggestedTagsToAdd.includes("일어나기"));
  assert.ok(taxonomySuggestion.suggestedTagsToAdd.includes("고통"));
  assert.equal(taxonomySuggestion.suggestedTagsToAdd.includes("앉기/눕기/일어나기"), false);
  assert.equal(taxonomySuggestion.suggestedTagsToAdd.includes("고통/쓰러짐"), false);
  assert.ok(newTagSuggestion.newTagCandidates.includes("번쩍임"));
});

test("buildReviewSuggestion syncs tags from the richer name side", () => {
  const suggestion = buildReviewSuggestion({
    item: makeItem({
      name: "연출 아케인 힘듦 일어나기 (2)",
      tags: ["아케인", "힘듦", "2", "reflix:approved"],
    }),
    exportedClip: {
      name: "",
      tags: [],
      annotation: "",
      folders: [],
    },
    taxonomy: categories,
  });

  assert.equal(suggestion.nameDecision, "keep");
  assert.equal(suggestion.suggestedName, "연출 아케인 힘듦 일어나기 (2)");
  assert.ok(suggestion.suggestedTagsToAdd.includes("일어나기"));
  assert.equal(suggestion.suggestedTagsToAdd.includes("2"), false);
  assert.equal(suggestion.suggestedTagsToAdd.includes("(2)"), false);
});

test("buildReviewSuggestion syncs the name from the richer tag side", () => {
  const suggestion = buildReviewSuggestion({
    item: makeItem({
      name: "연출 아케인 힘듦",
      tags: ["아케인", "힘듦", "일어나기", "고통", "2", "reflix:approved"],
    }),
    exportedClip: {
      name: "",
      tags: [],
      annotation: "",
      folders: [],
    },
    taxonomy: categories,
  });

  assert.equal(suggestion.nameDecision, "suggest-change");
  assert.equal(suggestion.suggestedName, "연출 아케인 힘듦 일어나기 고통");
  assert.deepEqual(suggestion.suggestedTagsToAdd, []);
});

test("buildReviewSuggestion filters out grammar fragments while preserving ideophones", () => {
  const suggestion = buildReviewSuggestion({
    item: makeItem({
      name: "연출 아케인 비틀비틀 일어나기 고통 거친 숨을 몰아 쉴 wow",
      tags: ["아케인"],
    }),
    exportedClip: {
      name: "",
      tags: [],
      annotation: "",
      folders: [],
    },
    taxonomy: categories,
  });

  assert.ok(suggestion.suggestedTagsToAdd.includes("일어나기"));
  assert.ok(suggestion.suggestedTagsToAdd.includes("고통"));
  assert.equal(suggestion.suggestedTagsToAdd.includes("거친"), false);
  assert.equal(suggestion.suggestedTagsToAdd.includes("숨을"), false);
  assert.equal(suggestion.suggestedTagsToAdd.includes("몰아"), false);
  assert.equal(suggestion.suggestedTagsToAdd.includes("쉴"), false);
  assert.ok(suggestion.newTagCandidates.includes("비틀비틀"));
  assert.equal(suggestion.newTagCandidates.includes("거친"), false);
  assert.equal(suggestion.newTagCandidates.includes("숨을"), false);
  assert.equal(suggestion.newTagCandidates.includes("몰아"), false);
  assert.equal(suggestion.newTagCandidates.includes("쉴"), false);
  assert.equal(suggestion.newTagCandidates.includes("wow"), false);
});

test("buildReviewSummary counts review statuses", () => {
  const summary = buildReviewSummary([
    { status: "review_needed_changed" },
    { status: "review_needed" },
    { status: "held" },
    { status: "already_approved" },
    { status: "review_needed" },
  ]);

  assert.deepEqual(summary, {
    total: 5,
    review_needed_changed: 1,
    review_needed: 2,
    already_approved: 1,
    held: 1,
  });
});

test("renderReviewReport orders items and includes operator instructions and summary fields", () => {
  const suggestions = [
    { id: "C", status: "already_approved", currentName: "C", suggestedName: "C", nameDecision: "keep", currentTags: [], suggestedTagsToAdd: [], suggestedTagsToRemove: [], newTagCandidates: [], reason: "approved", confidence: "medium", nextAction: "approve_after_review", currentFolders: [] },
    { id: "A", status: "review_needed", currentName: "A", suggestedName: "A", nameDecision: "keep", currentTags: [], suggestedTagsToAdd: [], suggestedTagsToRemove: [], newTagCandidates: [], reason: "needed", confidence: "medium", nextAction: "approve_after_review", currentFolders: [] },
    { id: "B", status: "review_needed_changed", currentName: "B", suggestedName: "B", nameDecision: "keep", currentTags: [], suggestedTagsToAdd: [], suggestedTagsToRemove: [], newTagCandidates: [], reason: "changed", confidence: "medium", nextAction: "review_existing_changes", currentFolders: [] },
    { id: "D", status: "held", currentName: "D", suggestedName: "D", nameDecision: "keep", currentTags: [], suggestedTagsToAdd: [], suggestedTagsToRemove: [], newTagCandidates: [], reason: "held", confidence: "medium", nextAction: "hold_for_manual_decision", currentFolders: [] },
  ];

  const report = renderReviewReport({
    summary: buildReviewSummary(suggestions),
    suggestions,
    timestamp: "2026-03-24T12:00:00.000Z",
    batchName: "mvp-10",
    scope: "active-batch",
  });

  assert.match(report, /변경 후 재검토 필요[\s\S]*검토 필요[\s\S]*보류[\s\S]*이미 승인됨/);
  assert.match(report, /생성 시각: 2026-03-24T12:00:00.000Z/);
  assert.match(report, /배치 이름: mvp-10/);
  assert.match(report, /범위: active-batch/);
  assert.match(report, /Eagle에서 검토/);
  assert.match(report, /`reflix:approved`를 추가/);
  assert.match(report, /`reflix:hold`를 추가/);
  assert.match(report, /`release:approve`를 실행/);
  assert.match(report, /검토 필요: 1/);
  assert.match(report, /변경 후 재검토 필요: 1/);
  assert.match(report, /이미 승인됨: 1/);
  assert.match(report, /보류: 1/);
  assert.match(report, /현재 상태: 변경 후 재검토 필요/);
  assert.match(report, /신뢰도: 보통/);
});
