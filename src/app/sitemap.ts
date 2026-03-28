import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

// Read at build time (sitemap is generated during build)
const raw = fs.readFileSync(
  path.join(process.cwd(), "public", "data", "index.json"),
  "utf-8"
);
const indexData = JSON.parse(raw) as { clips: Array<{ id: string }> };

const BASE_URL = "https://reflix.dev";
const LANGS = ["ko", "en"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Static pages per language
  const staticPages = LANGS.flatMap((lang) => [
    {
      url: `${BASE_URL}/${lang}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/${lang}/browse`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
  ]);

  // Clip detail pages per language
  const clipPages = LANGS.flatMap((lang) =>
    indexData.clips.map((clip) => ({
      url: `${BASE_URL}/${lang}/clip/${clip.id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  );

  return [...staticPages, ...clipPages];
}
