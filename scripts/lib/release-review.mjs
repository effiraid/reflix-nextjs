const REVIEW_STATUS_ORDER = [
  "review_needed_changed",
  "review_needed",
  "held",
  "already_approved",
];

const REVIEW_STATUS_LABELS = {
  review_needed_changed: "변경 후 재검토 필요",
  review_needed: "검토 필요",
  held: "보류",
  already_approved: "이미 승인됨",
};

const REVIEW_REASON_LABELS = {
  "item is held for manual decision": "이 항목은 수동 판단을 위해 보류됨",
  "approved item changed since its exported metadata":
    "승인 이후 내보낸 메타데이터와 현재 상태가 달라짐",
  "item remains approved with matching metadata":
    "현재 메타데이터가 기존 승인 상태와 일치함",
  "name provides richer searchable vocabulary than tags":
    "이름 쪽 의미 토큰이 더 풍부해 태그 보강이 필요함",
  "tags provide richer searchable vocabulary than name":
    "태그 쪽 의미 토큰이 더 풍부해 이름 보강이 필요함",
  "taxonomy and metadata hints suggest review enrichment":
    "taxonomy와 메타데이터 기준으로 태그 보강 여지가 있음",
  "no better deterministic suggestion than keeping current metadata":
    "현재 메타데이터를 유지하는 것이 가장 안정적임",
};

const REVIEW_CONFIDENCE_LABELS = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const REVIEW_NEXT_ACTION_LABELS = {
  approve_after_review: "검토 후 승인",
  review_existing_changes: "변경사항 재검토",
  hold_for_manual_decision: "수동 판단 후 보류 여부 결정",
};

const IGNORE_TAG_PREFIX = "reflix:";
const IGNORE_TOKENS = new Set(["연출", "작품"]);
const PARTICLE_SUFFIXES = [
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "와",
  "과",
  "의",
  "에",
  "도",
  "로",
  "으로",
  "에서",
  "에게",
  "부터",
  "까지",
  "만",
  "보다",
  "처럼",
];
const CONNECTIVE_SUFFIXES = ["아", "어", "여", "고", "며", "서", "게", "도록"];

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeTags(tags) {
  return Array.isArray(tags)
    ? tags.map((tag) => normalizeString(tag)).filter(Boolean)
    : [];
}

function dedupeStable(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function isOperationalTag(tag) {
  return normalizeString(tag).startsWith(IGNORE_TAG_PREFIX);
}

function isNumericToken(token) {
  return /^\d+$/.test(token) || /^\(\d+\)$/.test(token);
}

function isAsciiWordToken(token) {
  return /^[A-Za-z]+$/.test(normalizeString(token));
}

function isLikelyIdeophone(token) {
  const value = normalizeString(token);
  if (!value || !/^[\p{Script=Hangul}]+$/u.test(value)) {
    return false;
  }

  if (value.length < 2 || value.length % 2 !== 0) {
    return false;
  }

  const half = value.length / 2;
  return value.slice(0, half) === value.slice(half);
}

function getLastJongIndex(token) {
  const value = normalizeString(token);
  const lastChar = value.at(-1);
  if (!lastChar) {
    return -1;
  }

  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return -1;
  }

  return (code - 0xac00) % 28;
}

function hasParticleSuffix(token) {
  const value = normalizeString(token);
  return value.length > 1 && PARTICLE_SUFFIXES.some((suffix) => value.endsWith(suffix));
}

function hasConnectiveSuffix(token) {
  const value = normalizeString(token);
  return value.length > 1 && CONNECTIVE_SUFFIXES.some((suffix) => value.endsWith(suffix));
}

function hasLikelyAdnominalFragment(token) {
  const value = normalizeString(token);
  if (!value || isLikelyIdeophone(value)) {
    return false;
  }

  if (!/^[\p{Script=Hangul}]+$/u.test(value) || value.length > 2) {
    return false;
  }

  const jongIndex = getLastJongIndex(value);
  return jongIndex === 4 || jongIndex === 8;
}

function tokenizeText(value) {
  const text = normalizeString(value);
  if (!text) {
    return [];
  }

  return text
    .match(/[\p{Script=Hangul}\p{L}\p{N}]+/gu)
    ?.map((token) => token.trim())
    .filter(Boolean) ?? [];
}

function normalizeToken(token) {
  return normalizeString(token).toLowerCase();
}

function collectNormalizedDisplayTokens(values, { ignoreWeakTokens = true } = {}) {
  const seen = new Set();
  const tokens = [];

  for (const value of values) {
    for (const token of tokenizeText(value)) {
      const normalized = normalizeToken(token);
      if (!normalized || isNumericToken(normalized)) {
        continue;
      }

      if (ignoreWeakTokens && IGNORE_TOKENS.has(normalized)) {
        continue;
      }

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      tokens.push({
        normalized,
        display: token,
      });
    }
  }

  return tokens;
}

