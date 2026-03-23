import { describe, expect, it } from "vitest";
import { getCategoryLabel } from "./categories";
import type { CategoryTree } from "./types";

const categories: CategoryTree = {
  combat: {
    slug: "combat",
    i18n: {
      ko: "전투",
      en: "Combat",
    },
    children: {
      ultimate: {
        slug: "ultimate",
        i18n: {
          ko: "필살기",
          en: "Ultimate",
        },
      },
    },
  },
};

describe("getCategoryLabel", () => {
  it("returns the localized label for a category id", () => {
    expect(getCategoryLabel("ultimate", categories, "ko")).toBe("필살기");
    expect(getCategoryLabel("ultimate", categories, "en")).toBe("Ultimate");
  });

  it("falls back to the id when the category is unknown", () => {
    expect(getCategoryLabel("UNKNOWN_ID", categories, "ko")).toBe("UNKNOWN_ID");
  });
});
