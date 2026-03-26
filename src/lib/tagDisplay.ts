import type { Locale } from "./types";

export function getTagDisplayLabel(
  tag: string,
  lang: Locale,
  tagI18n: Record<string, string>
): string {
  if (lang !== "en") {
    return tag;
  }

  const translated = tagI18n[tag];
  return typeof translated === "string" && translated.trim() ? translated : tag;
}

export function getTagDisplayLabels(
  tags: string[],
  lang: Locale,
  tagI18n: Record<string, string>
): string[] {
  return tags.map((tag) => getTagDisplayLabel(tag, lang, tagI18n));
}
