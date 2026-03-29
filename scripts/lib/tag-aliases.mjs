import fs from "node:fs";
import path from "node:path";

/**
 * Load and validate tag-aliases.json.
 * Returns { canonicalMap, reverseMap, raw }.
 *
 * canonicalMap: Map<alias, canonical>  (alias → canonical for resolution)
 * reverseMap: Map<canonical, string[]> (canonical → alias list for search tokens)
 * raw: the parsed JSON object
 */
export function loadTagAliases(configDir) {
  const aliasPath = path.join(configDir, "tag-aliases.json");
  if (!fs.existsSync(aliasPath)) {
    return { canonicalMap: new Map(), reverseMap: new Map(), raw: { version: 1, aliases: {} } };
  }

  const raw = JSON.parse(fs.readFileSync(aliasPath, "utf-8"));
  return buildAliasMaps(raw);
}

/**
 * Build alias maps from raw config object (testable without file I/O).
 */
export function buildAliasMaps(raw) {
  const aliases = raw.aliases || {};
  const canonicalMap = new Map();
  const reverseMap = new Map();

  const allCanonicals = new Set(Object.keys(aliases));

  for (const [canonical, aliasList] of Object.entries(aliases)) {
    if (!Array.isArray(aliasList)) {
      throw new Error(`tag-aliases: "${canonical}" value must be an array`);
    }

    reverseMap.set(canonical, aliasList);

    for (const alias of aliasList) {
      if (typeof alias !== "string" || !alias.trim()) {
        throw new Error(`tag-aliases: "${canonical}" contains invalid alias`);
      }

      // Alias must not be another canonical key (chain prevention)
      if (allCanonicals.has(alias)) {
        throw new Error(
          `tag-aliases: alias chain detected — "${alias}" is both a canonical key and an alias of "${canonical}"`
        );
      }

      // Alias must not appear under multiple canonicals
      if (canonicalMap.has(alias)) {
        throw new Error(
          `tag-aliases: duplicate alias "${alias}" — already mapped to "${canonicalMap.get(alias)}", cannot also map to "${canonical}"`
        );
      }

      canonicalMap.set(alias, canonical);
    }
  }

  return { canonicalMap, reverseMap, raw };
}

/**
 * Validate alias config against tag-groups.json.
 * Throws on inconsistencies.
 */
export function validateAliasesAgainstTagGroups(aliasConfig, tagGroupsData) {
  const allGroupTags = new Set();
  for (const group of tagGroupsData.groups || []) {
    for (const tag of group.tags || []) {
      allGroupTags.add(tag);
    }
  }

  const errors = [];
  for (const canonical of Object.keys(aliasConfig.aliases || {})) {
    if (!allGroupTags.has(canonical)) {
      errors.push(`Canonical tag "${canonical}" not found in any tag-groups.json group`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`tag-aliases validation failed:\n  ${errors.join("\n  ")}`);
  }
}

/**
 * Clean tag-groups.json: remove alias tags from group tag arrays.
 * Returns a new tag-groups object (does not mutate input).
 */
export function cleanTagGroupsAliases(tagGroupsData, canonicalMap) {
  return {
    ...tagGroupsData,
    groups: tagGroupsData.groups.map((group) => ({
      ...group,
      tags: group.tags.filter((tag) => !canonicalMap.has(tag)),
    })),
  };
}

/**
 * Migrate tag-i18n.json: copy translations from alias to canonical if missing.
 * Returns a new object (does not mutate input).
 */
export function migrateTagI18n(tagI18n, reverseMap) {
  const result = { ...tagI18n };

  for (const [canonical, aliases] of reverseMap) {
    if (result[canonical]) continue; // canonical already has translation

    for (const alias of aliases) {
      if (result[alias]) {
        result[canonical] = result[alias];
        break; // use first available translation
      }
    }
  }

  return result;
}