function collectTaxonomyTerms(taxonomy) {
  const knownTokens = new Map();

  function visit(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    const tokens = collectNormalizedDisplayTokens([
      ...tokenizeText(node?.i18n?.ko),
      ...tokenizeText(node?.i18n?.en),
      ...tokenizeText(node?.slug),
    ]);

    for (const token of tokens) {
      if (!knownTokens.has(token.normalized)) {
        knownTokens.set(token.normalized, token.display);
      }
    }

    for (const child of Object.values(node.children || {})) {
      visit(child);
    }
  }

  for (const node of Object.values(taxonomy || {})) {
    visit(node);
  }

  return knownTokens;
}

function collectMeaningfulTokensFromItem(item, exportedClip) {
  const textSources = [
    item?.name,
    exportedClip?.name,
    item?.annotation,
    exportedClip?.annotation,
  ];

  const tagSources = [
    ...normalizeTags(item?.tags),
    ...normalizeTags(exportedClip?.tags),
  ].filter((tag) => !isOperationalTag(tag));

  return collectNormalizedDisplayTokens([
    ...textSources,
    ...tagSources,
  ]);
}

function collectNameTokens(item) {
  return collectNormalizedDisplayTokens([item?.name]);
}

function collectTagTokens(item) {
  return collectNormalizedDisplayTokens(
    normalizeTags(item?.tags).filter((tag) => !isOperationalTag(tag))
  );
}

function collectContentTags(item) {
  const seen = new Set();
  const contentTags = [];

  for (const tag of normalizeTags(item?.tags)) {
    if (isOperationalTag(tag)) {
      continue;
    }

    const normalized = normalizeToken(tag);
    if (!normalized || isNumericToken(normalized) || IGNORE_TOKENS.has(normalized)) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    contentTags.push(tag);
  }

  return contentTags;
}

function collectFolderIds(item) {
  return dedupeStable(normalizeTags(item?.folders));
}

function isPreferredSuggestedToken(display, { allowAscii = false } = {}) {
  const normalized = normalizeToken(display);
  if (!normalized || isNumericToken(normalized) || IGNORE_TOKENS.has(normalized)) {
    return false;
  }

  if (!allowAscii && isAsciiWordToken(display)) {
    return false;
  }

  if (hasParticleSuffix(display) || hasConnectiveSuffix(display) || hasLikelyAdnominalFragment(display)) {
    return false;
  }

  return true;
}

function normalizeComparableArray(values) {
  return dedupeStable(normalizeTags(values)).sort();
}

function normalizeComparableContentTags(tags) {
  const seen = new Set();
  const contentTags = [];

  for (const tag of normalizeTags(tags)) {
    if (isOperationalTag(tag)) {
      continue;
    }

    const normalized = normalizeToken(tag);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    contentTags.push(normalized);
  }

  return contentTags.sort();
}

function buildReviewComparableMetadata(item) {
  return {
    name: normalizeString(item?.name),
    tags: normalizeComparableContentTags(item?.tags),
    folders: normalizeComparableArray(item?.folders),
    annotation: normalizeString(item?.annotation),
    star: Number(item?.star ?? 0),
    duration: Number(item?.duration ?? 0),
    width: Number(item?.width ?? 0),
    height: Number(item?.height ?? 0),
  };
}

function hasMetadataChange(item, exportedClip) {
  if (!exportedClip) {
    return false;
  }

  // Review-stage change detection must stay metadata-only and ignore file-backed state.
  return (
    JSON.stringify(buildReviewComparableMetadata(item)) !==
    JSON.stringify(buildReviewComparableMetadata(exportedClip))
  );
}

function getSyncSource({ item }) {
  const nameTokens = collectNameTokens(item);
  const tagTokens = collectTagTokens(item);

  return {
    nameTokens,
    tagTokens,
    syncSource: nameTokens.length >= tagTokens.length ? "name" : "tags",
  };
}

function collapseDuplicateWords(value) {
  const tokens = normalizeString(value).split(/\s+/).filter(Boolean);
  const seen = new Set();
  const result = [];

  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(token);
  }

  return result.join(" ").trim();
}

