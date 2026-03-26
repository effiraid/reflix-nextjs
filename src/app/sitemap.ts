import type { MetadataRoute } from "next";
import indexData from "@/data/index.json";

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
