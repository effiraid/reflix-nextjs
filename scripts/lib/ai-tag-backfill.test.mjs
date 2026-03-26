import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_CHECKPOINT_RELATIVE_PATH,
  createAiTagCheckpoint,
  loadAiTagCheckpoint,
  loadProjectEnv,
  parseFlags,
  runAiTagBackfill,
  saveAiTagCheckpoint,
  selectAiBackfillItems,
  shouldBackfillAiTags,
} from "./ai-tag-backfill.mjs";

function createTempEntry({
  id,
  aiTags,
  mediaExists = true,
} = {}) {
  const infoDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tag-backfill-entry-"));
  const metadataPath = path.join(infoDir, "metadata.json");
  const metadata = {
    id: id || "ITEM1",
    name: "Sample Clip",
    tags: ["연출", "테스트"],
    folders: ["FOLDER1"],
  };

  if (arguments[0] && Object.prototype.hasOwnProperty.call(arguments[0], "aiTags")) {
    metadata.aiTags = aiTags;
  }

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  let mediaPath = null;
  if (mediaExists) {
    mediaPath = path.join(infoDir, `${metadata.id}.mp4`);
    fs.writeFileSync(mediaPath, "video");
  }

  return {
    ...metadata,
    metadataPath,
    _mediaPath: mediaPath,
    _infoDir: infoDir,
  };
}

test("parseFlags recognizes ai tag backfill options", () => {
  const flags = parseFlags([
    "--dry-run",
    "--retry-null",
    "--ids",
    "A1,B2",
    "--limit",
    "3",
    "--model",
    "gemini-2.5-flash",
    "--checkpoint",
    "config/custom-ai-progress.json",
  ]);

  assert.deepEqual(flags, {
    dryRun: true,
    retryNull: true,
    ids: ["A1", "B2"],
    limit: 3,
    model: "gemini-2.5-flash",
    checkpointPath: "config/custom-ai-progress.json",
  });
});

test("shouldBackfillAiTags only selects missing aiTags unless retry-null is enabled", () => {
  assert.equal(shouldBackfillAiTags({ id: "missing" }, { retryNull: false }), true);
  assert.equal(
    shouldBackfillAiTags({ id: "null", aiTags: null }, { retryNull: false }),
    false
  );
  assert.equal(
    shouldBackfillAiTags({ id: "null", aiTags: null }, { retryNull: true }),
    true
  );
  assert.equal(
    shouldBackfillAiTags(
      {
        id: "ready",
        aiTags: {
          actionType: ["걷기"],
          emotion: [],
          composition: [],
          pacing: "보통",
          characterType: [],
          effects: [],
          description: { ko: "설명", en: "desc" },
          model: "gemini-2.5-flash",
          generatedAt: "2026-03-26T00:00:00.000Z",
        },
      },
      { retryNull: true }
    ),
    false
  );
});

test("selectAiBackfillItems filters by aiTags state, ids, and limit", () => {
  const items = [
    { id: "A" },
    { id: "B", aiTags: null },
    { id: "C", aiTags: { model: "ready" } },
    { id: "D" },
  ];

  assert.deepEqual(
    selectAiBackfillItems(items, {
      retryNull: false,
      ids: null,
      limit: null,
    }).map((item) => item.id),
    ["A", "D"]
  );

  assert.deepEqual(
    selectAiBackfillItems(items, {
      retryNull: true,
      ids: ["B", "D"],
      limit: 1,
    }).map((item) => item.id),
    ["B"]
  );
});

