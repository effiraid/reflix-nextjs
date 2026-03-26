# Reflix EN Tag Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rules-first English tag translation pipeline that writes `src/data/tag-i18n.json` and uses those labels consistently across browse, quick view, detail, and AI tag surfaces without changing Korean canonical tags.

**Architecture:** Introduce a standalone Node CLI (`npm run tags:translate`) that reads `src/data/index.json`, applies deterministic translation rules from `scripts/config/tag-translation-rules.json`, sends only unresolved tags to Gemini, validates the English labels, and writes a stable `src/data/tag-i18n.json`. In the app, add a shared tag display helper and thread `tagI18n` into every tag-rendering surface so manual tags and AI structured tags resolve through the same English map while filters and URLs continue storing Korean keys.

**Tech Stack:** Node.js scripts, Gemini REST API, Next.js 16 App Router, React 19, Vitest, node:test

---

**Working tree note:** The repository is already dirty. Do not stage or revert unrelated files. Every commit in this plan stages only the files listed in the task.

## File Map

- Create: `scripts/config/tag-translation-rules.json`
- Create: `scripts/tag-translate.mjs`
- Create: `scripts/lib/tag-translation.mjs`
- Create: `scripts/lib/tag-translation.test.mjs`
- Create: `src/lib/tagDisplay.ts`
- Create: `src/lib/tagDisplay.test.ts`
- Create: `src/components/clip/QuickViewModal.test.tsx`
- Create: `src/components/filter/ActiveFilters.test.tsx`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/lib/aiTags.ts`
- Modify: `src/lib/clipSearch.ts`
- Modify: `src/lib/clipSearch.test.ts`
- Modify: `src/components/filter/TagFilterPanel.tsx`
- Modify: `src/components/filter/TagFilterPanel.test.tsx`
- Modify: `src/components/filter/ActiveFilters.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.test.tsx`
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/components/clip/MasonryGrid.tsx`
- Modify: `src/components/clip/QuickViewModal.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `src/app/[lang]/browse/page.tsx`
- Modify: `src/components/layout/RightPanelContent.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`
- Modify: `src/components/layout/RightPanelInspector.test.tsx`
- Modify: `src/components/clip/ClipDetailView.tsx`
- Modify: `src/components/clip/ClipDetailView.test.tsx`
- Modify: `src/app/[lang]/clip/[id]/page.tsx`

## Preflight

- Before touching App Router files, read the relevant Next 16 guide under `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`.
- Before editing `src/app/[lang]/clip/[id]/page.tsx`, re-check `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` so the current async `params` and cache patterns stay intact.

### Task 1: Build the translation rule engine

**Files:**
- Create: `scripts/config/tag-translation-rules.json`
- Create: `scripts/lib/tag-translation.mjs`
- Create: `scripts/lib/tag-translation.test.mjs`

- [ ] **Step 1: Write the failing script tests**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  applyRuleBasedTranslations,
  collectTranslatableTags,
  mergeTagI18n,
  validateEnglishLabel,
} from "./tag-translation.mjs";

test("collectTranslatableTags pulls manual and ai structured tags from index.json data", () => {
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

test("applyRuleBasedTranslations resolves normalize, glossary, and preserve before AI", () => {
  const rules = {
    glossary: { 고통: "Suffering", 연출: "Direction", 비틀거리기: "Staggering" },
    preserve: ["Arcane", "POV"],
    normalize: { 비틀비틀: "비틀거리기" },
  };

  assert.deepEqual(
    applyRuleBasedTranslations(["고통", "비틀비틀", "Arcane"], rules),
    {
      translations: {
        고통: "Suffering",
        비틀비틀: "Staggering",
        Arcane: "Arcane",
      },
      unresolved: [],
      normalized: { 비틀비틀: "비틀거리기" },
    }
  );
});

test("validateEnglishLabel rejects Korean output and long sentence-like labels", () => {
  assert.equal(validateEnglishLabel("Medium Shot"), "Medium Shot");
  assert.throws(() => validateEnglishLabel("미디엄샷"), /english/i);
  assert.throws(() => validateEnglishLabel("This is much too long for a chip label"), /short/i);
});

test("mergeTagI18n preserves stable existing values when no override is requested", () => {
  assert.deepEqual(
    mergeTagI18n(
      { 고통: "Suffering", 연출: "Direction" },
      { 연출: "Staging", 비틀거리기: "Staggering" }
    ),
    {
      고통: "Suffering",
      연출: "Direction",
      비틀거리기: "Staggering",
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/tag-translation.test.mjs`

