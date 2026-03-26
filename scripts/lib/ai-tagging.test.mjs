import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAiTagPrompt,
  extractJsonObject,
  normalizeAiTags,
} from "./ai-tagging.mjs";

test("buildAiTagPrompt includes clip context and JSON-only instruction", () => {
  const prompt = buildAiTagPrompt({
    clipName: "연출 테스트 클립",
    existingTags: ["연출", "아픔"],
  });

  assert.match(prompt, /연출 테스트 클립/);
  assert.match(prompt, /연출, 아픔/);
  assert.match(prompt, /JSON만 반환/);
});

test("extractJsonObject unwraps fenced JSON responses", () => {
  const raw = '```json\n{"pacing":"느림","emotion":["고통"]}\n```';

  assert.deepEqual(extractJsonObject(raw), {
    pacing: "느림",
    emotion: ["고통"],
  });
});

test("normalizeAiTags trims values and fills metadata", () => {
  const result = normalizeAiTags(
    {
      actionType: [" 일어나기 ", "", "일어나기"],
      emotion: [" 고통 "],
      composition: ["미디엄샷"],
      pacing: " 느림 ",
      characterType: [" 마법사 "],
      effects: [" 잔상 "],
      description: {
        ko: " 큰 충격 뒤 비틀거리며 일어나는 장면 ",
        en: " A staggered recovery motion ",
      },
    },
    {
      model: "gemini-2.5-flash",
      generatedAt: "2026-03-26T23:30:00.000Z",
    }
  );

  assert.deepEqual(result, {
    actionType: ["일어나기"],
    emotion: ["고통"],
    composition: ["미디엄샷"],
    pacing: "느림",
    characterType: ["마법사"],
    effects: ["잔상"],
    description: {
      ko: "큰 충격 뒤 비틀거리며 일어나는 장면",
      en: "A staggered recovery motion",
    },
    model: "gemini-2.5-flash",
    generatedAt: "2026-03-26T23:30:00.000Z",
  });
});

test("normalizeAiTags rejects incomplete descriptions", () => {
  assert.throws(
    () =>
      normalizeAiTags(
        {
          actionType: [],
          emotion: [],
          composition: [],
          pacing: "보통",
          characterType: [],
          effects: [],
          description: { ko: "", en: "English only" },
        },
        {
          model: "gemini-2.5-flash",
          generatedAt: "2026-03-26T23:30:00.000Z",
        }
      ),
    /description/
  );
});
