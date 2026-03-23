import "server-only";
import type { Locale } from "@/lib/types";

const dictionaries = {
  ko: () => import("./ko.json").then((m) => m.default),
  en: () => import("./en.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
