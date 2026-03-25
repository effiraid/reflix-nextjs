import "server-only";
import type { Locale } from "@/lib/types";

const dictionaries = {
  ko: () => import("./ko.json").then((m) => m.default),
  en: () => import("./en.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  try {
    return await dictionaries[locale]();
  } catch (e) {
    console.error(`[dictionaries] Failed to load ${locale}, falling back to ko:`, e);
    return dictionaries.ko();
  }
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
