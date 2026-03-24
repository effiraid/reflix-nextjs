import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createR2ClientFromEnv,
  getContentTypeForKey,
  toR2ObjectKey,
  uploadBatch,
} from "./r2-uploader.mjs";

const validEnv = {
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_NAME: "reflix-media",
};

test("createR2ClientFromEnv rejects missing required env vars", () => {
  assert.throws(
    () =>
      createR2ClientFromEnv({
        ...validEnv,
        R2_ACCOUNT_ID: "",
      }),
    /R2_ACCOUNT_ID/
  );
});

test("toR2ObjectKey preserves the relative media contract", () => {
  assert.equal(toR2ObjectKey("/videos/clip-1.mp4"), "videos/clip-1.mp4");
  assert.equal(toR2ObjectKey("previews/clip-1.mp4"), "previews/clip-1.mp4");
  assert.equal(
    toR2ObjectKey("/thumbnails/clip-1.webp"),
    "thumbnails/clip-1.webp"
  );
});

test("getContentTypeForKey maps known media extensions", () => {
  assert.equal(getContentTypeForKey("videos/clip-1.mp4"), "video/mp4");
  assert.equal(getContentTypeForKey("thumbnails/clip-1.webp"), "image/webp");
  assert.equal(getContentTypeForKey("data/clip.json"), "application/json");
});

test("uploadBatch returns a dry-run summary without calling the client", async () => {
  let sendCalls = 0;
  const client = {
    async send() {
      sendCalls += 1;
      throw new Error("dry run should not upload");
    },
  };

  const summary = await uploadBatch(
    [
      {
        localPath: "/tmp/clip-1.mp4",
        publicPath: "/videos/clip-1.mp4",
      },
      {
        localPath: "/tmp/clip-1.webp",
        publicPath: "/thumbnails/clip-1.webp",
      },
    ],
    {
      dryRun: true,
      env: validEnv,
      client,
    }
  );

  assert.equal(sendCalls, 0);
  assert.equal(summary.total, 2);
  assert.equal(summary.uploaded, 0);
  assert.equal(summary.skipped, 2);
  assert.deepEqual(
    summary.entries.map((entry) => ({
      key: entry.key,
      contentType: entry.contentType,
      dryRun: entry.dryRun,
    })),
    [
      {
        key: "videos/clip-1.mp4",
        contentType: "video/mp4",
        dryRun: true,
      },
      {
        key: "thumbnails/clip-1.webp",
        contentType: "image/webp",
        dryRun: true,
      },
    ]
  );
});

test("uploadBatch dry-run does not require real R2 credentials", async () => {
  const summary = await uploadBatch(
    [
      {
        localPath: "/tmp/clip-1.mp4",
        publicPath: "/videos/clip-1.mp4",
      },
    ],
    {
      dryRun: true,
      env: {},
    }
  );

  assert.equal(summary.total, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 0);
});

test("uploadBatch records failed uploads and continues with later entries", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-r2-upload-"));
  const firstFile = path.join(tmpDir, "clip-1.mp4");
  const secondFile = path.join(tmpDir, "clip-2.webp");
  fs.writeFileSync(firstFile, "video");
  fs.writeFileSync(secondFile, "thumb");

  let sendCalls = 0;
  const client = {
    async send() {
      sendCalls += 1;
      if (sendCalls === 1) {
        throw new Error("network");
      }
    },
  };

  const summary = await uploadBatch(
    [
      {
        localPath: firstFile,
        publicPath: "/videos/clip-1.mp4",
      },
      {
        localPath: secondFile,
        publicPath: "/thumbnails/clip-2.webp",
      },
    ],
    {
      env: validEnv,
      client,
    }
  );

  assert.equal(summary.uploaded, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.entries[0].status, "failed");
  assert.equal(summary.entries[1].status, "uploaded");
});
