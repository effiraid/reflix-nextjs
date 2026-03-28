import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadItemState, saveItemState } from "./export-run-state.mjs";
import { runArtifactStage } from "./export-artifact-stage.mjs";

function createTempProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-artifact-stage-"));
  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "data", "clips"), { recursive: true });
  return projectRoot;
}

function saveMediaState(projectRoot, runId, item, lqipBase64 = "data:image/jpeg;base64,abc") {
  const mediaRoot = path.join(projectRoot, "public");
  const videoPath = path.join(mediaRoot, "videos", `${item.id}.mp4`);
  const previewPath = path.join(mediaRoot, "previews", `${item.id}.mp4`);
  const thumbnailPath = path.join(mediaRoot, "thumbnails", `${item.id}.webp`);

  fs.mkdirSync(path.dirname(videoPath), { recursive: true });
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });
  fs.writeFileSync(videoPath, "video");
  fs.writeFileSync(previewPath, "preview");
  fs.writeFileSync(thumbnailPath, "thumbnail");

  saveItemState({
    projectRoot,
    runId,
    clipId: item.id,
    itemState: {
      id: item.id,
      sourceSnapshot: {
        eagleMtime: item.mtime,
        mediaPath: item._mediaPath,
        thumbnailPath: item._thumbnailPath,
      },
      media: {
        status: "completed",
        width: 1280,
        height: 720,
        lqipBase64,
        outputs: {
          video: { path: videoPath, size: 5 },
          preview: { path: previewPath, size: 7 },
          thumbnail: { path: thumbnailPath, size: 9 },
        },
      },
    },
  });
}

test("runArtifactStage writes clip json, merged index, and browse artifacts from media checkpoints", async () => {
  const projectRoot = createTempProject();
  const runId = "run-artifacts-1";
  const item = {
    id: "A1",
    name: "Arcane Attack",
    ext: "mp4",
    size: 100,
    width: 640,
    height: 360,
    duration: 1.5,
    tags: ["attack", "arcane"],
    folders: ["F1"],
    url: "",
    palettes: [],
    btime: 1,
    mtime: 2,
    _mediaPath: "/library/A1.mp4",
    _thumbnailPath: "/library/A1_thumbnail.png",
  };
  saveMediaState(projectRoot, runId, item);

  const summary = await runArtifactStage([item], { projectRoot, runId });
  const clipJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "public", "data", "clips", "A1.json"), "utf-8")
  );
  const indexJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "src", "data", "index.json"), "utf-8")
  );
  const summaryJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "public", "data", "browse", "summary.json"), "utf-8")
  );
  const projectionJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "public", "data", "browse", "projection.json"), "utf-8")
  );
  const itemState = loadItemState({ projectRoot, runId, clipId: item.id });

  assert.equal(summary.writtenClips, 1);
  assert.equal(summary.indexCount, 1);
  assert.equal(clipJson.lqipBase64, "data:image/jpeg;base64,abc");
  assert.equal(indexJson.totalCount, 1);
  assert.equal(summaryJson.length, 1);
  assert.equal(projectionJson.length, 1);
  assert.equal(itemState.artifacts.status, "completed");
  assert.deepEqual(itemState.artifacts.relatedInput.previous, null);
  assert.deepEqual(itemState.artifacts.relatedInput.next, {
    tags: ["arcane", "attack"],
    folders: ["F1"],
    category: "uncategorized",
  });
});

test("runArtifactStage stores previous related input when overwriting an existing clip", async () => {
  const projectRoot = createTempProject();
  const runId = "run-artifacts-2";
  const item = {
    id: "B1",
    name: "Blade Guard",
    ext: "mp4",
    size: 100,
    width: 640,
    height: 360,
    duration: 2,
    tags: ["guard", "blade"],
    folders: ["F2"],
    url: "",
    palettes: [],
    btime: 1,
    mtime: 2,
    _mediaPath: "/library/B1.mp4",
    _thumbnailPath: "/library/B1_thumbnail.png",
  };
  saveMediaState(projectRoot, runId, item, "data:image/jpeg;base64,xyz");

  fs.writeFileSync(
    path.join(projectRoot, "public", "data", "clips", "B1.json"),
    JSON.stringify({
      id: "B1",
      tags: ["old-tag"],
      folders: ["OLD-FOLDER"],
      category: "legacy",
    })
  );

  await runArtifactStage([item], { projectRoot, runId });

  const itemState = loadItemState({ projectRoot, runId, clipId: item.id });
  assert.deepEqual(itemState.artifacts.relatedInput.previous, {
    tags: ["old-tag"],
    folders: ["OLD-FOLDER"],
    category: "legacy",
  });
  assert.deepEqual(itemState.artifacts.relatedInput.next, {
    tags: ["blade", "guard"],
    folders: ["F2"],
    category: "uncategorized",
  });
});