function getNameSuggestion({ item, syncSource, tagTokens }) {
  const currentName = normalizeString(item?.name);
  if (syncSource !== "tags") {
    const suggestedName = collapseDuplicateWords(currentName) || currentName;
    return {
      suggestedName,
      nameDecision: suggestedName === currentName ? "keep" : "suggest-change",
    };
  }

  const currentNameTokenSet = new Set(collectNameTokens(item).map((token) => token.normalized));
  const missingTagTokens = tagTokens.filter(
    (token) =>
      !currentNameTokenSet.has(token.normalized) &&
      isPreferredSuggestedToken(token.display)
  );

  if (missingTagTokens.length === 0) {
    return {
      suggestedName: currentName,
      nameDecision: "keep",
    };
  }

  const suggestedName = [currentName, ...missingTagTokens.map((token) => token.display)]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    suggestedName: suggestedName || currentName,
    nameDecision: suggestedName && suggestedName !== currentName ? "suggest-change" : "keep",
  };
}

function collectTagSuggestions({ item, taxonomy, syncSource, nameTokens }) {
  const taxonomyTerms = collectTaxonomyTerms(taxonomy);
  const currentTags = collectContentTags(item);
  const currentTagSet = new Set(collectTagTokens(item).map((tag) => tag.normalized));

  const suggestedTagsToAdd = [];
  const newTagCandidates = [];
  const seenAdds = new Set();
  const seenNewTags = new Set();

  if (syncSource !== "name") {
    return {
      currentTags,
      suggestedTagsToAdd,
      suggestedTagsToRemove: [],
      newTagCandidates,
    };
  }

  for (const token of nameTokens) {
    if (currentTagSet.has(token.normalized)) {
      continue;
    }

    const taxonomyDisplay = taxonomyTerms.get(token.normalized);
    if (taxonomyDisplay && isPreferredSuggestedToken(taxonomyDisplay, { allowAscii: true })) {
      const normalizedDisplay = normalizeToken(taxonomyDisplay);
      if (!seenAdds.has(normalizedDisplay)) {
        seenAdds.add(normalizedDisplay);
        suggestedTagsToAdd.push(taxonomyDisplay);
      }
      continue;
    }

    if (!isPreferredSuggestedToken(token.display)) {
      continue;
    }

    if (!seenNewTags.has(token.normalized)) {
      seenNewTags.add(token.normalized);
      newTagCandidates.push(token.display);
    }
  }

  return {
    currentTags,
    suggestedTagsToAdd,
    suggestedTagsToRemove: [],
    newTagCandidates,
  };
}

function determineConfidence({ status, suggestedTagsToAdd, newTagCandidates, nameDecision }) {
  if (status === "held") {
    return "low";
  }

  if (status === "review_needed_changed") {
    return "medium";
  }

  if (status === "already_approved") {
    return "high";
  }

  if (nameDecision === "suggest-change" || suggestedTagsToAdd.length > 0 || newTagCandidates.length > 0) {
    return "medium";
  }

  return "low";
}

function determineNextAction(status) {
  if (status === "held") {
    return "hold_for_manual_decision";
  }

  if (status === "review_needed_changed") {
    return "review_existing_changes";
  }

  return "approve_after_review";
}

export function classifyReviewItemStatus({ item, publishedEntry, exportedClip }) {
  const tags = normalizeTags(item?.tags);
  if (tags.some((tag) => tag === "reflix:hold")) {
    return "held";
  }

  if (!tags.some((tag) => tag === "reflix:approved")) {
    return "review_needed";
  }

  if (hasMetadataChange(item, exportedClip)) {
    return "review_needed_changed";
  }

  return "already_approved";
}

export function buildReviewSuggestion({ item, exportedClip, taxonomy }) {
  const status = classifyReviewItemStatus({ item, exportedClip });
  const { nameTokens, tagTokens, syncSource } = getSyncSource({ item });
  const { suggestedName, nameDecision } = getNameSuggestion({
    item,
    syncSource,
    tagTokens,
  });
  const { currentTags, suggestedTagsToAdd, suggestedTagsToRemove, newTagCandidates } =
    collectTagSuggestions({ item, taxonomy, syncSource, nameTokens });
  const currentFolders = collectFolderIds(item);
  const nextAction = determineNextAction(status);
  const confidence = determineConfidence({
    status,
    suggestedTagsToAdd,
    newTagCandidates,
    nameDecision,
  });

  let reason;
  if (status === "held") {
    reason = "item is held for manual decision";
  } else if (status === "review_needed_changed") {
    reason = "approved item changed since its exported metadata";
  } else if (status === "already_approved") {
    reason = "item remains approved with matching metadata";
  } else if (nameDecision === "suggest-change") {
    reason = "tags provide richer searchable vocabulary than name";
  } else if (suggestedTagsToAdd.length > 0 || newTagCandidates.length > 0) {
    reason =
      syncSource === "name"
        ? "name provides richer searchable vocabulary than tags"
        : "taxonomy and metadata hints suggest review enrichment";
  } else {
    reason = "no better deterministic suggestion than keeping current metadata";
  }

  return {
    id: normalizeString(item?.id),
    status,
    currentName: normalizeString(item?.name),
    suggestedName,
    nameDecision,
    currentTags,
    suggestedTagsToAdd,
    suggestedTagsToRemove,
    newTagCandidates,
    currentFolders,
    syncSource,
    reason,
    confidence,
    nextAction,
  };
}

