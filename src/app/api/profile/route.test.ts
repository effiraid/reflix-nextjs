import { describe, expect, it, vi } from "vitest";
import { PUT } from "./route";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

describe("profile route origin protection", () => {
  it("rejects updates from an untrusted origin before touching auth state", async () => {
    const response = await PUT(
      new Request("https://reflix.dev/api/profile", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ display_name: "Neo" }),
      })
    );

    expect(response.status).toBe(403);
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });
});
