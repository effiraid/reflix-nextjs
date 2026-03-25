# Clip Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개별 클립 공유 기능 구현 — 다운로드 방지 강화 (Worker CORS + Referer 검증, Blob URL 재생) + 공유 UX (ShareButton, OG 메타태그)

**Architecture:** Cloudflare Worker에 CORS 및 Referer/Origin 검증을 추가하고, 클립 상세 페이지의 영상 재생을 Blob URL 방식으로 전환한다. 재사용 가능한 ShareButton 컴포넌트로 3개 위치에서 링크 복사 기능을 제공한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Cloudflare Workers, R2

**Spec:** `docs/superpowers/specs/2026-03-26-clip-sharing-design.md`

---

### Task 1: Worker CORS + Referer/Origin 검증

Worker에 CORS 헤더, OPTIONS preflight 핸들링, Referer/Origin 검증을 추가한다.

**Files:**
- Modify: `workers/media-gateway/src/index.ts`
- Modify: `workers/media-gateway/src/index.test.ts`
- Modify: `workers/media-gateway/wrangler.toml`

- [ ] **Step 1: wrangler.toml에 ALLOWED_ORIGINS 환경 변수 추가**

```toml
# workers/media-gateway/wrangler.toml 끝에 추가

[vars]
ALLOWED_ORIGINS = ""
```

- [ ] **Step 2: Worker 테스트에 CORS + Referer 검증 케이스 작성**

`workers/media-gateway/src/index.test.ts`에 다음 테스트를 추가한다. 기존 `Env` 타입에 `ALLOWED_ORIGINS`를 추가하고, 각 테스트의 env에도 반영한다.

```typescript
// 기존 env 팩토리에 ALLOWED_ORIGINS 추가
function createEnv(overrides?: Partial<typeof defaultEnv>) {
  return {
    MEDIA_SESSION_SECRET: "test-secret",
    MEDIA_BUCKET: { get: vi.fn(), head: vi.fn() },
    ALLOWED_ORIGINS: "",
    ...overrides,
  };
}

// === 기존 테스트의 env를 createEnv()로 교체 ===

// === 새 테스트 ===

describe("CORS", () => {
  it("responds to OPTIONS preflight with CORS headers", async () => {
    const env = createEnv();
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      method: "OPTIONS",
      headers: { Origin: "https://reflix.dev" },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://reflix.dev");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("includes CORS headers on GET responses", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () => createBucketObject({})),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: {
        Cookie: validCookie,
        Origin: "https://reflix.dev",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://reflix.dev");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("rejects OPTIONS from disallowed origin", async () => {
    const env = createEnv();
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.com" },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(403);
  });
});

describe("Referer/Origin validation", () => {
  it("allows requests with valid Origin header", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () => createBucketObject({})),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: {
        Cookie: validCookie,
        Origin: "https://reflix.dev",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
  });

  it("allows requests with valid Referer header", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () => createBucketObject({})),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: {
        Cookie: validCookie,
        Referer: "https://reflix.dev/ko/clip/abc",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
  });

  it("allows requests with neither Origin nor Referer (cookie-only)", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () => createBucketObject({})),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: { Cookie: validCookie },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
  });

  it("rejects requests with disallowed Origin", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () => createBucketObject({})),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: {
        Cookie: validCookie,
        Origin: "https://evil.com",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(403);
  });

  it("rejects subdomain spoofing like evil-reflix.dev", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      MEDIA_BUCKET: {
        get: vi.fn(async () => createBucketObject({})),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: {
        Cookie: validCookie,
        Origin: "https://evil-reflix.dev",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(403);
  });

  it("allows origins from ALLOWED_ORIGINS env var", async () => {
    const validCookie = await createValidCookie();
    const env = createEnv({
      ALLOWED_ORIGINS: "https://preview.vercel.app,https://staging.reflix.dev",
      MEDIA_BUCKET: {
        get: vi.fn(async () => createBucketObject({})),
        head: vi.fn(),
      },
    });
    const request = new Request("https://media.reflix.dev/videos/clip-1.mp4", {
      headers: {
        Cookie: validCookie,
        Origin: "https://preview.vercel.app",
      },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `npx vitest run workers/media-gateway/src/index.test.ts`
Expected: 새 테스트들 FAIL (CORS 헤더 없음, Origin 검증 없음)

- [ ] **Step 4: Worker에 CORS + Referer/Origin 검증 구현**

`workers/media-gateway/src/index.ts`를 수정한다:

```typescript
// Env 타입에 ALLOWED_ORIGINS 추가
type Env = {
  MEDIA_SESSION_SECRET: string;
  MEDIA_BUCKET: R2LikeBucket;
  ALLOWED_ORIGINS: string;
};

