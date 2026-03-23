import { describe, expect, it } from "vitest";
import { formatClipDuration, getClipMediaKind } from "./clipInspector";

describe("clipInspector", () => {
  it("formats short clip durations as mm:ss", () => {
    expect(formatClipDuration(3.7)).toBe("00:04");
    expect(formatClipDuration(65.1)).toBe("01:05");
    expect(formatClipDuration(-1)).toBe("00:00");
    expect(formatClipDuration(-61)).toBe("00:00");
  });

  it("formats long clip durations as hh:mm:ss", () => {
    expect(formatClipDuration(3661)).toBe("01:01:01");
  });

  it("detects video clip media kinds from extensions", () => {
    expect(getClipMediaKind("mp4")).toBe("video");
    expect(getClipMediaKind(".MOV")).toBe("video");
  });

  it("detects image clip media kinds from extensions", () => {
    expect(getClipMediaKind("webp")).toBe("image");
    expect(getClipMediaKind(".PNG")).toBe("image");
  });
});
