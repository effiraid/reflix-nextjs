import type {
  AIGeneratedTags,
  BrowseClipRecord,
  ParentTagGroup,
  TagGroup,
} from "./types";
import { getTagDisplayLabels } from "./tagDisplay";

export const AI_PARENT_GROUP_ID = "ai-generated";

const AI_GROUP_DEFINITIONS = [
  {
    id: "ai-action-type",
    name: { ko: "동작유형", en: "Action Type" },
    read: (aiTags: AIGeneratedTags) => aiTags.actionType,
  },
  {
    id: "ai-emotion",
    name: { ko: "감정", en: "Emotion" },
    read: (aiTags: AIGeneratedTags) => aiTags.emotion,
  },
  {
    id: "ai-composition",
    name: { ko: "구도", en: "Composition" },
    read: (aiTags: AIGeneratedTags) => aiTags.composition,
  },
  {
    id: "ai-pacing",
    name: { ko: "속도감", en: "Pacing" },
    read: (aiTags: AIGeneratedTags) => [aiTags.pacing],
  },
  {
    id: "ai-character-type",
    name: { ko: "캐릭터유형", en: "Character Type" },
    read: (aiTags: AIGeneratedTags) => aiTags.characterType,
  },
  {
    id: "ai-effects",
    name: { ko: "이펙트", en: "Effects" },
    read: (aiTags: AIGeneratedTags) => aiTags.effects,
  },
] satisfies Array<{
  id: string;
  name: { ko: string; en: string };
  read: (aiTags: AIGeneratedTags) => string[];
}>;

export function getStructuredAiTags(aiTags?: AIGeneratedTags | null): string[] {
  if (!aiTags) {
    return [];
  }

  const values = [
    ...aiTags.actionType,
    ...aiTags.emotion,
    ...aiTags.composition,
    aiTags.pacing,
    ...aiTags.characterType,
    ...aiTags.effects,
  ];

  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())))
  );
}

export function getAllClipTags(clip: {
  tags?: string[];
  aiTags?: AIGeneratedTags | null;
  aiStructuredTags?: string[];
}): string[] {
  const structuredAiTags =
    clip.aiStructuredTags ?? getStructuredAiTags(clip.aiTags);

  return Array.from(new Set([...(clip.tags ?? []), ...structuredAiTags]));
}

export function getClipSearchTargets(
  clip: {
    name: string;
    tags?: string[];
    aiTags?: AIGeneratedTags | null;
    aiStructuredTags?: string[];
    searchTokens?: string[];
  },
  tagI18n: Record<string, string>
): string[] {
  const manualTags = clip.tags ?? [];
  const translatedTags = getTagDisplayLabels(manualTags, "en", tagI18n)
    .filter((value, index) => value !== manualTags[index]);
  const aiTags = clip.aiStructuredTags ?? getStructuredAiTags(clip.aiTags);
  const translatedAiTags = getTagDisplayLabels(aiTags, "en", tagI18n)
    .filter((value, index) => value !== aiTags[index]);
  const descriptions = clip.aiTags
    ? [clip.aiTags.description.ko, clip.aiTags.description.en]
    : [];
  const searchTokens = clip.searchTokens ?? [];

  return [
    clip.name,
    ...manualTags,
    ...translatedTags,
    ...aiTags,
    ...translatedAiTags,
    ...searchTokens,
    ...descriptions.filter(Boolean),
  ];
}

export function buildAiTagGroups(
  clips: Array<Pick<BrowseClipRecord, "aiTags" | "aiStructuredTags">>
): {
  groups: TagGroup[];
  parentGroup: ParentTagGroup;
  hasAiField: boolean;
} {
  const hasStructuredProjection = clips.some(
    (clip) => (clip.aiStructuredTags?.length ?? 0) > 0
  );
  const hasAiField =
    hasStructuredProjection ||
    clips.some((clip) => Object.prototype.hasOwnProperty.call(clip, "aiTags"));

  if (hasStructuredProjection && !clips.some((clip) => clip.aiTags)) {
    const tags = Array.from(
      new Set(clips.flatMap((clip) => clip.aiStructuredTags ?? []).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "ko"));

    return {
      groups: tags.length
        ? [
            {
              id: "ai-structured",
              name: { ko: "AI 태그", en: "AI Tags" },
              parent: AI_PARENT_GROUP_ID,
              tags,
            },
          ]
        : [],
      parentGroup: {
        id: AI_PARENT_GROUP_ID,
        name: { ko: "AI 생성", en: "AI Generated" },
        children: tags.length ? ["ai-structured"] : [],
      },
      hasAiField,
    };
  }

  const groups = AI_GROUP_DEFINITIONS.map((definition) => {
    const tags = Array.from(
      new Set(
        clips.flatMap((clip) => {
          if (!clip.aiTags) {
            return [];
          }

          return definition.read(clip.aiTags).filter(Boolean);
        })
      )
    ).sort((a, b) => a.localeCompare(b, "ko"));

    return {
      id: definition.id,
      name: definition.name,
      parent: AI_PARENT_GROUP_ID,
      tags,
    };
  }).filter((group) => group.tags.length > 0);

  return {
    groups,
    parentGroup: {
      id: AI_PARENT_GROUP_ID,
      name: { ko: "AI 생성", en: "AI Generated" },
      children: groups.map((group) => group.id),
    },
    hasAiField,
  };
}
