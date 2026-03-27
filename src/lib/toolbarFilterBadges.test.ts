import { describe, expect, it } from "vitest";
import {
  BADGE_GAP_PX,
  getOverflowBadgeLabel,
  getVisibleBadgeCount,
} from "./toolbarFilterBadges";

describe("toolbarFilterBadges", () => {
  it("shows every badge when they fit within the available width", () => {
    expect(
      getVisibleBadgeCount({
        badgeWidths: [52, 48, 56],
        containerWidth: 180,
        gapPx: BADGE_GAP_PX,
        getOverflowBadgeWidth: () => 58,
      })
    ).toBe(3);
  });

  it("keeps as many badges as possible and reserves room for the overflow badge", () => {
    expect(
      getVisibleBadgeCount({
        badgeWidths: [52, 48, 56, 50],
        containerWidth: 170,
        gapPx: BADGE_GAP_PX,
        getOverflowBadgeWidth: () => 58,
      })
    ).toBe(2);
  });

  it("falls back to only the overflow badge when no regular badge fits", () => {
    expect(
      getVisibleBadgeCount({
        badgeWidths: [92, 84, 76],
        containerWidth: 60,
        gapPx: BADGE_GAP_PX,
        getOverflowBadgeWidth: () => 54,
      })
    ).toBe(0);
  });

  it("formats the overflow badge label in korean", () => {
    expect(getOverflowBadgeLabel(3, "ko")).toBe("외 3건");
  });

  it("formats the overflow badge label in english", () => {
    expect(getOverflowBadgeLabel(2, "en")).toBe("+2 more");
  });
});
