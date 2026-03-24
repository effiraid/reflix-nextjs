import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_EAGLE_LIBRARY_NAME = "레퍼런스 - 게임,연출.library";

export function getDefaultEagleLibraryCandidates({ homedir = os.homedir } = {}) {
  const homeDirectory = homedir();

  return [
    path.join(homeDirectory, "Desktop", "라이브러리", DEFAULT_EAGLE_LIBRARY_NAME),
    path.join(homeDirectory, "Library", "CloudStorage", "Dropbox", "!", DEFAULT_EAGLE_LIBRARY_NAME),
  ];
}

export function resolveEagleLibraryPath({
  env = process.env,
  homedir = os.homedir,
  pathExists = fs.existsSync,
} = {}) {
  const envPath = env.EAGLE_LIBRARY_PATH?.trim();
  if (envPath) {
    return envPath;
  }

  const candidate = getDefaultEagleLibraryCandidates({ homedir }).find((candidatePath) =>
    pathExists(candidatePath)
  );

  return candidate ?? getDefaultEagleLibraryCandidates({ homedir })[0];
}
