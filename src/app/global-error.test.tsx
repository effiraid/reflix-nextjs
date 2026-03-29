import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException,
}));

vi.mock("next/error", () => ({
  default: ({ statusCode }: { statusCode: number }) => (
    <div>NextError:{statusCode}</div>
  ),
}));

describe("GlobalError", () => {
  it("reports the error to Sentry and renders the fallback error page", async () => {
    const error = new Error("boom");

    render(<GlobalError error={error} />);

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledWith(error);
    });

    expect(screen.getByText("NextError:0")).toBeInTheDocument();
  });
});
