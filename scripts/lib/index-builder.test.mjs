import test from "node:test";
import assert from "node:assert/strict";

import { buildClipIndex, buildFullClip } from "./index-builder.mjs";

test("buildClipIndex excludes internal reflix operation tags from public index entries", () => {
  const clip = buildClipIndex(
    {
      id: "CLIP_1",
      name: "테스트 클립",
      tags: ["연출", "reflix:approved", "표정", "reflix:published"],
      folders: ["folder-1"],
      star: 3,
      width: 640,
      height: 360,
      duration: 1.2,
    },
    "data:image/jpeg;base64,abc"
  );

  assert.deepEqual(clip.tags, ["연출", "표정"]);
});

test("buildFullClip excludes internal reflix operation tags from public clip payloads", () => {
  const clip = buildFullClip(
    {
      id: "CLIP_1",
      name: "테스트 클립",
      tags: ["연출", "reflix:approved", "표정", "reflix:published"],
      folders: ["folder-1"],
      star: 3,
      width: 640,
      height: 360,
      duration: 1.2,
    },
    "data:image/jpeg;base64,abc"
  );

  assert.deepEqual(clip.tags, ["연출", "표정"]);
});
