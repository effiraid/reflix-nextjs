import { describe, expect, it } from "vitest";
import ko from "./ko.json";
import en from "./en.json";

function flattenLeaves(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenLeaves(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("English dictionary", () => {
  it("keeps all locale keys aligned with the Korean source dictionary", () => {
    const koKeys = flattenLeaves(ko);
    const enKeys = flattenLeaves(en);

    expect({
      missingInEn: koKeys.filter((key) => !enKeys.includes(key)),
      extraInEn: enKeys.filter((key) => !koKeys.includes(key)),
    }).toEqual({
      missingInEn: [],
      extraInEn: [],
    });
  });

  it("preserves the reviewed English marketing and UI copy", () => {
    expect(en.landing).toMatchObject({
      heroTitleMobile: "A reference engine\nfor animation",
      heroTitleMobileCompact: "Animation\nreference\nengine",
      heroSubMobile:
        "Curated animation and game clips.\nFind the exact motion with tags,\nAI analysis, and frame-by-frame playback.",
      heroPills: "Combat,Emotion,Cinematics,Running,Effects,Arcane,Magic",
      featureTagDesc:
        "37 tag groups. Hundreds of tags.\nFind the exact clip with one keyword.",
      featureTagBadges: "Arcane,Running,Exhausted",
    });

    expect(en.browse.recentlyUsed).toBe("Recent History");
    expect(en.browse.modeDirection).toBe("Cinematics");
    expect(en.clip.detail).toBe("View Details");
    expect(en.auth.manageViaStripe).toBe(
      "You can manage your subscription in the Stripe Customer Portal."
    );
    expect(en.pricing.currentPlan).toBe("Subscribed");
  });
});