Expected: FAIL with `Cannot find module '/.../scripts/lib/tag-translation.mjs'`

- [ ] **Step 3: Write the minimal implementation**

```json
{
  "glossary": {
    "고통": "Suffering",
    "연출": "Direction",
    "마법사": "Mage",
    "미디엄샷": "Medium Shot",
    "느림": "Slow",
    "잔상": "Afterimage",
    "피로감": "Fatigue",
    "비틀거리기": "Staggering"
  },
  "preserve": ["Arcane", "POV", "PV", "2D"],
  "normalize": {
    "비틀비틀": "비틀거리기",
    "일어서기": "일어나기"
  },
  "style": {
    "maxWords": 3,
    "titleCase": true
  }
}
```

```js
import fs from "node:fs";

function uniqSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"));
}

export function collectTranslatableTags(indexData) {
  const tags = [];
  for (const clip of indexData?.clips ?? []) {
    tags.push(...(clip.tags ?? []));
    if (!clip.aiTags) continue;
    tags.push(
      ...(clip.aiTags.actionType ?? []),
      ...(clip.aiTags.emotion ?? []),
      ...(clip.aiTags.composition ?? []),
      clip.aiTags.pacing,
      ...(clip.aiTags.characterType ?? []),
      ...(clip.aiTags.effects ?? [])
    );
  }
  return uniqSorted(tags.map((tag) => String(tag ?? "").trim()));
}

function titleCaseLabel(value) {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function validateEnglishLabel(label, style = { maxWords: 3, titleCase: true }) {
  const trimmed = String(label ?? "").trim();
  if (!trimmed) throw new Error("English label is required");
  if (/[가-힣]/.test(trimmed)) throw new Error("English label must not contain Korean");
  if (trimmed.split(/\s+/).length > style.maxWords) throw new Error("English label must stay short");
  return style.titleCase ? titleCaseLabel(trimmed) : trimmed;
}

export function applyRuleBasedTranslations(tags, rules) {
  const translations = {};
  const unresolved = [];
  const normalized = {};

  for (const tag of tags) {
    if (rules.glossary?.[tag]) {
      translations[tag] = validateEnglishLabel(rules.glossary[tag], rules.style);
      continue;
    }

    if (rules.preserve?.includes(tag) || /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(tag)) {
      translations[tag] = validateEnglishLabel(tag, rules.style);
      continue;
    }

    const normalizedTag = rules.normalize?.[tag];
    if (normalizedTag) {
      normalized[tag] = normalizedTag;
      if (rules.glossary?.[normalizedTag]) {
        translations[tag] = validateEnglishLabel(rules.glossary[normalizedTag], rules.style);
      } else {
        unresolved.push(normalizedTag);
      }
      continue;
    }

    unresolved.push(tag);
  }

  return {
    translations,
    unresolved: uniqSorted(unresolved),
    normalized,
  };
}

export function mergeTagI18n(existing, next) {
  const merged = { ...existing };
  for (const [tag, label] of Object.entries(next)) {
    if (!merged[tag]) merged[tag] = label;
  }
  return Object.fromEntries(
    Object.entries(merged).sort(([left], [right]) => left.localeCompare(right, "ko"))
  );
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/tag-translation.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/config/tag-translation-rules.json scripts/lib/tag-translation.mjs scripts/lib/tag-translation.test.mjs
git commit -m "feat: add tag translation rule engine"
```

### Task 2: Add the `tags:translate` CLI and operator docs

