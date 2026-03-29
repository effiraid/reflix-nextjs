import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfiguredMediaBase, getMediaUrl } from "./mediaUrl";

describe("getConfiguredMediaBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an empty string when NEXT_PUBLIC_MEDIA_URL is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", undefined);

    expect(getConfiguredMediaBase()).toBe("");
  });

  it("trims whitespace and trailing slashes from NEXT_PUBLIC_MEDIA_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", " https://media.reflix.app/ ");

    expect(getConfiguredMediaBase()).toBe("https://media.reflix.app");
  });
});

describe("getMediaUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps relative paths relative when no media base is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", undefined);

    expect(getMediaUrl("/thumbnails/clip-1.webp")).toBe(
      "/thumbnails/clip-1.webp"
    );
    expect(getMediaUrl("previews/clip-1.mp4")).toBe("previews/clip-1.mp4");
  });

  it("keeps previews and thumbnails on the same origin even when a media base is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.app/");

    expect(getMediaUrl("/thumbnails/clip-1.webp")).toBe(
      "/thumbnails/clip-1.webp"
    );
    expect(getMediaUrl("previews/clip-1.mp4")).toBe(
      "previews/clip-1.mp4"
    );
  });

  it("prefixes full video paths with the configured media base", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.app/");

    expect(getMediaUrl("/videos/clip-1.mp4")).toBe(
      "https://media.reflix.app/videos/clip-1.mp4"
    );
    expect(getMediaUrl("videos/clip-1.mp4")).toBe(
      "https://media.reflix.app/videos/clip-1.mp4"
    );
  });

  it("passes through already-absolute URLs unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.app");

    expect(getMediaUrl("https://cdn.example.com/clip-1.webp")).toBe(
      "https://cdn.example.com/clip-1.webp"
    );
  });
});
