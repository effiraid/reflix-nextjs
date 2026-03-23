#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import {
  parsePhase2CliArgs,
  printPhase2Usage,
  runPhase2Apply,
  runPhase2Review,
} from "./lib/eagle-phase2.mjs";

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  try {
    const parsed = parsePhase2CliArgs();

    if (parsed.mode === "help") {
      printPhase2Usage();
      process.exit(0);
    }

    if (parsed.mode === "review") {
      const result = runPhase2Review(parsed);
      process.stdout.write(`📂 Eagle Library: ${parsed.libraryPath}\n`);
      process.stdout.write("📝 Mode: review\n");
      process.stdout.write(`🧾 name-review.json: ${result.nameReviewJson}\n`);
    } else if (parsed.mode === "apply") {
      const result = runPhase2Apply(parsed);
      process.stdout.write(`📂 Eagle Library: ${parsed.libraryPath}\n`);
      process.stdout.write("✍️ Mode: apply\n");
      process.stdout.write(`🧾 apply-report.json: ${result.applyReportJson}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
