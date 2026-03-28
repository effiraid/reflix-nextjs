import { describe, expect, it } from "vitest";
import en from "./en.json";

describe("English dictionary", () => {
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
