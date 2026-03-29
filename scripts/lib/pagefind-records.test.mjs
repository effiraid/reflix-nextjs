import test from "node:test";
import assert from "node:assert/strict";
import { getChoseong, convertQwertyToHangul } from "es-hangul";

import { buildPagefindRecords } from "./pagefind-records.mjs";

test("buildPagefindRecords emits ko and en records with clip metadata", () => {
  const entry = {
    id: "clip-1",
    name: "연출 아케인 힘듦 일어나기 비몽사몽 비틀비틀 아픔",
    tags: ["아케인", "일어나기", "힘듦", "아픔"],
    aiTags: {
      actionType: ["일어나기", "비틀거리기"],
      emotion: ["아픔"],
      composition: ["미디엄 샷"],
      pacing: "느림",
      characterType: ["남성"],
      effects: ["어두운 조명"],
      description: {
        ko: "클립 설명",
        en: "clip description",
      },
      model: "test",
      generatedAt: "2026-03-29T00:00:00.000Z",
    },
    folders: ["folder-1"],
    category: "pain",
  };

  const tagI18n = {
    아케인: "Arcane",
    일어나기: "Waking Up",
    힘듦: "Difficulty",
    아픔: "Pain",
    비틀거리기: "Staggering",
    "미디엄 샷": "Medium Shot",
    느림: "Slow",
    남성: "Male",
    "어두운 조명": "Dark Lighting",
  };

  const records = buildPagefindRecords([entry], tagI18n);

  assert.equal(records.length, 2);

  const koRecord = records.find((record) => record.language === "ko");
  const enRecord = records.find((record) => record.language === "en");

  assert.ok(koRecord);
  assert.ok(enRecord);

  assert.equal(koRecord.url, "/ko/clip/clip-1");
  assert.equal(enRecord.url, "/en/clip/clip-1");
  assert.equal(koRecord.meta.clipId, "clip-1");
  assert.equal(enRecord.meta.clipId, "clip-1");

  assert.match(koRecord.content, /연출 아케인 힘듦 일어나기 비몽사몽 비틀비틀 아픔/);
  assert.match(koRecord.content, /아케인/);
  assert.match(koRecord.content, /비틀거리기/);

  assert.match(enRecord.content, /연출 아케인 힘듦 일어나기 비몽사몽 비틀비틀 아픔/);
  assert.match(enRecord.content, /Arcane/);
  assert.match(enRecord.content, /Waking Up/);
  assert.match(enRecord.content, /Pain/);
  assert.match(enRecord.content, /Medium Shot/);
  assert.match(enRecord.content, /Slow/);
  assert.match(enRecord.content, /Male/);
  assert.match(enRecord.content, /Dark Lighting/);

  const forbiddenChoseong = getChoseong(entry.name);
  const forbiddenQwerty = convertQwertyToHangul("akqjq");

  for (const record of records) {
    assert.equal(record.content.includes(forbiddenChoseong), false);
    assert.equal(record.content.includes(forbiddenQwerty), false);
  }
});