// isAllowedOrigin 함수 추가 (readCookie 아래)
function isAllowedOrigin(hostname: string, extraOrigins: string[]): boolean {
  if (
    hostname === "reflix.dev" ||
    hostname.endsWith(".reflix.dev") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return true;
  }

  return extraOrigins.some((allowed) => {
    try {
      return new URL(allowed).hostname === hostname;
    } catch {
      return false;
    }
  });
}

function getOriginHostname(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {
      return null;
    }
  }

  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      return null;
    }
  }

  return null; // 둘 다 없음 → 쿠키만으로 통과
}

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin") ?? "";
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range");
  return headers;
}

// Worker fetch 핸들러 수정
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const extraOrigins = env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Referer/Origin 검증 (보조 레이어)
    const hostname = getOriginHostname(request);
    if (hostname !== null && !isAllowedOrigin(hostname, extraOrigins)) {
      return new Response("Forbidden", { status: 403 });
    }

    // OPTIONS preflight
    if (request.method === "OPTIONS") {
      if (hostname === null || !isAllowedOrigin(hostname, extraOrigins)) {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" },
      });
    }

    // 썸네일은 공개 (CORS 헤더 불필요 — same-origin)
    if (url.pathname.startsWith("/thumbnails/")) {
      return serveR2Object(request, env, url.pathname.replace(/^\/+/, ""), false);
    }

    if (!isProtectedMediaPath(url.pathname)) {
      return new Response("Not Found", { status: 404 });
    }

    // 쿠키 검증 (주 방어선)
    const token = readCookie(request.headers.get("Cookie"), MEDIA_SESSION_COOKIE_NAME);
    const session = token
      ? await verifyMediaSessionToken(token, env.MEDIA_SESSION_SECRET, Date.now())
      : null;

    if (!session) {
      return new Response("Forbidden", { status: 403 });
    }

    // 보호된 미디어 응답에 CORS 헤더 추가
    const response = await serveR2Object(request, env, url.pathname.replace(/^\/+/, ""), true);
    const origin = request.headers.get("Origin");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
  },
};
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `npx vitest run workers/media-gateway/src/index.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add workers/media-gateway/
git commit -m "feat(worker): add CORS headers and Referer/Origin validation"
```

---

### Task 2: SameSite 쿠키 정책 변경

`proxy.ts`의 미디어 세션 쿠키를 `SameSite=Lax` → `SameSite=None`으로 변경하여 cross-origin fetch에서 쿠키가 포함되게 한다.

**Files:**
- Modify: `src/proxy.ts:33`

- [ ] **Step 1: proxy.ts의 SameSite 변경**

`src/proxy.ts` 33행:

```typescript
// 변경 전
sameSite: "lax",

// 변경 후
sameSite: "none",
```

- [ ] **Step 2: 기존 테스트 확인**

Run: `npx vitest run --reporter=verbose 2>&1 | head -60`
Expected: 기존 테스트 깨지지 않음

- [ ] **Step 3: 커밋**

```bash
git add src/proxy.ts
git commit -m "fix(proxy): change media session cookie SameSite to None for cross-origin fetch"
```

---

### Task 3: Blob URL 유틸리티

영상 URL을 fetch하여 Blob URL로 변환하는 유틸리티를 만든다.

