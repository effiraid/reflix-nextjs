import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadItemState } from "./export-run-state.mjs";
import { runUploadStage } from "./export-upload-stage.mjs";

const validEnv = {
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_NAME: "reflix-media",
};

function createTempProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-upload-stage-"));
  fs.mkdirSync(path.join(projectRoot, "public", "videos"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "previews"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "thumbnails"), { recursive: true });
  return projectRoot;
}

function writeMediaFiles(projectRoot, clipId) {
  fs.writeFileSync(path.join(projectRoot, "public", "videos", `${clipId}.mp4`), "video");
  fs.writeFileSync(path.join(projectRoot, "public", "previews", `${clipId}.mp4`), "preview");
  fs.writeFileSync(path.join(projectRoot, "public", "thumbnails", `${clipId}.webp`), "thumbnail");
}

test("runUploadStage retries failed files on resume without reuploading completed entries", async () => {
  const projectRoot = createTempProject();
  const runId = "run-upload-1";
  const clipId = "A1";
  writeMediaFiles(projectRoot, clipId);

  const failingClient = {
    async send(command) {
      if (command.constructor?.name === "HeadObjectCommand") {
        const error = new Error("missing");
        error.name = "NotFound";
        throw error;
      }

      if (command.constructor?.name === "PutObjectCommand") {
        if (command.input.Key === "previews/A1.mp4") {
          throw new Error("network");
        }
        return {};
      }

      throw new Error(`Unexpected command: ${command.constructor?.name}`);
    },
  };

  const first = await runUploadStage([clipId], {
    projectRoot,
    runId,
    env: validEnv,
    client: failingClient,
    concurrency: 2,
  });

  const healedClient = {
    async send(command) {
      if (command.constructor?.name === "HeadObjectCommand") {
        const error = new Error("missing");
        error.name = "NotFound";
        throw error;
      }

      if (command.constructor?.name === "PutObjectCommand") {
        return {};
      }

      throw new Error(`Unexpected command: ${command.constructor?.name}`);
    },
  };

  const second = await runUploadStage([clipId], {
    projectRoot,
    runId,
    env: validEnv,
    client: healedClient,
    concurrency: 2,
  });

  assert.equal(first.uploaded, 2);
  assert.equal(first.failed, 1);
  assert.equal(second.reused, 2);
  assert.equal(second.uploaded, 1);
  assert.equal(second.failed, 0);
  assert.equal(loadItemState({ projectRoot, runId, clipId }).upload.status, "completed");
});

test("runUploadStage respects the configured concurrency limit", async () => {
  const projectRoot = createTempProject();
  const runId = "run-upload-2";
  const clipIds = ["B1", "B2"];
  clipIds.forEach((clipId) => writeMediaFiles(projectRoot, clipId));

  let active = 0;
  let maxActive = 0;
  const client = {
    async send(command) {
      if (command.constructor?.name === "HeadObjectCommand") {
        const error = new Error("missing");
        error.name = "NotFound";
        throw error;
      }

      if (command.constructor?.name === "PutObjectCommand") {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return {};
      }

      throw new Error(`Unexpected command: ${command.constructor?.name}`);
    },
  };

  const summary = await runUploadStage(clipIds, {
    projectRoot,
    runId,
    env: validEnv,
    client,
    concurrency: 2,
  });

  assert.equal(summary.uploaded, 6);
  assert.equal(maxActive, 2);
});
