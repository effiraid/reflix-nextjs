import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

describe("user ratings route origin protection", () => {
  it("rejects writes from an untrusted origin before loading the session", async () => {
    const response = await PUT(
      new NextRequest("https://reflix.dev/api/user-ratings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          clipId: "clip-1",
          rating: 5,
          memo: "great",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });
});