**Files:**
- Create: `src/lib/blobVideo.ts`
- Create: `src/lib/blobVideo.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// src/lib/blobVideo.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBlobUrl } from "./blobVideo";

const mockCreateObjectURL = vi.fn(() => "blob:https://reflix.dev/fake-uuid");
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  globalThis.URL.createObjectURL = mockCreateObjectURL;
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchBlobUrl", () => {
  it("fetches video and returns blob URL", async () => {
    const mockBlob = new Blob(["video-data"], { type: "video/mp4" });
    globalThis.fetch = vi.fn(async () =>
      new Response(mockBlob, { status: 200 })
    );

    const result = await fetchBlobUrl("https://media.reflix.dev/videos/clip-1.mp4");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://media.reflix.dev/videos/clip-1.mp4",
      { credentials: "include", signal: undefined }
    );
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(result).toBe("blob:https://reflix.dev/fake-uuid");
  });

  it("throws on non-ok response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Forbidden", { status: 403 })
    );

    await expect(
      fetchBlobUrl("https://media.reflix.dev/videos/clip-1.mp4")
    ).rejects.toThrow("Media fetch failed: 403");
  });

  it("passes AbortSignal to fetch", async () => {
    const mockBlob = new Blob(["data"], { type: "video/mp4" });
    globalThis.fetch = vi.fn(async () => new Response(mockBlob, { status: 200 }));
    const controller = new AbortController();

    await fetchBlobUrl("https://media.reflix.dev/videos/clip-1.mp4", controller.signal);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://media.reflix.dev/videos/clip-1.mp4",
      { credentials: "include", signal: controller.signal }
    );
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npx vitest run src/lib/blobVideo.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```typescript
// src/lib/blobVideo.ts

/**
 * 영상 URL을 fetch하여 Blob URL로 변환한다.
 * credentials: 'include'로 세션 쿠키를 자동 포함한다.
 */