**Files:**
- Create: `scripts/tag-translate.mjs`
- Modify: `scripts/lib/tag-translation.mjs`
- Modify: `scripts/lib/tag-translation.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Extend the failing tests for CLI parsing and dry-run behavior**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  parseTagTranslateArgs,
  runTagTranslate,
} from "./tag-translation.mjs";

test("parseTagTranslateArgs understands dry-run and only-new flags", () => {
  assert.deepEqual(
    parseTagTranslateArgs(["--dry-run", "--only-new", "--clip-id", "L3TR52T22TPVR"]),
    {
      dryRun: true,
      onlyNew: true,
      clipId: "L3TR52T22TPVR",
      model: "gemini-2.5-flash",
      write: false,
    }
  );
});

test("runTagTranslate returns unresolved tags without writing files during dry-run", async () => {
  const writes = [];
  const summary = await runTagTranslate({
    indexData: {
      clips: [{ tags: ["고통"], aiTags: { actionType: ["비틀거리기"], emotion: [], composition: [], pacing: "", characterType: [], effects: [] } }],
    },
    existingTagI18n: { 고통: "Suffering" },
    rules: {
      glossary: { 고통: "Suffering" },
      preserve: [],
      normalize: {},
      style: { maxWords: 3, titleCase: true },
    },
    dryRun: true,
    writeFile: (filePath, content) => writes.push({ filePath, content }),
  });

  assert.equal(summary.wroteFile, false);
  assert.deepEqual(summary.translatedTags, { 고통: "Suffering" });
  assert.deepEqual(summary.missing, ["비틀거리기"]);
  assert.deepEqual(writes, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/tag-translation.test.mjs`

Expected: FAIL with `parseTagTranslateArgs is not a function` or `runTagTranslate is not a function`

- [ ] **Step 3: Implement CLI parsing, Gemini fallback, and package wiring**

```js
import fs from "node:fs";
import { extractJsonObject } from "./ai-tagging.mjs";

export const DEFAULT_TAG_TRANSLATION_MODEL = "gemini-2.5-flash";

export function parseTagTranslateArgs(argv = process.argv.slice(2)) {
  const clipIdIndex = argv.indexOf("--clip-id");
  const modelIndex = argv.indexOf("--model");
  return {
    dryRun: argv.includes("--dry-run"),
    onlyNew: argv.includes("--only-new"),
    clipId: clipIdIndex !== -1 ? argv[clipIdIndex + 1] : null,
    model: modelIndex !== -1 ? argv[modelIndex + 1] : DEFAULT_TAG_TRANSLATION_MODEL,
    write: argv.includes("--write"),
  };
}

export async function translateMissingTagsWithGemini(tags, { apiKey, model, fetchImpl = fetch }) {
  if (tags.length === 0) return {};
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for unresolved tag translation");

  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "Translate Korean game animation tags into short English UI chip labels.",
                  "Return JSON only as {\"<ko-tag>\": \"<English Label>\"}.",
                  "Each label must be 1-3 words and Title Case.",
                  ...tags.map((tag) => `- ${tag}`),
                ].join("\n"),
              },
            ],
          },
        ],
      }),
    }
  );

  const payload = await response.json();
  const text = (payload?.candidates ?? [])
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => part?.text)
    .filter(Boolean)
    .join("\n");

  return extractJsonObject(text);
}

export async function runTagTranslate({
  indexData,
  existingTagI18n,
  rules,
  dryRun,
  writeFile = (filePath, content) => fs.writeFileSync(filePath, content),
  translateMissingTags = translateMissingTagsWithGemini,
  outputPath = "src/data/tag-i18n.json",
  apiKey = process.env.GEMINI_API_KEY,
  model = DEFAULT_TAG_TRANSLATION_MODEL,
}) {
  const tags = collectTranslatableTags(indexData);
  const { translations: ruleTranslations, unresolved, normalized } =
    applyRuleBasedTranslations(tags, rules);
  const missing = unresolved.filter((tag) => !existingTagI18n[tag]);
  const baseTranslations = mergeTagI18n(existingTagI18n, ruleTranslations);

  if (dryRun) {
    return { translatedTags: baseTranslations, wroteFile: false, missing };
  }

  const aiTranslations = await translateMissingTags(missing, { apiKey, model });

  const normalizedAiTranslations = Object.fromEntries(
    Object.entries(aiTranslations).map(([tag, label]) => [tag, validateEnglishLabel(label, rules.style)])
  );

  const translatedTags = mergeTagI18n(baseTranslations, {
    ...Object.fromEntries(
      Object.entries(normalized).flatMap(([original, canonical]) =>
        normalizedAiTranslations[canonical] ? [[original, normalizedAiTranslations[canonical]]] : []
      )
    ),
    ...normalizedAiTranslations,
  });
  writeFile(outputPath, `${JSON.stringify(translatedTags, null, 2)}\n`);

  return { translatedTags, wroteFile: true, missing };
}
```