test("runAiTagBackfill writes aiTags into metadata and records checkpoint success", async () => {
  const entry = createTempEntry({ id: "ITEM1" });
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tag-backfill-project-"));

  try {
    const summary = await runAiTagBackfill([entry], {
      projectRoot,
      dryRun: false,
      retryNull: false,
      ids: null,
      limit: null,
      model: "gemini-2.5-flash",
      generateAiTags: async (item, options) => ({
        actionType: ["일어나기"],
        emotion: ["고통"],
        composition: ["미디엄샷"],
        pacing: "느림",
        characterType: ["마법사"],
        effects: ["잔상"],
        description: {
          ko: `${item.name} 설명`,
          en: "Description",
        },
        model: options.model,
        generatedAt: "2026-03-26T23:00:00.000Z",
      }),
    });

    const written = JSON.parse(fs.readFileSync(entry.metadataPath, "utf8"));
    const checkpoint = JSON.parse(
      fs.readFileSync(path.join(projectRoot, DEFAULT_CHECKPOINT_RELATIVE_PATH), "utf8")
    );

    assert.equal(summary.successCount, 1);
    assert.equal(summary.failureCount, 0);
    assert.deepEqual(written.aiTags.actionType, ["일어나기"]);
    assert.equal(written.aiTags.model, "gemini-2.5-flash");
    assert.deepEqual(checkpoint.processedIds, ["ITEM1"]);
    assert.deepEqual(checkpoint.succeededIds, ["ITEM1"]);
    assert.deepEqual(checkpoint.failed, []);
  } finally {
    fs.rmSync(entry._infoDir, { recursive: true, force: true });
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("runAiTagBackfill records null aiTags and failure details when generation fails", async () => {
  const entry = createTempEntry({ id: "ITEM2" });
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tag-backfill-project-"));

  try {
    const summary = await runAiTagBackfill([entry], {
      projectRoot,
      dryRun: false,
      retryNull: false,
      ids: null,
      limit: null,
      model: "gemini-2.5-flash",
      generateAiTags: async () => {
        throw new Error("quota exceeded");
      },
    });

    const written = JSON.parse(fs.readFileSync(entry.metadataPath, "utf8"));
    const checkpoint = JSON.parse(
      fs.readFileSync(path.join(projectRoot, DEFAULT_CHECKPOINT_RELATIVE_PATH), "utf8")
    );

    assert.equal(summary.successCount, 0);
    assert.equal(summary.failureCount, 1);
    assert.equal(written.aiTags, null);
    assert.deepEqual(checkpoint.processedIds, ["ITEM2"]);
    assert.deepEqual(checkpoint.succeededIds, []);
    assert.deepEqual(checkpoint.failed, [
      { id: "ITEM2", error: "quota exceeded" },
    ]);
  } finally {
    fs.rmSync(entry._infoDir, { recursive: true, force: true });
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("loadAiTagCheckpoint returns an empty checkpoint when the file is missing", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tag-backfill-project-"));

  try {
    assert.deepEqual(
      loadAiTagCheckpoint(path.join(projectRoot, DEFAULT_CHECKPOINT_RELATIVE_PATH)),
      createAiTagCheckpoint()
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("saveAiTagCheckpoint persists checkpoint JSON to disk", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tag-backfill-project-"));
  const checkpointPath = path.join(projectRoot, "config", "ai-tagging-progress.json");
  const checkpoint = createAiTagCheckpoint();
  checkpoint.processedIds.push("ITEM3");

  try {
    saveAiTagCheckpoint(checkpointPath, checkpoint);

    const written = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
    assert.deepEqual(written.processedIds, ["ITEM3"]);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("loadProjectEnv loads .env.local values into the provided env object", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tag-backfill-project-"));
  const env = {};

  try {
    fs.writeFileSync(
      path.join(projectRoot, ".env.local"),
      [
        "# comment",
        "GEMINI_API_KEY=test-key",
        "NEXT_PUBLIC_MEDIA_URL=http://localhost:3000",
      ].join("\n")
    );

    loadProjectEnv(projectRoot, env);

    assert.equal(env.GEMINI_API_KEY, "test-key");
    assert.equal(env.NEXT_PUBLIC_MEDIA_URL, "http://localhost:3000");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