export async function fetchBlobUrl(
  videoUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(videoUrl, {
    credentials: "include",
    signal,
  });

  if (!res.ok) {
    throw new Error(`Media fetch failed: ${res.status}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/blobVideo.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/blobVideo.ts src/lib/blobVideo.test.ts
git commit -m "feat: add blobVideo utility for Blob URL video playback"
```

---

### Task 4: ShareButton 컴포넌트

재사용 가능한 공유 버튼 컴포넌트를 만든다. 클릭 시 URL 복사 → 버튼 상태 변경.

**Files:**
- Create: `src/components/clip/ShareButton.tsx`
- Create: `src/components/clip/ShareButton.test.tsx`
- Modify: `src/components/clip/PlayerIcons.tsx` (ShareIcon, CheckIcon 추가)
- Modify: `src/app/[lang]/dictionaries/ko.json` (`clip.copied` 추가)
- Modify: `src/app/[lang]/dictionaries/en.json` (`clip.copied` 추가)

- [ ] **Step 1: PlayerIcons에 ShareIcon, CheckIcon 추가**

`src/components/clip/PlayerIcons.tsx` 파일 끝에 추가:

```typescript
export function ShareIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
```

- [ ] **Step 2: 딕셔너리에 `clip.copied` 키 추가**

`src/app/[lang]/dictionaries/ko.json`의 `clip` 블록에 추가:

```json
"copied": "복사됨"
```

`src/app/[lang]/dictionaries/en.json`의 `clip` 블록에 추가:

```json
"copied": "Copied"
```

- [ ] **Step 3: ShareButton 테스트 작성**

```typescript
// src/components/clip/ShareButton.test.tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);

    await user.click(screen.getByRole("button", { name: /공유/ }));

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining("/ko/clip/abc123")
    );
  });

  it("shows copied state after click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);

    await user.click(screen.getByRole("button", { name: /공유/ }));

    expect(screen.getByRole("button")).toHaveTextContent("복사됨");
  });

  it("reverts to idle state after 2 seconds", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);

    await user.click(screen.getByRole("button", { name: /공유/ }));
    expect(screen.getByRole("button")).toHaveTextContent("복사됨");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button")).toHaveTextContent("공유");
  });

  it("uses fallback when clipboard API fails", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("denied"));
    document.execCommand = vi.fn(() => true);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ShareButton clipId="abc123" lang="ko" label="공유" copiedLabel="복사됨" />);

    await user.click(screen.getByRole("button", { name: /공유/ }));

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(screen.getByRole("button")).toHaveTextContent("복사됨");
  });
});
```

- [ ] **Step 4: 테스트 실행하여 실패 확인**

Run: `npx vitest run src/components/clip/ShareButton.test.tsx`
Expected: FAIL (모듈 없음)

- [ ] **Step 5: ShareButton 구현**

```typescript
// src/components/clip/ShareButton.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShareIcon, CheckIcon } from "./PlayerIcons";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}

interface ShareButtonProps {
  clipId: string;
  lang: string;
  label: string;
  copiedLabel: string;
  variant?: "default" | "icon-only";
  className?: string;
}

export function ShareButton({
  clipId,
  lang,
  label,
  copiedLabel,
  variant = "default",
  className = "",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    const url = `${window.location.origin}/${lang}/clip/${clipId}`;
    const ok = await copyToClipboard(url);

    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [clipId, lang]);

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void handleClick();
      }}
      aria-label={copied ? copiedLabel : label}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
      {variant === "default" && (
        <span className="ml-1.5">{copied ? copiedLabel : label}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/components/clip/ShareButton.test.tsx`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/components/clip/ShareButton.tsx src/components/clip/ShareButton.test.tsx src/components/clip/PlayerIcons.tsx src/app/[lang]/dictionaries/ko.json src/app/[lang]/dictionaries/en.json
git commit -m "feat: add ShareButton component with clipboard copy and state feedback"
```

---

### Task 5: VideoPlayer Blob URL 통합

VideoPlayer에서 원본 영상 재생 시 Blob URL 방식을 사용하도록 전환한다.

**Files:**
- Modify: `src/components/clip/VideoPlayer.tsx`
- Modify: `src/components/clip/VideoPlayer.test.tsx`

- [ ] **Step 1: VideoPlayer 테스트에 Blob URL 케이스 추가**

`src/components/clip/VideoPlayer.test.tsx`에 추가. 기존 mock 블록 근처에 `blobVideo` mock을 추가한다:

```typescript
const { fetchBlobUrlMock } = vi.hoisted(() => ({
  fetchBlobUrlMock: vi.fn(async (url: string) => `blob:${url}`),
}));

vi.mock("@/lib/blobVideo", () => ({
  fetchBlobUrl: fetchBlobUrlMock,
}));
```

테스트 추가:

```typescript
describe("Blob URL playback", () => {
  it("sets video src to blob URL when useBlobUrl is true", async () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={10}
        useBlobUrl
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    // 초기에는 poster 상태 (Blob URL 로딩 중)
    expect(video.poster).toContain("clip-1.webp");

    await waitFor(() => {
      expect(fetchBlobUrlMock).toHaveBeenCalledWith(
        "https://media.reflix.app/videos/clip-1.mp4",
        expect.any(AbortSignal)
      );
    });
  });

  it("does not use blob URL when useBlobUrl is false (default)", () => {
    render(
      <VideoPlayer
        videoUrl="/videos/clip-1.mp4"
        thumbnailUrl="/thumbnails/clip-1.webp"
        duration={10}
      />
    );

    expect(fetchBlobUrlMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: 새 테스트 FAIL

- [ ] **Step 3: VideoPlayer에 Blob URL 지원 추가**

`src/components/clip/VideoPlayer.tsx` 변경:

Props에 `useBlobUrl` 추가:

```typescript
interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  compact?: boolean;
  playbackToggleCount?: number;
  autoPlayMuted?: boolean;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  useBlobUrl?: boolean;  // 추가
}
```

import 추가:

```typescript
import { fetchBlobUrl } from "@/lib/blobVideo";
```

컴포넌트 본문에서 `resolvedVideoUrl` 로직 변경:

```typescript
// 기존
const resolvedVideoUrl = getMediaUrl(videoUrl);

// 변경: useBlobUrl이면 Blob URL을 사용, 아니면 기존 방식
const directVideoUrl = getMediaUrl(videoUrl);
const [blobUrl, setBlobUrl] = useState<string | null>(null);
const blobUrlRef = useRef<string | null>(null);

// Blob URL fetch effect
useEffect(() => {
  if (!useBlobUrl) return;

  const controller = new AbortController();
  fetchBlobUrl(directVideoUrl, controller.signal)
    .then((url) => {
      blobUrlRef.current = url;
      setBlobUrl(url);
    })
    .catch(() => {
      // fetch 실패 시 직접 URL로 폴백하지 않음 — poster 상태 유지
    });

  return () => {
    controller.abort();
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };
}, [directVideoUrl, useBlobUrl]);

const resolvedVideoUrl = useBlobUrl ? (blobUrl ?? "") : directVideoUrl;
```

`<video>` 엘리먼트에서 `src` 처리: blobUrl이 빈 문자열이면 src를 제거하여 poster만 보여줌:

```typescript
<video
  ref={videoRef}
  src={resolvedVideoUrl || undefined}
  poster={resolvedThumbnailUrl}
  // ... 나머지 동일
/>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/components/clip/VideoPlayer.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/clip/VideoPlayer.tsx src/components/clip/VideoPlayer.test.tsx
git commit -m "feat(VideoPlayer): add useBlobUrl prop for Blob URL playback"
```

---

### Task 6: ShareButton을 QuickViewModal에 통합

QuickViewModal의 기존 공유 버튼을 ShareButton 컴포넌트로 교체한다.

**Files:**
- Modify: `src/components/clip/QuickViewModal.tsx:132-143`

- [ ] **Step 1: QuickViewModal에 ShareButton 통합**

`src/components/clip/QuickViewModal.tsx`의 import에 추가:

```typescript
import { ShareButton } from "@/components/clip/ShareButton";
```

132~143행의 기존 공유 버튼을 교체:

```typescript
// 변경 전 (132~143행)
<button
  type="button"
  className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface/80"
  onClick={() => {
    void navigator.clipboard.writeText(
      `${window.location.origin}/${lang}/clip/${clip.id}`
    );
  }}
>
  {dict.clip.share}
</button>

// 변경 후
<ShareButton
  clipId={clip.id}
  lang={lang}
  label={dict.clip.share}
  copiedLabel={dict.clip.copied}
  className="flex flex-1 items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface/80"
/>
```

- [ ] **Step 2: QuickViewModal 테스트 dict fixture에 `copied` 추가**

`src/components/clip/QuickViewModal.test.tsx`의 mock dict에 `copied` 키를 추가한다. 기존 `clip` 객체 안에:

```typescript
copied: "Copied",
```

- [ ] **Step 3: 기존 QuickViewModal 테스트 확인**

Run: `npx vitest run src/components/clip/QuickViewModal.test.tsx`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/components/clip/QuickViewModal.tsx src/components/clip/QuickViewModal.test.tsx
git commit -m "refactor(QuickViewModal): replace inline share button with ShareButton component"
```

---

### Task 7: ShareButton을 RightPanelInspector에 통합

미구현 상태인 RightPanelInspector의 공유 버튼을 ShareButton으로 연결한다.

**Files:**
- Modify: `src/components/layout/RightPanelInspector.tsx:130-135`

- [ ] **Step 1: RightPanelInspector에 ShareButton 통합**

import 추가:

```typescript
import { ShareButton } from "@/components/clip/ShareButton";
```

130~135행의 기존 버튼을 교체:

```typescript
// 변경 전 (130~135행)
<button
  type="button"
  className="flex w-full items-center justify-center rounded-xl border border-border bg-surface px-4 py-3 font-medium transition-colors hover:bg-surface/80"
>
  {dict.clip.share}
</button>

// 변경 후
<ShareButton
  clipId={clip.id}
  lang={lang}
  label={dict.clip.share}
  copiedLabel={dict.clip.copied}
  className="flex w-full items-center justify-center rounded-xl border border-border bg-surface px-4 py-3 font-medium transition-colors hover:bg-surface/80"
/>
```

- [ ] **Step 2: RightPanelInspector 테스트 dict fixture에 `copied` 추가**

`src/components/layout/RightPanelInspector.test.tsx`의 mock dict에 `copied` 키를 추가한다. 기존 `clip` 객체 안에:

```typescript
copied: "Copied",
```

- [ ] **Step 3: 기존 RightPanelInspector 테스트 확인**

Run: `npx vitest run src/components/layout/RightPanelInspector.test.tsx`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/components/layout/RightPanelInspector.tsx src/components/layout/RightPanelInspector.test.tsx
git commit -m "feat(RightPanelInspector): connect ShareButton to share button"
```

---

### Task 8: ClipDetailView에 ShareButton 추가 + useBlobUrl 활성화

클립 상세 페이지에 공유 버튼을 추가하고, VideoPlayer에 Blob URL을 활성화한다.

**Files:**
- Modify: `src/components/clip/ClipDetailView.tsx`

- [ ] **Step 1: ClipDetailView에 ShareButton과 useBlobUrl 추가**

import 추가:

```typescript
import { ShareButton } from "@/components/clip/ShareButton";
```

`ClipDetailView` 컴포넌트에서 VideoPlayer에 `useBlobUrl` 추가:

```typescript
<VideoPlayer
  videoUrl={clip.videoUrl}
  thumbnailUrl={clip.thumbnailUrl}
  duration={clip.duration}
  useBlobUrl
/>
```

제목 섹션(`<section className="space-y-3">`) 안에 ShareButton 추가:

```typescript
<section className="space-y-3">
  <div className="flex items-center justify-between gap-4">
    <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
    <ShareButton
      clipId={clip.id}
      lang={lang}
      label={dict.clip.share}
      copiedLabel={dict.clip.copied}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface/80"
    />
  </div>
  {clip.annotation ? (
    <p className="max-w-3xl text-sm leading-7 text-muted">
      {clip.annotation}
    </p>
  ) : null}
</section>
```

- [ ] **Step 2: ClipDetailView 테스트에 ShareButton mock 및 dict fixture 업데이트**

`src/components/clip/ClipDetailView.test.tsx`에 추가:

1. `ShareButton` mock 추가 (기존 mock 블록 근처):

```typescript
vi.mock("@/components/clip/ShareButton", () => ({
  ShareButton: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
}));
```

2. mock dict의 `clip` 객체에 `copied` 키 추가:

```typescript
copied: "Copied",
```

- [ ] **Step 3: 기존 ClipDetailView 테스트 확인**

Run: `npx vitest run src/components/clip/ClipDetailView.test.tsx`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/components/clip/ClipDetailView.tsx src/components/clip/ClipDetailView.test.tsx
git commit -m "feat(ClipDetailView): add ShareButton and enable Blob URL playback"
```

---

### Task 9: OG 메타태그 보강

클립 상세 페이지의 `generateMetadata()`에 누락된 OG 태그를 추가한다.

**Files:**
- Modify: `src/app/[lang]/clip/[id]/page.tsx:22-62`

- [ ] **Step 1: generateMetadata 보강**

`src/app/[lang]/clip/[id]/page.tsx`의 `generateMetadata` 함수를 수정한다:

```typescript
export async function generateMetadata({
  params,
}: ClipDetailPageProps): Promise<Metadata> {
  const { lang, id } = await params;
  const clip = await getCachedClip(id);

  if (!clip) {
    return {
      title: "Clip Not Found | Reflix",
    };
  }

  const locale = lang as Locale;
  const title = clip.i18n.title[locale] || clip.name;
  const description = clip.annotation || `${clip.category} · ${clip.tags.join(", ")}`;

  const origin = getDeploymentOrigin();
  // 썸네일은 앱 도메인에서 서빙 (공개 자산, 크롤러 접근 가능)
  const thumbnailUrl = clip.thumbnailUrl.startsWith("http")
    ? clip.thumbnailUrl
    : origin
      ? `${origin}${clip.thumbnailUrl}`
      : null;

  return {
    title: `${title} | Reflix`,
    description,
    openGraph: {
      title,
      description,
      url: origin ? `${origin}/${locale}/clip/${id}` : undefined,
      siteName: "Reflix",
      type: "video.other",
      images: thumbnailUrl
        ? [{ url: thumbnailUrl, width: clip.width, height: clip.height }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: thumbnailUrl ? [thumbnailUrl] : undefined,
    },
  };
}
```

주요 변경:
- `openGraph.url` 추가
- `openGraph.siteName` 추가
- `openGraph.type`을 `"video.other"`로 변경
- `description` 폴백에 카테고리 포함

- [ ] **Step 2: 빌드 체크**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 타입 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/[lang]/clip/[id]/page.tsx
git commit -m "feat(clip-detail): enhance OG meta tags for social sharing"
```

---

### Task 10: 전체 테스트 + 린트

모든 변경 사항이 기존 테스트를 깨뜨리지 않는지 확인한다.

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx vitest run`
Expected: 모든 테스트 PASS

- [ ] **Step 2: 린트 확인**

Run: `npm run lint`
Expected: 에러 없음

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 문제 있으면 수정 후 커밋**

문제가 발견되면 수정하고:

```bash
git add -A
git commit -m "fix: resolve lint/type issues from sharing feature"
```
