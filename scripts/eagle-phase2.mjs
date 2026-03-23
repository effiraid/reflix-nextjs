#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import {
  parsePhase2CliArgs,
  printPhase2Usage,
  runPhase2Apply,
  runPhase2Review,
} from "./lib/eagle-phase2.mjs";

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const parsed = parsePhase2CliArgs();

    if (parsed.mode === "help") {
      printPhase2Usage();
      process.exit(0);
    }

    if (parsed.mode === "review") {
      runPhase2Review(parsed);
    } else if (parsed.mode === "apply") {
      runPhase2Apply(parsed);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