```js
#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import {
  parseTagTranslateArgs,
  readJson,
  runTagTranslate,
} from "./lib/tag-translation.mjs";

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const flags = parseTagTranslateArgs();
  const indexData = readJson("src/data/index.json");
  const rules = readJson("scripts/config/tag-translation-rules.json");
  const existingTagI18n = readJson("src/data/tag-i18n.json");

  runTagTranslate({
    indexData,
    existingTagI18n,
    rules,
    dryRun: flags.dryRun || !flags.write,
    model: flags.model,
  }).then((summary) => {
    console.log(`Translated tags: ${Object.keys(summary.translatedTags).length}`);
    console.log(`Pending AI translations: ${summary.missing.length}`);
    console.log(summary.wroteFile ? "Updated src/data/tag-i18n.json" : "Dry run only");
  });
}
```

```json
{
  "scripts": {
    "tags:translate": "node scripts/tag-translate.mjs --write"
  }
}
```

```md
- `GEMINI_API_KEY` is required only for unresolved tags when running `npm run tags:translate`.
- Use `node scripts/tag-translate.mjs --dry-run` to preview new translations without writing `src/data/tag-i18n.json`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/tag-translation.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/tag-translate.mjs scripts/lib/tag-translation.mjs scripts/lib/tag-translation.test.mjs package.json README.md
git commit -m "feat: add tags translate command"
```

### Task 3: Add shared tag display and search helpers

**Files:**
- Create: `src/lib/tagDisplay.ts`
- Create: `src/lib/tagDisplay.test.ts`
- Modify: `src/lib/aiTags.ts`
- Modify: `src/lib/clipSearch.ts`
- Modify: `src/lib/clipSearch.test.ts`

- [ ] **Step 1: Write the failing Vitest coverage**

```ts
import { describe, expect, it } from "vitest";
import { getTagDisplayLabel, getTagDisplayLabels } from "./tagDisplay";

describe("tagDisplay", () => {
  it("uses English labels when lang is en and falls back to Korean when missing", () => {
    expect(getTagDisplayLabel("고통", "en", { 고통: "Suffering" })).toBe("Suffering");
    expect(getTagDisplayLabel("비틀거리기", "en", {})).toBe("비틀거리기");
    expect(getTagDisplayLabel("고통", "ko", { 고통: "Suffering" })).toBe("고통");
  });

  it("translates tag arrays in order", () => {
    expect(
      getTagDisplayLabels(["고통", "마법사"], "en", {
        고통: "Suffering",
        마법사: "Mage",
      })
    ).toEqual(["Suffering", "Mage"]);
  });
});
```

```ts
it("matches English AI tag labels when tag i18n contains AI structured tags", () => {
  const results = searchClips(clips, {
    lang: "en",
    query: "Staggering",
    tagI18n: {
      걷기: "Walk",
      슬픔: "Sadness",
      비틀거리기: "Staggering",
    },
  });

  expect(results.map((clip) => clip.id)).toContain("ai-hit");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec vitest run src/lib/tagDisplay.test.ts src/lib/clipSearch.test.ts`

Expected: FAIL with `Failed to resolve import "./tagDisplay"` and missing AI English search match

- [ ] **Step 3: Write the minimal implementation**

