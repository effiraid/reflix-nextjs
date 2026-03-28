import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClipRatingPanel } from "./ClipRatingPanel";
import { useAuthStore } from "@/stores/authStore";
import {
  getClipRatingCacheKey,
  useClipRatingStore,
} from "@/stores/clipRatingStore";

const {
  fetchClipRatingMock,
  saveClipRatingMock,
  deleteClipRatingMock,
} = vi.hoisted(() => ({
  fetchClipRatingMock: vi.fn(),
  saveClipRatingMock: vi.fn(),
  deleteClipRatingMock: vi.fn(),
}));

vi.mock("@/lib/clipRatingClient", () => ({
  fetchClipRating: fetchClipRatingMock,
  saveClipRating: saveClipRatingMock,
  deleteClipRating: deleteClipRatingMock,
}));

function setSignedInUser(id: string) {
  useAuthStore.setState({
    user: { id } as never,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ClipRatingPanel", () => {
  beforeEach(() => {
    fetchClipRatingMock.mockReset();
    saveClipRatingMock.mockReset();
    deleteClipRatingMock.mockReset();
    useAuthStore.setState({ user: null });
    useClipRatingStore.setState({ ratings: {}, loading: {} });
  });

  it("refetches ratings when the signed-in user changes", async () => {
    fetchClipRatingMock.mockImplementation(async () => {
      const userId = useAuthStore.getState().user?.id;
      return userId === "user-b"
        ? { rating: 2, memo: "memo b" }
        : { rating: 4, memo: "memo a" };
    });

    setSignedInUser("user-a");
    render(<ClipRatingPanel clipId="clip-1" lang="en" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Leave a note about this clip")
      ).toHaveValue("memo a");
    });

    act(() => {
      setSignedInUser("user-b");
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Leave a note about this clip")
      ).toHaveValue("memo b");
    });
  });

  it("keeps the memo textarea synced with shared store updates", async () => {
    fetchClipRatingMock.mockResolvedValueOnce({ rating: 4, memo: "memo a" });

    setSignedInUser("user-a");
    render(<ClipRatingPanel clipId="clip-1" lang="en" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Leave a note about this clip")
      ).toHaveValue("memo a");
    });

    act(() => {
      useClipRatingStore.getState().setRating(
        getClipRatingCacheKey("user-a", "clip-1"),
        { rating: 4, memo: "memo from another panel" }
      );
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Leave a note about this clip")
      ).toHaveValue("memo from another panel");
    });
  });

  it("does not start a second star save until the first one settles", async () => {
    const firstSave = deferred<{ rating: number | null; memo: string | null }>();

    fetchClipRatingMock.mockResolvedValueOnce({ rating: null, memo: null });
    saveClipRatingMock
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValueOnce({ rating: 5, memo: null });

    setSignedInUser("user-a");
    render(<ClipRatingPanel clipId="clip-1" lang="en" />);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "1" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    fireEvent.click(screen.getByRole("radio", { name: "5" }));

    expect(saveClipRatingMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve({ rating: 1, memo: null });
      await firstSave.promise;
    });

    await waitFor(() => {
      expect(saveClipRatingMock).toHaveBeenCalledTimes(2);
    });
    expect(saveClipRatingMock).toHaveBeenNthCalledWith(2, "clip-1", 5, null);
  });
});
