import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedCategorySection } from "./FeedCategorySection";
import type { BrowseClipRecord } from "@/lib/types";

const { clipCardProps } = vi.hoisted(() => ({
  clipCardProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/clip/ClipCard", () => ({
  ClipCard: (props: Record<string, unknown>) => {
    clipCardProps.push(props);
    return <div data-testid={`clip-card-${String((props.clip as { id: string }).id)}`} />;
  },
}));

const hero: BrowseClipRecord = {
  id: "hero-clip",
  name: "Hero Clip",
  thumbnailUrl: "/hero.webp",
  previewUrl: "/hero.mp4",
  lqipBase64: "",
  width: 1280,
  height: 720,
  duration: 3,
  category: "action",
};

const subs: BrowseClipRecord[] = [
  {
    id: "sub-1",
    name: "Sub Clip 1",
    thumbnailUrl: "/sub-1.webp",
    previewUrl: "/sub-1.mp4",
    lqipBase64: "",
    width: 1280,
    height: 720,
    duration: 2,
    category: "action",
  },
  {
    id: "sub-2",
    name: "Sub Clip 2",
    thumbnailUrl: "/sub-2.webp",
    previewUrl: "/sub-2.mp4",
    lqipBase64: "",
    width: 1280,
    height: 720,
    duration: 2,
    category: "action",
  },
];

describe("FeedCategorySection", () => {
  beforeEach(() => {
    clipCardProps.length = 0;
  });

  it("prioritizes the hero thumbnail because it is the feed LCP candidate", () => {
    render(
      <FeedCategorySection
        title="이동"
        clipCount={3}
        hero={hero}
        subs={subs}
        lang="ko"
        onViewAll={vi.fn()}
        onOpenQuickView={vi.fn()}
      />
    );

    expect(clipCardProps[0]).toMatchObject({
      clip: hero,
      prioritizeThumbnail: true,
    });
  });
});