```ts
import type { Locale } from "./types";

export function getTagDisplayLabel(
  tag: string,
  lang: Locale,
  tagI18n: Record<string, string>
): string {
  if (lang !== "en") {
    return tag;
  }

  return tagI18n[tag]?.trim() || tag;
}

export function getTagDisplayLabels(
  tags: string[],
  lang: Locale,
  tagI18n: Record<string, string>
): string[] {
  return tags.map((tag) => getTagDisplayLabel(tag, lang, tagI18n));
}
```

```ts
import { getTagDisplayLabels } from "./tagDisplay";

export function getClipSearchTargets(
  clip: {
    name: string;
    tags?: string[];
    aiTags?: AIGeneratedTags | null;
  },
  tagI18n: Record<string, string>
): string[] {
  const manualTags = clip.tags ?? [];
  const aiTags = getStructuredAiTags(clip.aiTags);
  const translatedManualTags = getTagDisplayLabels(manualTags, "en", tagI18n);
  const translatedAiTags = getTagDisplayLabels(aiTags, "en", tagI18n);
  const descriptions = clip.aiTags
    ? [clip.aiTags.description.ko, clip.aiTags.description.en]
    : [];

  return [
    clip.name,
    ...manualTags,
    ...translatedManualTags,
    ...aiTags,
    ...translatedAiTags,
    ...descriptions.filter(Boolean),
  ];
}
```

```ts
const aiStructuredTags = clip.aiTags ? getStructuredAiTags(clip.aiTags) : [];
const translatedAiStructuredTags = getTagDisplayLabels(aiStructuredTags, "en", tagI18n);

const candidates = [
  { value: clip.name, weight: 120 },
  ...manualTags.map((value) => ({ value, weight: 90 })),
  ...translatedTags.map((value) => ({ value, weight: 80 })),
  ...aiStructuredTags.map((value) => ({ value, weight: 70 })),
  ...translatedAiStructuredTags.map((value) => ({ value, weight: 70 })),
  ...descriptions.map((value) => ({ value, weight: mode === "semantic" ? 60 : 45 })),
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec vitest run src/lib/tagDisplay.test.ts src/lib/clipSearch.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tagDisplay.ts src/lib/tagDisplay.test.ts src/lib/aiTags.ts src/lib/clipSearch.ts src/lib/clipSearch.test.ts
git commit -m "feat: add shared english tag display helpers"
```

### Task 4: Translate browse, quick view, and filter surfaces

