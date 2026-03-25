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
});
