import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "./route";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

describe("view history route", () => {
  it("rejects writes from an untrusted origin before loading the session", async () => {
    const response = await PUT(
      new NextRequest("https://reflix.dev/api/view-history", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ clipId: "clip-1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });

  it("returns 401 for guests on history reads", async () => {
    createServerSupabaseMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    });

    const response = await GET(
      new NextRequest("https://reflix.dev/api/view-history")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns timestamped history entries for the signed-in user", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: [
        {
          clip_id: "clip-b",
          viewed_at: "2026-03-29T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    const eqMock = vi.fn(() => ({ order: orderMock }));

    createServerSupabaseMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: eqMock,
        })),
      })),
    });

    const response = await GET(
      new NextRequest("https://reflix.dev/api/view-history")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entries: [
        {
          clipId: "clip-b",
          viewedAt: "2026-03-29T10:00:00.000Z",
        },
      ],
    });
  });

  it("accepts batched clip ids on trusted writes", async () => {
    const inMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEqMock = vi.fn(() => ({ in: inMock }));
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderMock = vi.fn(() => ({ range: rangeMock }));
    const eqSelectMock = vi.fn(() => ({ order: orderMock }));
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    createServerSupabaseMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table !== "user_view_history") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          upsert: upsertMock,
          select: vi.fn(() => ({
            eq: eqSelectMock,
          })),
          delete: vi.fn(() => ({
            eq: deleteEqMock,
          })),
        };
      }),
    });

    const response = await PUT(
      new NextRequest("https://reflix.dev/api/view-history", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://reflix.dev",
        },
        body: JSON.stringify({ clipIds: ["clip-a", "clip-b"] }),
      })
    );

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toHaveLength(2);
  });
});
