import { describe, expect, it } from "vitest";
import {
  MAX_THUMBNAIL_SIZE,
  MIN_THUMBNAIL_SIZE,
  clampThumbnailSize,
  getColumnCountFromThumbnailSize,
} from "./thumbnailSize";

describe("thumbnailSize helpers", () => {
  it("clamps the terminal zoom state to the new 1-column maximum", () => {
    expect(MIN_THUMBNAIL_SIZE).toBe(0);
    expect(MAX_THUMBNAIL_SIZE).toBe(4);
    expect(clampThumbnailSize(-1)).toBe(0);
    expect(clampThumbnailSize(99)).toBe(4);
  });

  it("maps the terminal zoom state to a single masonry column", () => {
    expect(getColumnCountFromThumbnailSize(0)).toBe(5);
    expect(getColumnCountFromThumbnailSize(1)).toBe(4);
    expect(getColumnCountFromThumbnailSize(2)).toBe(3);
    expect(getColumnCountFromThumbnailSize(3)).toBe(2);
    expect(getColumnCountFromThumbnailSize(4)).toBe(1);
  });
});
