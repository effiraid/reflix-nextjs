import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "./VideoPlayer";

const { getMediaUrlMock } = vi.hoisted(() => ({
  getMediaUrlMock: vi.fn((value: string) => `https://media.reflix.app${value}`),
}));

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: getMediaUrlMock,
}));

describe("VideoPlayer", () => {
  beforeEach(() => {
    getMediaUrlMock.mockClear();
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

  it("hides the speed control and starts muted in compact mode", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={12}
        compact
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(screen.queryByRole("button", { name: "Speed" })).not.toBeInTheDocument();
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

    expect(screen.getByText("00:32 / 02:05")).toBeInTheDocument();
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
});
