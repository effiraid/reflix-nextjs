import fs from "node:fs";

export const DEFAULT_TAG_TRANSLATION_MODEL = "gemini-2.5-flash";

function uniqSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toTitleCaseWord(word) {
  if (/^[A-Z0-9/-]+$/.test(word)) {
    return word;
  }

  if (/^[0-9]+[A-Za-z]+$/.test(word) || /^[A-Za-z]+[0-9]+$/.test(word)) {
    return word.toUpperCase();
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeLabelPunctuation(value) {
  return value.replace(/^[\s"'`]+|[\s"'`]+$/g, "").replace(/[.,;:!?]+$/g, "");
}

function extractResponseText(payload) {
  return (payload?.candidates ?? [])
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => part?.text)
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
}

function extractJsonObject(text) {
  const raw = toTrimmedString(text);
  if (!raw) {
    throw new Error("Gemini response did not contain text");
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : raw;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Gemini response did not contain a JSON object");
  }

  return JSON.parse(jsonMatch[0]);
}

export function readJson(filePath, fallbackValue = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallbackValue;
    }
    throw error;
  }
}

export function collectTranslatableTags(indexData, { clipId = null } = {}) {
  const clips = Array.isArray(indexData?.clips) ? indexData.clips : [];
  const scopedClips = clipId
    ? clips.filter((clip) => clip?.id === clipId)
    : clips;

  const tags = [];
  for (const clip of scopedClips) {
    tags.push(...(clip?.tags ?? []));

    if (!clip?.aiTags) {
      continue;
    }

    tags.push(
      ...(clip.aiTags.actionType ?? []),
      ...(clip.aiTags.emotion ?? []),
      ...(clip.aiTags.composition ?? []),
      clip.aiTags.pacing,
      ...(clip.aiTags.characterType ?? []),
      ...(clip.aiTags.effects ?? [])
    );
  }

  return uniqSorted(tags.map((tag) => toTrimmedString(tag)));
}

export function validateEnglishLabel(
  label,
  style = { maxWords: 3, titleCase: true }
) {
  const trimmed = normalizeLabelPunctuation(toTrimmedString(label));

  if (!trimmed) {
    throw new Error("English label is required");
  }

  if (/[가-힣]/.test(trimmed)) {
    throw new Error("English label must not contain Korean");
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > (style?.maxWords ?? 3)) {
    throw new Error("English label must stay short");
  }

  if (style?.titleCase === false) {
    return words.join(" ");
  }

  return words.map(toTitleCaseWord).join(" ");
}

export function applyRuleBasedTranslations(tags, rules = {}) {
  const translations = {};
  const unresolved = [];
  const normalized = {};
  const glossary = rules.glossary ?? {};
  const preserve = new Set(rules.preserve ?? []);

  for (const tag of tags) {
    if (glossary[tag]) {
      translations[tag] = validateEnglishLabel(glossary[tag], rules.style);
      continue;
    }

    if (preserve.has(tag) || /^[A-Za-z0-9][A-Za-z0-9 /_-]*$/.test(tag)) {
      translations[tag] = validateEnglishLabel(tag, rules.style);
      continue;
    }

    const canonicalTag = rules.normalize?.[tag];
    if (canonicalTag) {
      normalized[tag] = canonicalTag;

      if (glossary[canonicalTag]) {
        translations[tag] = validateEnglishLabel(glossary[canonicalTag], rules.style);
      } else if (preserve.has(canonicalTag)) {
        translations[tag] = validateEnglishLabel(canonicalTag, rules.style);
      } else {
        unresolved.push(canonicalTag);
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

export function mergeTagI18n(existing = {}, next = {}) {
  const merged = { ...existing };

  for (const [tag, label] of Object.entries(next)) {
    if (!merged[tag]) {
      merged[tag] = label;
    }
  }

  return Object.fromEntries(
    Object.entries(merged).sort(([left], [right]) => left.localeCompare(right, "ko"))
  );
}

export function parseTagTranslateArgs(argv = process.argv.slice(2)) {
  const clipIdIndex = argv.indexOf("--clip-id");
  const modelIndex = argv.indexOf("--model");

  return {
    dryRun: argv.includes("--dry-run"),
    onlyNew: argv.includes("--only-new"),
    clipId: clipIdIndex !== -1 ? argv[clipIdIndex + 1] ?? null : null,
    model:
      modelIndex !== -1
        ? argv[modelIndex + 1] ?? DEFAULT_TAG_TRANSLATION_MODEL
        : DEFAULT_TAG_TRANSLATION_MODEL,
    write: argv.includes("--write"),
  };
}

export async function translateMissingTagsWithGemini(
  tags,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = DEFAULT_TAG_TRANSLATION_MODEL,
    fetchImpl = fetch,
  } = {}
) {
  const uniqueTags = uniqSorted(tags.map((tag) => toTrimmedString(tag)));

  if (uniqueTags.length === 0) {
    return {};
  }

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for unresolved tag translation");
  }

  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "Translate Korean game animation tags into short English UI chip labels.",
                  'Return JSON only in the shape {"<ko-tag>":"<English Label>"}.',
                  "Each English label must be 1-3 words and Title Case.",
                  "Tags:",
                  ...uniqueTags.map((tag) => `- ${tag}`),
                ].join("\n"),
              },
            ],
          },
        ],
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Gemini request failed with status ${response.status}`;
    throw new Error(message);
  }

  return extractJsonObject(extractResponseText(payload));
}

export async function runTagTranslate({
  indexData,
  existingTagI18n = {},
  rules = {},
  dryRun = false,
  onlyNew = false,
  clipId = null,
  outputPath = "src/data/tag-i18n.json",
  writeFile = (filePath, content) => fs.writeFileSync(filePath, content),
  translateMissingTags = translateMissingTagsWithGemini,
  apiKey = process.env.GEMINI_API_KEY,
  model = DEFAULT_TAG_TRANSLATION_MODEL,
} = {}) {
  const allTags = collectTranslatableTags(indexData, { clipId });
  const tags = onlyNew
    ? allTags.filter((tag) => !existingTagI18n[tag])
    : allTags;
  const { translations: ruleTranslations, unresolved, normalized } =
    applyRuleBasedTranslations(tags, rules);

  const translatedTags = { ...existingTagI18n, ...ruleTranslations };

  for (const [originalTag, canonicalTag] of Object.entries(normalized)) {
    if (translatedTags[canonicalTag]) {
      translatedTags[originalTag] = translatedTags[canonicalTag];
    }
  }

  const pendingAiTags = uniqSorted(
    unresolved.filter((tag) => !translatedTags[tag])
  );

  if (dryRun) {
    return {
      translatedTags: Object.fromEntries(
        Object.entries(translatedTags).sort(([left], [right]) =>
          left.localeCompare(right, "ko")
        )
      ),
      pendingAiTags,
      wroteFile: false,
    };
  }

  const aiTranslations = await translateMissingTags(pendingAiTags, {
    apiKey,
    model,
  });

  for (const [tag, label] of Object.entries(aiTranslations)) {
    translatedTags[tag] = validateEnglishLabel(label, rules.style);
  }

  for (const [originalTag, canonicalTag] of Object.entries(normalized)) {
    if (translatedTags[canonicalTag]) {
      translatedTags[originalTag] = translatedTags[canonicalTag];
    }
  }

  const sortedTranslations = Object.fromEntries(
    Object.entries(translatedTags).sort(([left], [right]) =>
      left.localeCompare(right, "ko")
    )
  );

  writeFile(outputPath, `${JSON.stringify(sortedTranslations, null, 2)}\n`);

  return {
    translatedTags: sortedTranslations,
    pendingAiTags,
    wroteFile: true,
  };
}
