import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BrandSplash } from "./BrandSplash";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BrandSplash", () => {
  it("renders Reflix logo with brand-colored Ref", () => {
    render(<BrandSplash />);
    expect(screen.getByText("Ref")).toBeInTheDocument();
    expect(screen.getByText("lix")).toBeInTheDocument();
  });

  it("has role=status and aria-label", () => {
    render(<BrandSplash />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Loading");
  });

  it("calls onComplete after animation sequence", async () => {
    const onComplete = vi.fn();
    render(<BrandSplash onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();

    // fade-in 300ms
    await act(async () => { vi.advanceTimersByTime(300); });
    // hold 1000ms → triggers fade-out
    await act(async () => { vi.advanceTimersByTime(1000); });
    // fade-out 400ms → triggers done + onComplete
    await act(async () => { vi.advanceTimersByTime(400); });

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("auto-dismisses after 5 second timeout", async () => {
    const onComplete = vi.fn();
    render(<BrandSplash onComplete={onComplete} />);

    // Advance past max timeout
    await act(async () => { vi.advanceTimersByTime(5000); });
    // fade-out duration
    await act(async () => { vi.advanceTimersByTime(400); });

    expect(onComplete).toHaveBeenCalled();
  });

  it("removes from DOM after completion", async () => {
    const { container } = render(<BrandSplash />);

    expect(container.querySelector("[role='status']")).toBeInTheDocument();

    // Run full sequence
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => { vi.advanceTimersByTime(400); });

    expect(container.querySelector("[role='status']")).not.toBeInTheDocument();
  });

  it("renders without onComplete prop", async () => {
    render(<BrandSplash />);

    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => { vi.advanceTimersByTime(400); });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
