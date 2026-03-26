import test from "node:test";
import assert from "node:assert/strict";

import {
  applyRuleBasedTranslations,
  collectTranslatableTags,
  mergeTagI18n,
  parseTagTranslateArgs,
  runTagTranslate,
  validateEnglishLabel,
} from "./tag-translation.mjs";

test("collectTranslatableTags pulls manual and AI structured tags from clip data", () => {
  const tags = collectTranslatableTags({
    clips: [
      {
        tags: ["고통", "연출"],
        aiTags: {
          actionType: ["비틀거리기"],
          emotion: ["고통"],
          composition: ["미디엄샷"],
          pacing: "느림",
          characterType: ["마법사"],
          effects: ["잔상"],
        },
      },
    ],
  });

  assert.deepEqual(tags, [
    "고통",
    "느림",
    "마법사",
    "미디엄샷",
    "비틀거리기",
    "연출",
    "잔상",
  ]);
});

test("applyRuleBasedTranslations resolves glossary and normalize before AI fallback", () => {
  const rules = {
    glossary: {
      고통: "Suffering",
      연출: "Direction",
      비틀거리기: "Staggering",
    },
    preserve: ["Arcane", "POV"],
    normalize: { 비틀비틀: "비틀거리기" },
    style: { maxWords: 3, titleCase: true },
  };

  assert.deepEqual(
    applyRuleBasedTranslations(["고통", "비틀비틀", "Arcane", "혼미"], rules),
    {
      translations: {
        고통: "Suffering",
        비틀비틀: "Staggering",
        Arcane: "Arcane",
      },
      unresolved: ["혼미"],
      normalized: { 비틀비틀: "비틀거리기" },
    }
  );
});

test("validateEnglishLabel keeps acronyms while rejecting korean output and long labels", () => {
  assert.equal(validateEnglishLabel("medium shot"), "Medium Shot");
  assert.equal(validateEnglishLabel("POV"), "POV");
  assert.throws(() => validateEnglishLabel("미디엄샷"), /English label/i);
  assert.throws(
    () => validateEnglishLabel("This is much too long for a chip label"),
    /short/i
  );
});

test("mergeTagI18n preserves existing values while adding new sorted entries", () => {
  assert.deepEqual(
    mergeTagI18n(
      { 고통: "Suffering", 연출: "Direction" },
      { 연출: "Staging", 비틀거리기: "Staggering" }
    ),
    {
      고통: "Suffering",
      비틀거리기: "Staggering",
      연출: "Direction",
    }
  );
});

test("parseTagTranslateArgs understands dry-run, only-new, clip-id, and model flags", () => {
  assert.deepEqual(
    parseTagTranslateArgs([
      "--dry-run",
      "--only-new",
      "--clip-id",
      "L3TR52T22TPVR",
      "--model",
      "gemini-2.5-flash-lite",
    ]),
    {
      dryRun: true,
      onlyNew: true,
      clipId: "L3TR52T22TPVR",
      model: "gemini-2.5-flash-lite",
      write: false,
    }
  );
});

test("parseTagTranslateArgs understands explicit write mode", () => {
  assert.deepEqual(parseTagTranslateArgs(["--write"]), {
    dryRun: false,
    onlyNew: false,
    clipId: null,
    model: "gemini-2.5-flash",
    write: true,
  });
});

test("runTagTranslate resolves normalized aliases from existing translations during dry-run", async () => {
  let translateCalled = false;

  const summary = await runTagTranslate({
    indexData: {
      clips: [
        {
          id: "clip-1",
          tags: ["고통", "비틀비틀"],
          aiTags: {
            actionType: ["비틀거리기"],
            emotion: ["혼미"],
            composition: [],
            pacing: "",
            characterType: [],
            effects: [],
          },
        },
      ],
    },
    existingTagI18n: {
      고통: "Suffering",
      비틀거리기: "Staggering",
    },
    rules: {
      glossary: {},
      preserve: [],
      normalize: { 비틀비틀: "비틀거리기" },
      style: { maxWords: 3, titleCase: true },
    },
    dryRun: true,
    translateMissingTags: async () => {
      translateCalled = true;
      return {};
    },
  });

  assert.equal(translateCalled, false);
  assert.equal(summary.wroteFile, false);
  assert.deepEqual(summary.pendingAiTags, ["혼미"]);
  assert.deepEqual(summary.translatedTags, {
    고통: "Suffering",
    비틀거리기: "Staggering",
    비틀비틀: "Staggering",
  });
});

test("runTagTranslate writes validated AI translations when writing is enabled", async () => {
  const writes = [];

  const summary = await runTagTranslate({
    indexData: {
      clips: [
        {
          id: "clip-1",
          tags: ["고통"],
          aiTags: {
            actionType: ["비틀거리기"],
            emotion: ["혼미"],
            composition: [],
            pacing: "",
            characterType: [],
            effects: [],
          },
        },
      ],
    },
    existingTagI18n: {
      고통: "Suffering",
    },
    rules: {
      glossary: {},
      preserve: [],
      normalize: {},
      style: { maxWords: 3, titleCase: true },
    },
    dryRun: false,
    outputPath: "src/data/tag-i18n.json",
    writeFile: (filePath, content) => writes.push({ filePath, content }),
    translateMissingTags: async () => ({
      비틀거리기: "staggering",
      혼미: "dazed",
    }),
  });

  assert.equal(summary.wroteFile, true);
  assert.deepEqual(summary.pendingAiTags, ["비틀거리기", "혼미"]);
  assert.match(writes[0].filePath, /src\/data\/tag-i18n\.json$/);
  assert.match(writes[0].content, /"비틀거리기": "Staggering"/);
  assert.match(writes[0].content, /"혼미": "Dazed"/);
});
