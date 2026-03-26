#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseTagTranslateArgs,
  readJson,
  runTagTranslate,
} from "./lib/tag-translation.mjs";

export async function main(argv = process.argv.slice(2)) {
  const flags = parseTagTranslateArgs(argv);
  const rootDir = process.cwd();
  const indexPath = path.join(rootDir, "src/data/index.json");
  const rulesPath = path.join(rootDir, "scripts/config/tag-translation-rules.json");
  const outputPath = path.join(rootDir, "src/data/tag-i18n.json");
  const indexData = readJson(indexPath, { clips: [] });
  const rules = readJson(rulesPath, {});
  const existingTagI18n = readJson(outputPath, {});
  const dryRun = flags.dryRun || !flags.write;

  const summary = await runTagTranslate({
    indexData,
    existingTagI18n,
    rules,
    dryRun,
    onlyNew: flags.onlyNew,
    clipId: flags.clipId,
    model: flags.model,
    outputPath,
  });

  console.log(`Translated tags: ${Object.keys(summary.translatedTags).length}`);
  console.log(`Pending AI translations: ${summary.pendingAiTags.length}`);

  if (summary.pendingAiTags.length > 0) {
    console.log(`Pending tags: ${summary.pendingAiTags.join(", ")}`);
  }

  console.log(summary.wroteFile ? `Updated ${outputPath}` : "Dry run only");

  return summary;
}

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
