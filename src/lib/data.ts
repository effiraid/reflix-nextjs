import type {
  ClipIndexData,
  CategoryTree,
  TagGroupData,
  Clip,
} from "./types";

function getDeploymentOrigin(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw.replace(/\/$/, "");

  return `https://${raw.replace(/\/$/, "")}`;
}

async function getClipFromPublicAsset(id: string): Promise<Clip | null> {
  const origin = getDeploymentOrigin();
  if (!origin) return null;

  try {
    const response = await fetch(`${origin}/data/clips/${id}.json`, {
      cache: "force-cache",
    });

    if (!response.ok) return null;
    return (await response.json()) as Clip;
  } catch {
    return null;
  }
}

export async function getClipIndex(): Promise<ClipIndexData> {
  const data = await import("@/data/index.json");
  return data.default as ClipIndexData;
}

export async function getCategories(): Promise<CategoryTree> {
  const data = await import("@/data/categories.json");
  return data.default as CategoryTree;
}

export async function getTagGroups(): Promise<TagGroupData> {
  const data = await import("@/data/tag-groups.json");
  return data.default as TagGroupData;
}

export async function getTagI18n(): Promise<Record<string, string>> {
  try {
    const data = await import("@/data/tag-i18n.json");
    return data.default as Record<string, string>;
  } catch {
    return {};
  }
}

export async function getClip(id: string): Promise<Clip | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "clips",
      `${id}.json`
    );
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Clip;
  } catch {
    return getClipFromPublicAsset(id);
  }
}
