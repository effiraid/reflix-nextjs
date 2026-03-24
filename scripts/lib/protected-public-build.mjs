import fs from "node:fs";
import path from "node:path";

const PROTECTED_PUBLIC_DIRS = ["public/videos", "public/previews"];

export async function pruneProtectedPublicBuild({ projectRoot, enabled }) {
  if (!enabled) {
    return {
      pruned: false,
      removedDirs: [],
    };
  }

  const removedDirs = [];

  for (const relativeDir of PROTECTED_PUBLIC_DIRS) {
    const absoluteDir = path.join(projectRoot, relativeDir);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }

    await fs.promises.rm(absoluteDir, { recursive: true, force: true });
    removedDirs.push(relativeDir);
  }

  return {
    pruned: true,
    removedDirs,
  };
}
