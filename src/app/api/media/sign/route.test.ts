import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const {
  cookiesMock,
  createServerClientMock,
  getMediaSessionConfigMock,
  signMediaUrlMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createServerClientMock: vi.fn(),
  getMediaSessionConfigMock: vi.fn(() => ({
    enabled: true,
    mediaBase: "https://media.reflix.dev",
    secret: "test-secret",
    domain: ".reflix.dev",
    ttlSeconds: 21600,
  })),
  signMediaUrlMock: vi.fn(async () => ({
    tok: "signed-token",
    sig: "signed-sig",
  })),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/mediaSession", () => ({
  getMediaSessionConfig: getMediaSessionConfigMock,
  signMediaUrl: signMediaUrlMock,
}));

describe("media sign route origin protection", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    createServerClientMock.mockReset();
    getMediaSessionConfigMock.mockClear();
    signMediaUrlMock.mockClear();
  });

  it("allows guest users to sign the exact clip shown on a detail page", async () => {
    cookiesMock.mockResolvedValueOnce({
      getAll: () => [],
    });
    createServerClientMock.mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
        })),
      },
    });

    const response = await POST(
      new NextRequest("https://reflix.dev/api/media/sign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://reflix.dev",
          referer: "https://reflix.dev/ko/clip/L3TR52T22TPVR",
        },
        body: JSON.stringify({ path: "/videos/L3TR52T22TPVR.mp4" }),
      })
    );

    expect(response.status).toBe(200);
    expect(signMediaUrlMock).toHaveBeenCalledWith(
      "/videos/L3TR52T22TPVR.mp4",
      "test-secret"
    );
    await expect(response.json()).resolves.toEqual({
      url: "https://media.reflix.dev/videos/L3TR52T22TPVR.mp4?tok=signed-token&sig=signed-sig",
    });
  });

  it("rejects guest signing requests from browse pages", async () => {
    cookiesMock.mockResolvedValueOnce({
      getAll: () => [],
    });
    createServerClientMock.mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
        })),
      },
    });

    const response = await POST(
      new NextRequest("https://reflix.dev/api/media/sign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://reflix.dev",
          referer: "https://reflix.dev/ko/browse?q=arcane",
        },
        body: JSON.stringify({ path: "/videos/L3TR52T22TPVR.mp4" }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("rejects signing requests from an untrusted origin before reading cookies", async () => {
    const response = await POST(
      new NextRequest("https://reflix.dev/api/media/sign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ path: "/videos/demo.mp4" }),
      })
    );

    expect(response.status).toBe(403);
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
