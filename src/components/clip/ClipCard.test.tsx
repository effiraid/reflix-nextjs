import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClipCard } from "./ClipCard";
import type { ClipIndex } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

const setSelectedClipIdMock = vi.fn();
const {
  authStoreState,
  authSelectors,
  getMediaUrlMock,
  clipStoreState,
  intersectionState,
} = vi.hoisted(() => ({
  authStoreState: {
    user: null as Record<string, unknown> | null,
    tier: "free" as "free" | "pro",
    isLoading: false,
  },
  authSelectors: [] as Array<(s: Record<string, unknown>) => unknown>,
  getMediaUrlMock: vi.fn((path: string) => path),
  clipStoreState: {
    selectedClipId: null as string | null,
  },
  intersectionState: {
    stage: "thumbnail" as "lqip" | "thumbnail" | "webp",
    isInView: false,
  },
}));

vi.mock("@/hooks/useIntersectionLoader", () => ({
  useIntersectionLoader: () => ({
    ref: { current: null },
    stage: intersectionState.stage,
    isInView: intersectionState.isInView,
  }),
}));

vi.mock("@/stores/clipStore", () => ({
  useClipStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const store = {
      selectedClipId: clipStoreState.selectedClipId,
      setSelectedClipId: setSelectedClipIdMock,
    };
    return selector ? selector(store) : store;
  },
}));

vi.mock("@/stores/authStore", () => {
  const useAuthStoreMock = (selector?: (s: Record<string, unknown>) => unknown) => {
    const store = {
      user: authStoreState.user,
      tier: authStoreState.tier,
      isLoading: authStoreState.isLoading,
    };

    if (!selector) {
      return store;
    }

    authSelectors.push(selector);
    return selector(store);
  };

  useAuthStoreMock.setState = (partial: Partial<typeof authStoreState>) => {
    Object.assign(authStoreState, partial);
  };

  return {
    useAuthStore: useAuthStoreMock,
  };
});

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: getMediaUrlMock,
}));

const clip: ClipIndex = {
  id: "clip-1",
  name: "연출 아케인 힘듦 일어나기 비몽사몽 비틀비틀 아픔",
  tags: ["아케인", "힘듦"],
  folders: [],
  category: "acting",
  width: 1920,
  height: 1080,
  duration: 8.6,
  previewUrl: "/preview.mp4",
  thumbnailUrl: "/thumb.webp",
  lqipBase64: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
};

