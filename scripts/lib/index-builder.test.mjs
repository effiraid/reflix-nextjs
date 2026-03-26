import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildClipIndex,
  buildFullClip,
  writeOutputFiles,
} from "./index-builder.mjs";

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

test("buildClipIndex preserves AI-generated tags when present", () => {
  const aiTags = {
    actionType: ["베기"],
    emotion: ["결의"],
    composition: ["클로즈업"],
    pacing: "빠름",
    characterType: ["전사"],
    effects: ["잔상"],
    description: {
      ko: "대검을 크게 휘두르는 공격 모션",
      en: "A fast greatsword attack",
    },
    model: "gemini-2.5-flash",
    generatedAt: "2026-03-26T00:00:00.000Z",
  };

  const clip = buildClipIndex(
    {
      id: "CLIP_AI",
      name: "AI 클립",
      tags: ["검"],
      folders: [],
      aiTags,
    },
    "data:image/jpeg;base64,abc"
  );

  assert.deepEqual(clip.aiTags, aiTags);
});

test("buildFullClip preserves AI-generated tags when present", () => {
  const aiTags = {
    actionType: ["베기"],
    emotion: ["결의"],
    composition: ["클로즈업"],
    pacing: "빠름",
    characterType: ["전사"],
    effects: ["잔상"],
    description: {
      ko: "대검을 크게 휘두르는 공격 모션",
      en: "A fast greatsword attack",
    },
    model: "gemini-2.5-flash",
    generatedAt: "2026-03-26T00:00:00.000Z",
  };

  const clip = buildFullClip(
    {
      id: "CLIP_AI",
      name: "AI 클립",
      tags: ["검"],
      folders: [],
      aiTags,
    },
    "data:image/jpeg;base64,abc"
  );

  assert.deepEqual(clip.aiTags, aiTags);
});

test("writeOutputFiles merges new entries into an existing index", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-index-builder-"));
  fs.mkdirSync(path.join(tmpDir, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "public", "data", "clips"), { recursive: true });

  try {
    fs.writeFileSync(
      path.join(tmpDir, "src", "data", "index.json"),
      JSON.stringify({
        clips: [
          {
            id: "A",
            name: "Clip A",
            tags: ["old"],
            folders: [],
            star: 0,
            category: "uncategorized",
            width: 640,
            height: 360,
            duration: 1,
            previewUrl: "/previews/A.mp4",
            thumbnailUrl: "/thumbnails/A.webp",
            lqipBase64: "",
          },
          {
            id: "B",
            name: "Clip B",
            tags: ["old"],
            folders: [],
            star: 0,
            category: "uncategorized",
            width: 640,
            height: 360,
            duration: 1,
            previewUrl: "/previews/B.mp4",
            thumbnailUrl: "/thumbnails/B.webp",
            lqipBase64: "",
          },
        ],
        totalCount: 2,
        generatedAt: "2026-01-01T00:00:00.000Z",
      })
    );

    writeOutputFiles(
      [
        { id: "B", relatedClips: [] },
        { id: "C", relatedClips: [] },
      ],
      [
        {
          id: "B",
          name: "Clip B Updated",
          tags: ["new"],
          folders: [],
          star: 3,
          category: "uncategorized",
          width: 640,
          height: 360,
          duration: 1,
          previewUrl: "/previews/B.mp4",
          thumbnailUrl: "/thumbnails/B.webp",
          lqipBase64: "",
        },
        {
          id: "C",
          name: "Clip C",
          tags: ["new"],
          folders: [],
          star: 0,
          category: "uncategorized",
          width: 640,
          height: 360,
          duration: 2,
          previewUrl: "/previews/C.mp4",
          thumbnailUrl: "/thumbnails/C.webp",
          lqipBase64: "",
        },
      ],
      tmpDir
    );

    const result = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "src", "data", "index.json"), "utf-8")
    );

    assert.equal(result.totalCount, 3);
    assert.equal(result.clips.length, 3);
    assert.equal(result.clips.find((clip) => clip.id === "A")?.name, "Clip A");
    assert.equal(result.clips.find((clip) => clip.id === "B")?.name, "Clip B Updated");
    assert.equal(result.clips.find((clip) => clip.id === "B")?.star, 3);
    assert.equal(result.clips.find((clip) => clip.id === "C")?.name, "Clip C");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("writeOutputFiles writes a fresh index when no prior index exists", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-index-builder-"));
  fs.mkdirSync(path.join(tmpDir, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "public", "data", "clips"), { recursive: true });

  try {
    writeOutputFiles(
      [{ id: "X", relatedClips: [] }],
      [
        {
          id: "X",
          name: "Clip X",
          tags: [],
          folders: [],
          star: 0,
          category: "uncategorized",
          width: 640,
          height: 360,
          duration: 1,
          previewUrl: "/previews/X.mp4",
          thumbnailUrl: "/thumbnails/X.webp",
          lqipBase64: "",
        },
      ],
      tmpDir
    );

    const result = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "src", "data", "index.json"), "utf-8")
    );

    assert.equal(result.totalCount, 1);
    assert.equal(result.clips[0].id, "X");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("writeOutputFiles throws when the existing index is corrupt", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-index-builder-"));
  fs.mkdirSync(path.join(tmpDir, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "public", "data", "clips"), { recursive: true });

  try {
    fs.writeFileSync(path.join(tmpDir, "src", "data", "index.json"), "NOT_JSON{{{");

    assert.throws(() => {
      writeOutputFiles([], [], tmpDir);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
