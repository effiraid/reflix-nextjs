#!/usr/bin/env node

/**
 * Validate consistency of tag-aliases.json, tag-groups.json, tag-i18n.json.
 *
 * Usage: node scripts/validate-tags.mjs
 *        npm run validate:tags
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAliasMaps } from "./lib/tag-aliases.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

function loadJson(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function main() {
  const errors = [];
  const warnings = [];

  // 1. Load and validate tag-aliases.json structure
  let aliasConfig;
  let canonicalMap;
  let reverseMap;
  try {
    aliasConfig = loadJson("config/tag-aliases.json");
    const maps = buildAliasMaps(aliasConfig);
    canonicalMap = maps.canonicalMap;
    reverseMap = maps.reverseMap;
    console.log(`  tag-aliases.json: ${canonicalMap.size} aliases, ${reverseMap.size} canonical tags`);
  } catch (err) {
    errors.push(`tag-aliases.json: ${err.message}`);
    console.error(`\n${errors.length} errors found. Aborting.`);
    process.exitCode = 1;
    return;
  }

  // 2. Load tag-groups.json
  const tagGroups = loadJson("src/data/tag-groups.json");
  const allGroupTags = new Set();
  for (const group of tagGroups.groups || []) {
    for (const tag of group.tags || []) {
      allGroupTags.add(tag);
    }
  }
  console.log(`  tag-groups.json: ${allGroupTags.size} unique tags across ${tagGroups.groups.length} groups`);

  // 3. Validate canonical tags exist in tag-groups
  for (const canonical of reverseMap.keys()) {
    if (!allGroupTags.has(canonical)) {
      errors.push(`Canonical tag "${canonical}" not found in any tag-groups.json group`);
    }
  }

  // 4. Check for alias tags still present in tag-groups (should be cleaned by export)
  for (const alias of canonicalMap.keys()) {
    if (allGroupTags.has(alias)) {
      warnings.push(`Alias "${alias}" → "${canonicalMap.get(alias)}" still present in tag-groups.json (will be cleaned on next export)`);
    }
  }

  // 5. Load tag-i18n.json
  const tagI18n = loadJson("src/data/tag-i18n.json");
  const i18nKeys = new Set(Object.keys(tagI18n));
  console.log(`  tag-i18n.json: ${i18nKeys.size} translations`);

  // 6. Check canonical tags have translations
  for (const canonical of reverseMap.keys()) {
    if (!i18nKeys.has(canonical)) {
      warnings.push(`Canonical tag "${canonical}" missing translation in tag-i18n.json`);
    }
  }

  // Report
  console.log("");
  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
  }

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) console.error(`  ❌ ${e}`);
    process.exitCode = 1;
  } else {
    console.log("Tag validation passed.");
  }
}

main();
