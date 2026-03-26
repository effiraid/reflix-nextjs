import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeekBar } from "./SeekBar";

describe("SeekBar", () => {
  const defaultProps = {
    currentTime: 3,
    duration: 10,
    inPoint: 0,
    outPoint: 10,
    onSeek: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onInPointChange: vi.fn(),
    onOutPointChange: vi.fn(),
  };

  it("renders the progress track with correct width", () => {
    render(<SeekBar {...defaultProps} />);
    const fill = screen.getByTestId("seekbar-fill");
    expect(fill.style.width).toBe("30%");
  });

  it("renders progress fill from the in point to the current time", () => {
    render(<SeekBar {...defaultProps} currentTime={6} inPoint={2} outPoint={8} />);
    const fill = screen.getByTestId("seekbar-fill");
    expect(fill.style.left).toBe("20%");
    expect(fill.style.width).toBe("40%");
  });

  it("renders In/Out markers at correct positions", () => {
    render(<SeekBar {...defaultProps} inPoint={2} outPoint={8} />);
    const inMarker = screen.getByTestId("in-marker");
    const outMarker = screen.getByTestId("out-marker");
    expect(inMarker.style.left).toBe("20%");
    expect(outMarker.style.left).toBe("80%");
  });

  it("renders the loop region highlight", () => {
    render(<SeekBar {...defaultProps} inPoint={2} outPoint={8} />);
    const region = screen.getByTestId("loop-region");
    expect(region.style.left).toBe("20%");
    expect(region.style.width).toBe("60%");
  });

  it("calls onSeek when the track is clicked", () => {
    const onSeek = vi.fn();
    render(<SeekBar {...defaultProps} onSeek={onSeek} />);
    const track = screen.getByTestId("seekbar-track");

    Object.defineProperty(track, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20 }),
    });

    fireEvent.click(track, { clientX: 100 });
    expect(onSeek).toHaveBeenCalledWith(5); // 100/200 * 10 = 5
  });

  it("calls onDragStart on pointerdown on handle", () => {
    const onDragStart = vi.fn();
    render(<SeekBar {...defaultProps} onDragStart={onDragStart} />);
    const handle = screen.getByTestId("seekbar-handle");
    fireEvent.pointerDown(handle);
    expect(onDragStart).toHaveBeenCalled();
  });

  it("starts scrubbing when dragging from the filled track", () => {
    const onSeek = vi.fn();
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <SeekBar
        {...defaultProps}
        onSeek={onSeek}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
    );

    const track = screen.getByTestId("seekbar-track");
    Object.defineProperty(track, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20 }),
    });

    fireEvent.pointerDown(screen.getByTestId("seekbar-fill"), { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 140, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onSeek).toHaveBeenNthCalledWith(1, 5);
    expect(onSeek).toHaveBeenLastCalledWith(7);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard seeking from the main seek slider", () => {
    const onSeek = vi.fn();
    render(<SeekBar {...defaultProps} onSeek={onSeek} />);

    const track = screen.getByTestId("seekbar-track");
    expect(track).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(track, { key: "ArrowRight" });

    expect(onSeek).toHaveBeenCalledWith(4);
  });

  it("clamps the in marker when adjusting it with the keyboard", () => {
    const onInPointChange = vi.fn();
    render(
      <SeekBar
        {...defaultProps}
        inPoint={7}
        outPoint={8}
        onInPointChange={onInPointChange}
      />
    );

    const inMarker = screen.getByTestId("in-marker");
    expect(inMarker).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(inMarker, { key: "ArrowRight" });

    expect(onInPointChange).toHaveBeenCalledWith(8);
  });

  it("clamps the out marker when adjusting it with the keyboard", () => {
    const onOutPointChange = vi.fn();
    render(
      <SeekBar
        {...defaultProps}
        inPoint={2}
        outPoint={3}
        onOutPointChange={onOutPointChange}
      />
    );

    const outMarker = screen.getByTestId("out-marker");
    expect(outMarker).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(outMarker, { key: "ArrowLeft" });

    expect(onOutPointChange).toHaveBeenCalledWith(2);
  });

  it("uses a thin vertical playback handle with a wider grab target", () => {
    render(<SeekBar {...defaultProps} inPoint={2} outPoint={8} />);

    expect(screen.getByTestId("seekbar-track")).toHaveClass("h-6");
    expect(screen.getByTestId("seekbar-fill")).toHaveClass("h-1");
    expect(screen.getByTestId("in-marker")).toHaveClass("h-4", "w-[3px]");
    expect(screen.getByTestId("out-marker")).toHaveClass("h-4", "w-[3px]");
    expect(screen.getByTestId("seekbar-handle")).toHaveClass("h-8", "w-6");
    expect(screen.getByTestId("seekbar-handle-bar")).toHaveClass("h-6", "w-[5px]");
  });
});
