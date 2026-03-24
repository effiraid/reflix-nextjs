import path from "node:path";
import { fileURLToPath } from "node:url";

import { pruneProtectedPublicBuild } from "./lib/protected-public-build.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(SCRIPT_DIR, "..");
const enabled = process.env.PROTECT_MP4_PUBLIC_ASSETS === "true";

const summary = await pruneProtectedPublicBuild({
  projectRoot,
  enabled,
});

if (summary.pruned && summary.removedDirs.length > 0) {
  console.log(
    `[protected-public-build] pruned ${summary.removedDirs.join(", ")}`
  );
}
