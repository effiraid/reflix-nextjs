import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVideoKeyboard } from "./useVideoKeyboard";

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("useVideoKeyboard", () => {
  it("calls togglePlayback on Space", () => {
    const togglePlayback = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback,
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
      })
    );
    fireKey(" ");
    expect(togglePlayback).toHaveBeenCalledTimes(1);
  });

  it("calls seekRelative(-1) on ArrowLeft", () => {
    const seekRelative = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative,
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
      })
    );
    fireKey("ArrowLeft");
    expect(seekRelative).toHaveBeenCalledWith(-1);
  });

  it("calls seekRelative(1) on ArrowRight", () => {
    const seekRelative = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative,
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
      })
    );
    fireKey("ArrowRight");
    expect(seekRelative).toHaveBeenCalledWith(1);
  });

  it("calls toggleMute on M key", () => {
    const toggleMute = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute,
        resetMarkers: vi.fn(),
      })
    );
    fireKey("m");
    expect(toggleMute).toHaveBeenCalledTimes(1);
  });

  it("calls resetMarkers on X key", () => {
    const resetMarkers = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers,
      })
    );
    fireKey("x");
    expect(resetMarkers).toHaveBeenCalledTimes(1);
  });

  it("ignores keys when disabled", () => {
    const togglePlayback = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback,
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        disabled: true,
      })
    );
    fireKey(" ");
    expect(togglePlayback).not.toHaveBeenCalled();
  });
});
