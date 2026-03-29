import { afterEach, describe, expect, it, vi } from "vitest";
import { saveClipRating } from "./clipRatingClient";

describe("clipRatingClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a transient network failure when saving a rating", async () => {
    const savedRating = { rating: 4, memo: "memo" };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => savedRating,
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(saveClipRating("clip-1", 4, "memo")).resolves.toEqual(savedRating);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
