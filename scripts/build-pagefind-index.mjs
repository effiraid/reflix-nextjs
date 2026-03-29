#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as pagefind from "pagefind";

import { getPagefindIndexOrThrow } from "./lib/pagefind-build.mjs";
import { buildPagefindRecords } from "./lib/pagefind-records.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(SCRIPT_DIR, "..");
const indexPath = path.join(projectRoot, "public", "data", "index.json");
const tagI18nPath = path.join(projectRoot, "src", "data", "tag-i18n.json");
const outputPath = path.join(projectRoot, "public", "pagefind");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensurePagefindErrors(result, step) {
  if (result?.errors?.length) {
    throw new Error(`${step} failed:\n${result.errors.join("\n")}`);
  }
}

if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing clip index: ${indexPath}`);
}

const indexData = readJson(indexPath);
const tagI18n = fs.existsSync(tagI18nPath) ? readJson(tagI18nPath) : {};
const records = buildPagefindRecords(indexData.clips ?? [], tagI18n);

fs.rmSync(outputPath, { recursive: true, force: true });

const createResult = await pagefind.createIndex({
  writePlayground: false,
  verbose: false,
});
const index = getPagefindIndexOrThrow(createResult, "createIndex");

try {
  for (const record of records) {
    const result = await index.addCustomRecord(record);
    ensurePagefindErrors(result, `addCustomRecord(${record.language}:${record.meta.clipId})`);
  }

  const writeResult = await index.writeFiles({ outputPath });
  ensurePagefindErrors(writeResult, "writeFiles");
} finally {
  await pagefind.close();
}

const pagefindJsPath = path.join(outputPath, "pagefind.js");

if (!fs.existsSync(pagefindJsPath)) {
  throw new Error(`Pagefind build did not create ${pagefindJsPath}`);
}

console.log(`Wrote ${records.length} Pagefind records to ${outputPath}`);