describe("ClipCard", () => {
  beforeEach(() => {
    clipStoreState.selectedClipId = null;
    intersectionState.stage = "thumbnail";
    intersectionState.isInView = false;
    authSelectors.length = 0;
    useAuthStore.setState({
      user: null,
      tier: "free",
      isLoading: false,
    });
    setSelectedClipIdMock.mockReset();
    getMediaUrlMock.mockClear();
    getMediaUrlMock.mockImplementation((path: string) => path);
    useUIStore.setState({
      pricingModalOpen: false,
      pricingModalIntent: null,
    });
  });

  it("shows tags and duration with lighter default text that brightens on hover", () => {
    render(<ClipCard clip={clip} />);

    expect(screen.getByRole("button", { name: clip.name })).toBeInTheDocument();
    expect(screen.getByText("아케인, 힘듦")).toBeInTheDocument();
    expect(screen.getByText("8.6s")).toBeInTheDocument();

    const duration = screen.getByText("8.6s");
    const infoRow = duration.closest("div");
    const overlay = infoRow?.parentElement;

    expect(infoRow).not.toBeNull();
    expect(infoRow?.className).toContain("text-white/60");
    expect(infoRow?.className).toContain("group-hover:text-white");
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("bg-gradient-to-t");
    expect(overlay?.className).not.toContain("opacity-0");
    expect(overlay?.className).not.toContain("hover:opacity-100");
  });

  it("renders translated tag labels in english mode", () => {
    render(
      <ClipCard
        clip={clip}
        lang="en"
        tagI18n={{
          아케인: "Arcane",
          힘듦: "Fatigue",
        }}
      />
    );

    expect(screen.getByText("Arcane, Fatigue")).toBeInTheDocument();
    expect(screen.queryByText("아케인, 힘듦")).not.toBeInTheDocument();
  });

  it("does not render a Pro-only badge for legacy tiered clips", () => {
    render(
      <ClipCard
        clip={{ ...clip, accessTier: "pro" } as unknown as ClipIndex}
      />
    );

    expect(screen.queryByLabelText("Pro 전용 클립")).not.toBeInTheDocument();
  });

  it("blurs locked cards but keeps them clickable for the auth gate", () => {
    const onOpenQuickView = vi.fn();

    render(<ClipCard clip={clip} locked onOpenQuickView={onOpenQuickView} />);

    const card = screen.getByRole("button", { name: clip.name });
    const image = screen.getByAltText(clip.name);
    const overlay = screen.getByTestId("clip-lock-overlay");

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });

    expect(card).not.toHaveAttribute("aria-disabled");
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card.className).toContain("cursor-pointer");
    expect(image.className).toContain("blur-lg");
    expect(overlay).toHaveClass("bg-black/10");
    expect(overlay.firstElementChild).toHaveClass("size-8");
    expect(setSelectedClipIdMock).not.toHaveBeenCalled();
    expect(onOpenQuickView).not.toHaveBeenCalled();
    expect(useUIStore.getState().pricingModalOpen).toBe(true);
    expect(useUIStore.getState().pricingModalIntent).toMatchObject({
      kind: "locked-clip",
      viewerTier: "guest",
      clipId: clip.id,
    });
  });

  it("resolves the thumbnail path through the shared media URL helper", () => {
    render(<ClipCard clip={clip} />);

    expect(getMediaUrlMock).toHaveBeenCalledWith(clip.thumbnailUrl);
  });

  it("opens quick view on double click while keeping the clip selected", () => {
    const onOpenQuickView = vi.fn();

    render(<ClipCard clip={clip} onOpenQuickView={onOpenQuickView} />);

    fireEvent.doubleClick(screen.getByRole("button", { name: clip.name }));

    expect(setSelectedClipIdMock).toHaveBeenCalledWith(clip.id);
    expect(onOpenQuickView).toHaveBeenCalledWith(clip.id);
  });

  it("opens quick view on single click when the clip is already selected", () => {
    const onOpenQuickView = vi.fn();
    clipStoreState.selectedClipId = clip.id;

    render(<ClipCard clip={clip} onOpenQuickView={onOpenQuickView} />);

    fireEvent.click(screen.getByRole("button", { name: clip.name }));

    expect(setSelectedClipIdMock).not.toHaveBeenCalled();
    expect(onOpenQuickView).toHaveBeenCalledWith(clip.id);
  });

  it("only plays the preview on hover when hover playback is enabled", () => {
    intersectionState.stage = "webp";
    intersectionState.isInView = true;

    const { container } = render(<ClipCard clip={clip} previewOnHover />);
    const card = container.firstElementChild as HTMLElement;

    expect(container.querySelector("video")).not.toBeInTheDocument();

    fireEvent.mouseEnter(card);

    expect(container.querySelector("video")).toBeInTheDocument();

    fireEvent.mouseLeave(card);

    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("drops the preview video overlay after a preview load error", () => {
    intersectionState.stage = "webp";
    intersectionState.isInView = true;

    const { container } = render(<ClipCard clip={clip} />);
    const preview = container.querySelector("video");

    expect(preview).not.toBeNull();

    fireEvent.error(preview!);

    expect(container.querySelector("video")).not.toBeInTheDocument();
    expect(screen.getByAltText(clip.name)).toBeInTheDocument();
  });

  it("hides the clip info overlay when text display is disabled", () => {
    render(<ClipCard clip={clip} showInfo={false} />);

    expect(screen.queryByText("아케인, 힘듦")).not.toBeInTheDocument();
    expect(screen.queryByText("8.6s")).not.toBeInTheDocument();
  });

  it("marks prioritized thumbnails for eager loading above the fold", () => {
    render(<ClipCard clip={clip} prioritizeThumbnail />);

    expect(screen.getByAltText(clip.name)).toHaveAttribute("loading", "eager");
  });

  it("renders card imagery without Next fill mode so masonry cards do not warn on zero-height parents", () => {
    render(<ClipCard clip={clip} />);

    expect(screen.getByAltText(clip.name)).not.toHaveAttribute("data-nimg", "fill");
  });

  it("uses stable auth selector snapshots for Zustand subscriptions", () => {
    render(<ClipCard clip={clip} />);

    expect(authSelectors.length).toBeGreaterThan(0);

    const state = {
      user: authStoreState.user,
      tier: authStoreState.tier,
      isLoading: authStoreState.isLoading,
    };

    for (const selector of authSelectors) {
      expect(selector(state)).toBe(selector(state));
    }
  });

});
