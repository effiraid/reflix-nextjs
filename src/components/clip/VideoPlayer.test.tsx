import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "./VideoPlayer";
import { useVideoKeyboard } from "./useVideoKeyboard";

const { getMediaUrlMock } = vi.hoisted(() => ({
  getMediaUrlMock: vi.fn((value: string) => `https://media.reflix.app${value}`),
}));

const { fetchBlobUrlMock } = vi.hoisted(() => ({
  fetchBlobUrlMock: vi.fn(async (url: string) => `blob:${url}`),
}));

vi.mock("@/lib/blobVideo", () => ({
  fetchBlobUrl: fetchBlobUrlMock,
}));

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: getMediaUrlMock,
}));

vi.mock("./SeekBar", () => ({
  SeekBar: ({
    onSeek,
    onDragStart,
    onDragEnd,
    onInPointChange,
    onOutPointChange,
    disabled,
  }: {
    currentTime: number;
    duration: number;
    inPoint: number;
    outPoint: number;
    onSeek: (time: number) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    onInPointChange: (time: number) => void;
    onOutPointChange: (time: number) => void;
    disabled?: boolean;
  }) => (
    <div
      data-testid="seekbar"
      data-disabled={disabled}
      onClick={() => onSeek(5)}
      onPointerDown={() => {
        onDragStart();
        onDragEnd();
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onInPointChange(1);
        }}
      >
        set-in
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOutPointChange(9);
        }}
      >
        set-out
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDragStart();
          onSeek(10);
        }}
      >
        drag-seek-10
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDragEnd();
        }}
      >
        end-drag
      </button>
    </div>
  ),
}));

vi.mock("./useVideoKeyboard", () => ({
  useVideoKeyboard: vi.fn(),
}));

