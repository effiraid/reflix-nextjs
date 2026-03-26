import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVideoKeyboard } from "./useVideoKeyboard";

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function fireKeyFrom(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
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
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
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
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
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
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
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
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
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
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
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
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
        disabled: true,
      })
    );
    fireKey(" ");
    expect(togglePlayback).not.toHaveBeenCalled();
  });

  it("does not hijack arrow keys from focused slider controls", () => {
    const seekRelative = vi.fn();
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    document.body.appendChild(slider);

    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative,
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
      })
    );

    fireKeyFrom(slider, "ArrowRight");

    expect(seekRelative).not.toHaveBeenCalled();

    slider.remove();
  });

  it("calls toggleFullscreen on F key", () => {
    const toggleFullscreen = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        toggleFullscreen,
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
      })
    );
    fireKey("f");
    expect(toggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("calls setInPointHere on I or [ key", () => {
    const setInPointHere = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        toggleFullscreen: vi.fn(),
        setInPointHere,
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
      })
    );
    fireKey("i");
    fireKey("[");
    expect(setInPointHere).toHaveBeenCalledTimes(2);
  });

  it("calls setOutPointHere on O or ] key", () => {
    const setOutPointHere = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere,
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
      })
    );
    fireKey("o");
    fireKey("]");
    expect(setOutPointHere).toHaveBeenCalledTimes(2);
  });

  it("calls toggleLoop on L key", () => {
    const toggleLoop = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop,
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed: vi.fn(),
      })
    );
    fireKey("l");
    expect(toggleLoop).toHaveBeenCalledTimes(1);
  });

  it("calls stepBackward on , key and stepForward on . key", () => {
    const stepBackward = vi.fn();
    const stepForward = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward,
        stepBackward,
        stepSpeed: vi.fn(),
      })
    );
    fireKey(",");
    fireKey(".");
    expect(stepBackward).toHaveBeenCalledTimes(1);
    expect(stepForward).toHaveBeenCalledTimes(1);
  });

  it("calls stepSpeed with direction on -/+ keys", () => {
    const stepSpeed = vi.fn();
    renderHook(() =>
      useVideoKeyboard({
        togglePlayback: vi.fn(),
        seekRelative: vi.fn(),
        toggleMute: vi.fn(),
        resetMarkers: vi.fn(),
        toggleFullscreen: vi.fn(),
        setInPointHere: vi.fn(),
        setOutPointHere: vi.fn(),
        toggleLoop: vi.fn(),
        stepForward: vi.fn(),
        stepBackward: vi.fn(),
        stepSpeed,
      })
    );
    fireKey("-");
    fireKey("+");
    expect(stepSpeed).toHaveBeenCalledWith(-1);
    expect(stepSpeed).toHaveBeenCalledWith(1);
  });
});