**Files:**
- Create: `src/components/clip/QuickViewModal.test.tsx`
- Create: `src/components/filter/ActiveFilters.test.tsx`
- Modify: `src/components/filter/TagFilterPanel.tsx`
- Modify: `src/components/filter/TagFilterPanel.test.tsx`
- Modify: `src/components/filter/ActiveFilters.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.tsx`
- Modify: `src/components/layout/MobileSearchOverlay.test.tsx`
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/components/clip/MasonryGrid.tsx`
- Modify: `src/components/clip/QuickViewModal.tsx`
- Modify: `src/app/[lang]/browse/BrowseClient.tsx`

- [ ] **Step 1: Write failing UI tests for English browse surfaces**

```tsx
it("renders AI-generated tags with english labels when lang is en", () => {
  render(
    <TagFilterPanel
      tagGroups={{ groups: [], parentGroups: [] }}
      lang="en"
      tagI18n={{
        걷기: "Walk",
        슬픔: "Sadness",
        풀샷: "Full Shot",
        느림: "Slow",
        전사: "Warrior",
        잔상: "Afterimage",
      }}
      dict={...}
      updateURL={vi.fn()}
    />
  );

  expect(screen.getByText("Sadness")).toBeInTheDocument();
  expect(screen.queryByText("슬픔")).not.toBeInTheDocument();
});
```

```tsx
it("shows translated tags in the mobile search result summary", () => {
  render(
    <MobileSearchOverlay
      open
      clips={clips}
      lang="en"
      tagI18n={{ 걷기: "Walk" }}
      placeholder="Search"
      closeLabel="Close"
      noResultsLabel="No results"
      onClose={vi.fn()}
      onSelectClip={vi.fn()}
    />
  );

  expect(screen.getByText(/Walk/)).toBeInTheDocument();
});
```

```tsx
it("shows translated tags inside quick view", () => {
  render(
    <QuickViewModal
      clip={clip}
      lang="en"
      tagI18n={{ 검: "Sword" }}
      dict={dict}
      onClose={vi.fn()}
    />
  );

  expect(screen.getByText("Sword")).toBeInTheDocument();
});
```

```tsx
it("formats selected and excluded filter chips with english labels", () => {
  useFilterStore.setState({
    selectedFolders: [],
    selectedTags: ["고통"],
    excludedTags: ["비틀거리기"],
    starFilter: null,
    searchQuery: "",
    sortBy: "newest",
    category: null,
  });

  render(
    <ActiveFilters
      tagI18n={{ 고통: "Suffering", 비틀거리기: "Staggering" }}
      lang="en"
      onClearAll={vi.fn()}
      onRemoveTag={vi.fn()}
      onRemoveExcludeTag={vi.fn()}
      onRemoveFolder={vi.fn()}
      onClearStar={vi.fn()}
      onClearCategory={vi.fn()}
    />
  );

  expect(screen.getByText("Suffering")).toBeInTheDocument();
  expect(screen.getByText("−Staggering")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec vitest run src/components/filter/TagFilterPanel.test.tsx src/components/layout/MobileSearchOverlay.test.tsx src/components/clip/QuickViewModal.test.tsx src/components/filter/ActiveFilters.test.tsx`

Expected: FAIL because the components still render raw Korean tags or do not accept `tagI18n`

- [ ] **Step 3: Write the minimal implementation**

```tsx
import { getTagDisplayLabel, getTagDisplayLabels } from "@/lib/tagDisplay";

const getDisplayTag = useCallback(
  (tag: string) => getTagDisplayLabel(tag, lang, tagI18n),
  [lang, tagI18n]
);
```

```tsx
interface ActiveFiltersProps {
  tagI18n: Record<string, string>;
  lang: Locale;
  onClearAll: () => void;
  onRemoveTag: (tag: string) => void;
  onRemoveExcludeTag: (tag: string) => void;
  onRemoveFolder: (folderId: string) => void;
  onClearStar: () => void;
  onClearCategory: () => void;
}

<FilterChip key={t} label={getTagDisplayLabel(t, lang, tagI18n)} onRemove={() => onRemoveTag(t)} />
<FilterChip
  key={`ex-${t}`}
  label={`−${getTagDisplayLabel(t, lang, tagI18n)}`}
  variant="exclude"
  onRemove={() => onRemoveExcludeTag(t)}
/>
```

```tsx
const tagSummary = getTagDisplayLabels(clip.tags, lang, tagI18n).join(" · ");

<p className="mt-1 line-clamp-2 text-xs text-muted">{tagSummary}</p>
```

```tsx
interface ClipCardProps {
  clip: ClipIndex;
  lang: Locale;
  tagI18n: Record<string, string>;
  ...
}

<span className="truncate">
  {getTagDisplayLabels(clip.tags, lang, tagI18n).join(", ")}
</span>
```

```tsx
<MasonryGrid
  clips={filtered}
  lang={lang}
  tagI18n={tagI18n}
  onOpenQuickView={openQuickViewForClip}
/>

<QuickViewModal
  clip={selectedClip}
  lang={lang}
  tagI18n={tagI18n}
  dict={dict}
  onClose={handleCloseQuickView}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec vitest run src/components/filter/TagFilterPanel.test.tsx src/components/layout/MobileSearchOverlay.test.tsx src/components/clip/QuickViewModal.test.tsx src/components/filter/ActiveFilters.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/filter/TagFilterPanel.tsx src/components/filter/TagFilterPanel.test.tsx src/components/filter/ActiveFilters.tsx src/components/filter/ActiveFilters.test.tsx src/components/layout/MobileSearchOverlay.tsx src/components/layout/MobileSearchOverlay.test.tsx src/components/clip/ClipCard.tsx src/components/clip/MasonryGrid.tsx src/components/clip/QuickViewModal.tsx src/components/clip/QuickViewModal.test.tsx src/app/[lang]/browse/BrowseClient.tsx
git commit -m "feat: translate browse and quick view tags"
```

### Task 5: Translate the right panel and detail page surfaces

**Files:**
- Modify: `src/app/[lang]/browse/page.tsx`
- Modify: `src/components/layout/RightPanelContent.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`
- Modify: `src/components/layout/RightPanelInspector.test.tsx`
- Modify: `src/app/[lang]/clip/[id]/page.tsx`
- Modify: `src/components/clip/ClipDetailView.tsx`
- Modify: `src/components/clip/ClipDetailView.test.tsx`

- [ ] **Step 1: Write failing tests for translated detail and inspector tags**

```tsx
it("renders translated manual and AI tags in the english inspector", async () => {
  render(
    <RightPanelInspector
      clip={{
        ...clip,
        tags: ["검"],
        aiTags: {
          actionType: ["비틀거리기"],
          emotion: ["고통"],
          composition: ["미디엄샷"],
          pacing: "느림",
          characterType: ["마법사"],
          effects: ["잔상"],
          description: { ko: "설명", en: "Description" },
          model: "gemini-2.5-flash",
          generatedAt: "2026-03-26T00:00:00.000Z",
        },
      }}
      categories={categories}
      lang="en"
      tagI18n={{
        검: "Sword",
        비틀거리기: "Staggering",
        고통: "Suffering",
        미디엄샷: "Medium Shot",
        느림: "Slow",
        마법사: "Mage",
        잔상: "Afterimage",
      }}
      dict={dict}
    />
  );

  expect(screen.getByText("Sword")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "AI Analysis" }));
  expect(screen.getByText("Staggering")).toBeInTheDocument();
  expect(screen.queryByText("비틀거리기")).not.toBeInTheDocument();
});
```

```tsx
it("renders translated english tags on the clip detail page", () => {
  render(
    <ClipDetailView
      clip={{ ...baseClip, tags: ["고통", "마법사"] }}
      lang="en"
      tagI18n={{ 고통: "Suffering", 마법사: "Mage" }}
      dict={dict}
      categories={categories}
    />
  );

  expect(screen.getByText("Suffering")).toBeInTheDocument();
  expect(screen.getByText("Mage")).toBeInTheDocument();
  expect(screen.queryByText("고통")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec vitest run src/components/layout/RightPanelInspector.test.tsx src/components/clip/ClipDetailView.test.tsx`

Expected: FAIL because `RightPanelInspector` and `ClipDetailView` still render raw Korean tags or do not accept `tagI18n`

- [ ] **Step 3: Write the minimal implementation**

```tsx
interface RightPanelContentProps {
  categories: CategoryTree;
  lang: Locale;
  dict: Dictionary;
  tagI18n: Record<string, string>;
}

<RightPanelInspector
  clip={activeClip}
  categories={categories}
  lang={lang}
  tagI18n={tagI18n}
  dict={dict}
  ...
/>
```

```tsx
interface RightPanelInspectorProps {
  clip: Clip;
  categories: CategoryTree;
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Pick<Dictionary, "clip">;
  ...
}

const tagItems = clip.tags.map((tag) => ({
  id: tag,
  label: getTagDisplayLabel(tag, lang, tagI18n),
}));
const aiTagTokens = getTagDisplayLabels(getStructuredAiTags(clip.aiTags), lang, tagI18n);
```

```tsx
interface ClipDetailViewProps {
  clip: Clip;
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Pick<Dictionary, "clip">;
  categories: CategoryTree;
}

const displayTags = getTagDisplayLabels(clip.tags, lang, tagI18n);
const aiTagTokens = getTagDisplayLabels(getStructuredAiTags(clip.aiTags), lang, tagI18n);

<TokenSection label={dict.clip.tags} items={displayTags} />
```

```tsx
const [clip, dict, categories, tagI18n] = await Promise.all([
  getCachedClip(id),
  getDictionary(locale),
  getCategories(),
  getTagI18n(),
]);

<ClipDetailView
  clip={clip}
  lang={locale}
  tagI18n={tagI18n}
  dict={dict}
  categories={categories}
/>
```

```tsx
<RightPanelContent
  categories={categories}
  lang={lang as Locale}
  dict={dict}
  tagI18n={tagI18n}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec vitest run src/components/layout/RightPanelInspector.test.tsx src/components/clip/ClipDetailView.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/[lang]/browse/page.tsx src/components/layout/RightPanelContent.tsx src/components/layout/RightPanelInspector.tsx src/components/layout/RightPanelInspector.test.tsx src/app/[lang]/clip/[id]/page.tsx src/components/clip/ClipDetailView.tsx src/components/clip/ClipDetailView.test.tsx
git commit -m "feat: translate inspector and detail tags"
```

### Task 6: Final verification sweep

**Files:**
- Test: `scripts/lib/tag-translation.test.mjs`
- Test: `src/lib/tagDisplay.test.ts`
- Test: `src/lib/clipSearch.test.ts`
- Test: `src/components/filter/TagFilterPanel.test.tsx`
- Test: `src/components/filter/ActiveFilters.test.tsx`
- Test: `src/components/layout/MobileSearchOverlay.test.tsx`
- Test: `src/components/clip/QuickViewModal.test.tsx`
- Test: `src/components/layout/RightPanelInspector.test.tsx`
- Test: `src/components/clip/ClipDetailView.test.tsx`

- [ ] **Step 1: Run the script-layer tests**

Run: `node --test scripts/lib/tag-translation.test.mjs`

Expected: PASS

- [ ] **Step 2: Run the shared logic tests**

Run: `npm exec vitest run src/lib/tagDisplay.test.ts src/lib/clipSearch.test.ts`

Expected: PASS

- [ ] **Step 3: Run the UI translation tests**

Run: `npm exec vitest run src/components/filter/TagFilterPanel.test.tsx src/components/filter/ActiveFilters.test.tsx src/components/layout/MobileSearchOverlay.test.tsx src/components/clip/QuickViewModal.test.tsx src/components/layout/RightPanelInspector.test.tsx src/components/clip/ClipDetailView.test.tsx`

Expected: PASS

- [ ] **Step 4: Smoke test the command without writing**

Run: `node scripts/tag-translate.mjs --dry-run`

Expected: prints translated tag count, pending AI translation count, and `Dry run only` without requiring `GEMINI_API_KEY`

- [ ] **Step 5: Commit the final integration sweep if any verification edits were needed**

```bash
git add scripts/config/tag-translation-rules.json scripts/tag-translate.mjs scripts/lib/tag-translation.mjs scripts/lib/tag-translation.test.mjs package.json README.md src/lib/tagDisplay.ts src/lib/tagDisplay.test.ts src/lib/aiTags.ts src/lib/clipSearch.ts src/lib/clipSearch.test.ts src/components/filter/TagFilterPanel.tsx src/components/filter/TagFilterPanel.test.tsx src/components/filter/ActiveFilters.tsx src/components/filter/ActiveFilters.test.tsx src/components/layout/MobileSearchOverlay.tsx src/components/layout/MobileSearchOverlay.test.tsx src/components/clip/ClipCard.tsx src/components/clip/MasonryGrid.tsx src/components/clip/QuickViewModal.tsx src/components/clip/QuickViewModal.test.tsx src/app/[lang]/browse/BrowseClient.tsx src/app/[lang]/browse/page.tsx src/components/layout/RightPanelContent.tsx src/components/layout/RightPanelInspector.tsx src/components/layout/RightPanelInspector.test.tsx src/app/[lang]/clip/[id]/page.tsx src/components/clip/ClipDetailView.tsx src/components/clip/ClipDetailView.test.tsx
git commit -m "feat: ship english tag translation pipeline"
```