export function buildReviewSummary(items) {
  const summary = {
    total: Array.isArray(items) ? items.length : 0,
    review_needed_changed: 0,
    review_needed: 0,
    already_approved: 0,
    held: 0,
  };

  for (const item of items || []) {
    const status = normalizeString(item?.status);
    if (Object.hasOwn(summary, status)) {
      summary[status] += 1;
    }
  }

  return summary;
}

function sortSuggestions(suggestions) {
  return [...(suggestions || [])].sort((left, right) => {
    const leftIndex = REVIEW_STATUS_ORDER.indexOf(normalizeString(left?.status));
    const rightIndex = REVIEW_STATUS_ORDER.indexOf(normalizeString(right?.status));

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return normalizeString(left?.id).localeCompare(normalizeString(right?.id));
  });
}

function getStatusLabel(status) {
  return REVIEW_STATUS_LABELS[normalizeString(status)] ?? normalizeString(status);
}

function getReasonLabel(reason) {
  return REVIEW_REASON_LABELS[normalizeString(reason)] ?? normalizeString(reason);
}

function getConfidenceLabel(confidence) {
  return REVIEW_CONFIDENCE_LABELS[normalizeString(confidence)] ?? normalizeString(confidence);
}

function getNextActionLabel(nextAction) {
  return REVIEW_NEXT_ACTION_LABELS[normalizeString(nextAction)] ?? normalizeString(nextAction);
}

export function orderReviewSuggestions(suggestions) {
  return sortSuggestions(suggestions);
}

function formatList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "(none)";
  }

  return values.join(", ");
}

function formatSuggestionSection(suggestion) {
  return [
    `### ${suggestion.id}`,
    `- 현재 상태: ${getStatusLabel(suggestion.status)}`,
    `- 현재 이름: ${suggestion.currentName}`,
    `- 제안 이름: ${suggestion.suggestedName}`,
    `- 현재 태그: ${formatList(suggestion.currentTags)}`,
    `- 추가 추천 태그: ${formatList(suggestion.suggestedTagsToAdd)}`,
    `- 제거 추천 태그: ${formatList(suggestion.suggestedTagsToRemove)}`,
    `- 새 태그 후보: ${formatList(suggestion.newTagCandidates)}`,
    `- 이유: ${getReasonLabel(suggestion.reason)}`,
    `- 신뢰도: ${getConfidenceLabel(suggestion.confidence)}`,
    `- 다음 행동: ${getNextActionLabel(suggestion.nextAction)}`,
  ].join("\n");
}

export function renderReviewReport({
  summary,
  suggestions,
  timestamp,
  batchName,
  scope,
}) {
  const orderedSuggestions = orderReviewSuggestions(suggestions);
  const lines = [
    "# 검토 보고서",
    "",
    `- 생성 시각: ${normalizeString(timestamp)}`,
    `- 배치 이름: ${normalizeString(batchName)}`,
    `- 범위: ${normalizeString(scope)}`,
    `- 전체 아이템 수: ${Number(summary?.total ?? 0)}`,
    `- 변경 후 재검토 필요: ${Number(summary?.review_needed_changed ?? 0)}`,
    `- 검토 필요: ${Number(summary?.review_needed ?? 0)}`,
    `- 이미 승인됨: ${Number(summary?.already_approved ?? 0)}`,
    `- 보류: ${Number(summary?.held ?? 0)}`,
    "",
    "## 운영 안내",
    "",
    "- Eagle에서 검토합니다.",
    "- 필요하면 이름과 content tag를 직접 수정합니다.",
    "- 준비되면 `reflix:approved`를 추가합니다.",
    "- 제외하려면 `reflix:hold`를 추가합니다.",
    "- 검토가 끝나면 `release:approve`를 실행합니다.",
  ];

  for (const status of REVIEW_STATUS_ORDER) {
    const grouped = orderedSuggestions.filter((suggestion) => suggestion?.status === status);
    if (grouped.length === 0) {
      continue;
    }

    lines.push("", `## ${getStatusLabel(status)} (${grouped.length})`);
    for (const suggestion of grouped) {
      lines.push("", formatSuggestionSection(suggestion));
    }
  }

  return `${lines.join("\n")}\n`;
}