describe("VideoPlayer", () => {
  beforeEach(() => {
    getMediaUrlMock.mockClear();
    fetchBlobUrlMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles play and pause from the custom button", async () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    let paused = true;
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(video, "play", {
      configurable: true,
      value: vi.fn(async () => {
        paused = false;
      }),
    });
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: vi.fn(() => {
        paused = true;
      }),
    });

    const toggle = screen.getByRole("button", { name: "Play video" });
    fireEvent.click(toggle);
    expect(video.play).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pause video" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause video" }));
    expect(video.pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play video" })).toBeInTheDocument();
  });

  it("disables video keyboard shortcuts when requested", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
        enableKeyboardShortcuts={false}
      />
    );

    expect(useVideoKeyboard).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
      })
    );
  });

  it("renders current progress time and total duration", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={125}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => 32,
    });

    fireEvent.timeUpdate(video);

    expect(screen.getByText("0:32 / 2:05")).toBeInTheDocument();
  });

  it("prevents the default context menu on the video surface", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    video.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("uses getMediaUrl for both video source and poster", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    expect(getMediaUrlMock).toHaveBeenCalledWith("/videos/clip-1.mp4");
    expect(getMediaUrlMock).toHaveBeenCalledWith("/thumbnails/clip-1.webp");
    expect(video.getAttribute("src")).toBe("https://media.reflix.app/videos/clip-1.mp4");
    expect(video.getAttribute("poster")).toBe(
      "https://media.reflix.app/thumbnails/clip-1.webp"
    );
  });

  it("starts muted autoplay when autoPlayMuted is enabled", async () => {
    const play = vi.fn(async () => undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: play,
    });

    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
        autoPlayMuted
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
  });

  it("falls back to a paused state when muted autoplay fails", async () => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(() => Promise.reject(new Error("autoplay blocked"))),
    });

    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
        autoPlayMuted
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play video" })).toBeInTheDocument();
    });
  });

  it("keeps the protected media URL and disables playback after a load error", () => {
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(() => undefined),
    });

    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;

    fireEvent.error(video);

    expect(video.getAttribute("src")).toBe("https://media.reflix.app/videos/clip-1.mp4");
    expect(
      screen.getByRole("button", { name: "Video unavailable" })
    ).toBeDisabled();
  });

  it("restores playback controls when the protected video URL changes", () => {
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(() => undefined),
    });

    const { rerender } = render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    fireEvent.error(document.querySelector("video") as HTMLVideoElement);

    expect(
      screen.getByRole("button", { name: "Video unavailable" })
    ).toBeDisabled();

    rerender(
      <VideoPlayer
        videoUrl="/videos/clip-2.mp4"
        thumbnailUrl="/thumbnails/clip-2.webp"
        duration={12}
      />
    );

    expect(screen.getByRole("button", { name: "Play video" })).toBeEnabled();
  });

  it("toggles playback when the external playback signal changes", async () => {
    const { rerender } = render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
        playbackToggleCount={0}
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    let paused = true;
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(video, "play", {
      configurable: true,
      value: vi.fn(async () => {
        paused = false;
      }),
    });
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: vi.fn(() => {
        paused = true;
      }),
    });

    rerender(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
        playbackToggleCount={1}
      />
    );
    await waitFor(() => {
      expect(video.play).toHaveBeenCalledTimes(1);
    });

    rerender(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
        playbackToggleCount={2}
      />
    );
    await waitFor(() => {
      expect(video.pause).toHaveBeenCalledTimes(1);
    });
  });

  it("toggles mute state when mute button is clicked", () => {
    render(
      <VideoPlayer videoUrl="/videos/clip-1.mp4" thumbnailUrl="/thumbnails/clip-1.webp" duration={12} />
    );
    const muteBtn = screen.getByRole("button", { name: "Mute" });
    expect(muteBtn).toBeInTheDocument();
    fireEvent.click(muteBtn);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });

  it("does not render a frame counter", async () => {
    render(
      <VideoPlayer videoUrl="/videos/clip-1.mp4" thumbnailUrl="/thumbnails/clip-1.webp" duration={12} />
    );
    const video = document.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", { configurable: true, get: () => 2 });
    fireEvent.timeUpdate(video);
    await waitFor(() => {
      expect(screen.queryByText(/^F:/)).not.toBeInTheDocument();
    });
  });

  it("toggles loop state when loop button is clicked", () => {
    render(
      <VideoPlayer videoUrl="/videos/clip-1.mp4" thumbnailUrl="/thumbnails/clip-1.webp" duration={12} />
    );
    const loopBtn = screen.getByRole("button", { name: "Disable loop" });
    fireEvent.click(loopBtn);
    expect(screen.getByRole("button", { name: "Enable loop" })).toBeInTheDocument();
  });

  it("restarts playback from the loop start when the video ends", async () => {
    render(
      <VideoPlayer videoUrl="/videos/clip-1.mp4" thumbnailUrl="/thumbnails/clip-1.webp" duration={12} />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    let paused = false;
    let currentTime = 12;

    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    Object.defineProperty(video, "play", {
      configurable: true,
      value: vi.fn(async () => {
        paused = false;
      }),
    });

    fireEvent.ended(video);

    await waitFor(() => {
      expect(video.play).toHaveBeenCalledTimes(1);
    });
    expect(currentTime).toBe(0);
  });

  it("allows dragging past the out point while loop is enabled", () => {
    render(
      <VideoPlayer videoUrl="/videos/clip-1.mp4" thumbnailUrl="/thumbnails/clip-1.webp" duration={12} />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    let paused = false;
    let currentTime = 0;

    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: vi.fn(() => {
        paused = true;
      }),
    });

    fireEvent.click(screen.getByText("set-in"));
    fireEvent.click(screen.getByText("set-out"));
    fireEvent.click(screen.getByText("drag-seek-10"));
    fireEvent.timeUpdate(video);

    expect(currentTime).toBe(10);
    expect(screen.getByText("0:10 / 0:12")).toBeInTheDocument();
  });

  it("seeks back to the in point when playback resumes outside the loop range", async () => {
    render(
      <VideoPlayer videoUrl="/videos/clip-1.mp4" thumbnailUrl="/thumbnails/clip-1.webp" duration={12} />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    let paused = true;
    let currentTime = 0;

    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    Object.defineProperty(video, "play", {
      configurable: true,
      value: vi.fn(async () => {
        paused = false;
      }),
    });
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: vi.fn(() => {
        paused = true;
      }),
    });

    fireEvent.click(screen.getByText("set-in"));
    fireEvent.click(screen.getByText("set-out"));
    fireEvent.click(screen.getByText("drag-seek-10"));
    fireEvent.click(screen.getByText("end-drag"));
    fireEvent.click(screen.getByRole("button", { name: "Play video" }));

    await waitFor(() => {
      expect(video.play).toHaveBeenCalledTimes(1);
    });
    expect(currentTime).toBe(1);
  });

  it("starts muted with mute button in compact mode", () => {
    render(
      <VideoPlayer videoUrl="/videos/clip-1.mp4" thumbnailUrl="/thumbnails/clip-1.webp" duration={12} compact />
    );
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });

  describe("Blob URL playback", () => {
    it("calls fetchBlobUrl when useBlobUrl is true", async () => {
      render(
        <VideoPlayer
          videoUrl="/videos/clip-1.mp4"
          thumbnailUrl="/thumbnails/clip-1.webp"
          duration={10}
          useBlobUrl
        />
      );

      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video.poster).toContain("clip-1.webp");

      await waitFor(() => {
        expect(fetchBlobUrlMock).toHaveBeenCalledWith(
          "https://media.reflix.app/videos/clip-1.mp4",
        );
      });
    });

    it("does not use blob URL when useBlobUrl is false (default)", () => {
      render(
        <VideoPlayer
          videoUrl="/videos/clip-1.mp4"
          thumbnailUrl="/thumbnails/clip-1.webp"
          duration={10}
        />
      );

      expect(fetchBlobUrlMock).not.toHaveBeenCalled();
    });
  });

  it("always renders a watermark over the video area", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    const watermark = screen.getByText("reflix.dev");
    expect(watermark).toBeInTheDocument();

    const wrapper = watermark.closest("[aria-hidden]") as HTMLElement;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper.className).toContain("pointer-events-none");
  });

  it("renders theme-aware chrome while keeping the video area black", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    expect(screen.getByTestId("video-player")).toHaveClass("bg-background");
    expect(screen.getByTestId("video-player-surface")).toHaveClass("bg-black");
    expect(screen.getByTestId("video-player-controls")).toHaveClass("bg-surface");
  });

  it("prevents page scroll when the wheel is used over the player controls", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
      />
    );

    const controls = screen.getByTestId("video-player-controls");
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });

    controls.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
