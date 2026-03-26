import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "./ShareButton";

describe("ShareButton", () => {
  const mockWriteText = vi.fn(async () => {});

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("copies clip URL to clipboard on click", async () => {
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /공유/ }));
    });
    expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining("/ko/clip/abc123"));
  });

  it("shows copied state after click", async () => {
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /공유/ }));
    });
    expect(screen.getByRole("button")).toHaveTextContent("복사됨");
  });

  it("reverts to idle state after 2 seconds", async () => {
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /공유/ }));
    });
    expect(screen.getByRole("button")).toHaveTextContent("복사됨");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole("button")).toHaveTextContent("공유");
  });

  it("uses fallback when clipboard API fails", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("denied"));
    document.execCommand = vi.fn(() => true);
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /공유/ }));
    });
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(screen.getByRole("button")).toHaveTextContent("복사됨");
  });
});
