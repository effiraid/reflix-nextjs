#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import { main } from "./lib/ai-tag-backfill.mjs";

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
