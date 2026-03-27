import type {
  BrowseProjectionRecord,
  BrowseSummaryRecord,
  ClipIndexData,
  CategoryTree,
  TagGroupData,
  Clip,
} from "./types";
import { buildBrowseArtifactsFromClipIndex } from "./browse-data";

export function getDeploymentOrigin(): string | null {
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
  } catch (e) {
    console.error("[data] Failed to fetch clip from public asset:", id, e);
    return null;
  }
}

async function readPublicJson<T>(...segments: string[]): Promise<T> {
  const fs = await import("fs");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "public", ...segments);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function getClipIndex(): Promise<ClipIndexData> {
  const data = await import("@/data/index.json");
  return data.default as ClipIndexData;
}

export async function loadBrowseSummary(): Promise<BrowseSummaryRecord[]> {
  try {
    return await readPublicJson<BrowseSummaryRecord[]>(
      "data",
      "browse",
      "summary.json"
    );
  } catch {
    const clipIndex = await getClipIndex();
    return buildBrowseArtifactsFromClipIndex(clipIndex.clips).summary;
  }
}

export async function loadBrowseProjection(): Promise<BrowseProjectionRecord[]> {
  try {
    return await readPublicJson<BrowseProjectionRecord[]>(
      "data",
      "browse",
      "projection.json"
    );
  } catch {
    const clipIndex = await getClipIndex();
    return buildBrowseArtifactsFromClipIndex(clipIndex.clips).projection;
  }
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
  } catch (e) {
    console.error("[data] Failed to load tag-i18n.json:", e);
    return {};
  }
}

export async function getClip(id: string): Promise<Clip | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  try {
    return await readPublicJson<Clip>("data", "clips", `${id}.json`);
  } catch (e) {
    console.warn("[data] Local clip file not found, falling back to public asset:", id, e);
    return getClipFromPublicAsset(id);
  }
}
