export const BADGE_GAP_PX = 6;

export function getOverflowBadgeLabel(hiddenBadgeCount: number): string {
  return `+${hiddenBadgeCount}`;
}

export function getVisibleBadgeCount({
  badgeWidths,
  containerWidth,
  gapPx = BADGE_GAP_PX,
  getOverflowBadgeWidth,
}: {
  badgeWidths: number[];
  containerWidth: number;
  gapPx?: number;
  getOverflowBadgeWidth: (hiddenBadgeCount: number) => number;
}): number {
  if (badgeWidths.length === 0 || containerWidth <= 0) {
    return badgeWidths.length;
  }

  for (let visibleBadgeCount = badgeWidths.length; visibleBadgeCount >= 0; visibleBadgeCount -= 1) {
    const hiddenBadgeCount = badgeWidths.length - visibleBadgeCount;
    const visibleWidths = badgeWidths
      .slice(0, visibleBadgeCount)
      .reduce((sum, width) => sum + width, 0);
    const overflowWidth =
      hiddenBadgeCount > 0 ? getOverflowBadgeWidth(hiddenBadgeCount) : 0;
    const renderedBadgeCount =
      visibleBadgeCount + (hiddenBadgeCount > 0 ? 1 : 0);
    const totalGapWidth =
      renderedBadgeCount > 1 ? gapPx * (renderedBadgeCount - 1) : 0;
    const totalWidth = visibleWidths + overflowWidth + totalGapWidth;

    if (totalWidth <= containerWidth) {
      return visibleBadgeCount;
    }
  }

  return 0;
}
