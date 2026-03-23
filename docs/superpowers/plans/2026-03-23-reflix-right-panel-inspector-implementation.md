# Right Panel Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Eagle Lite redesign for the selected-clip right sidebar without adding editing behavior.

**Architecture:** Keep `RightPanelContent` as the client-side fetch container that loads `/public/data/clips/{id}.json`, but move the new inspector presentation into a focused `RightPanelInspector` component. Add small pure helpers for folder-label lookup, media-kind labeling, and duration formatting so the UI stays simple and testable. Pass `categories` from the browse route down to the inspector so folder IDs render as human-readable labels.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Zustand, Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-23-reflix-right-panel-inspector-design.md`

**Working tree note:** The repository is already dirty. Never stage or revert unrelated files. Every commit in this plan stages only the files listed in the task.

---

## Scope Check

This plan covers a single subsystem: the selected-clip right sidebar on `/[lang]/browse`. It does not touch the grid, left panel, export pipeline, or any editing workflows, so one plan is sufficient.

## File Structure

```
src/
├── app/
│   └── [lang]/
│       ├── browse/
│       │   └── page.tsx                          ← Pass `categories` into RightPanelContent
│       └── dictionaries/
│           ├── ko.json                           ← Add inspector-specific labels
│           └── en.json                           ← Add inspector-specific labels
├── components/
│   └── layout/
│       ├── RightPanel.tsx                        ← Slightly wider shell for the inspector
│       ├── RightPanelContent.tsx                 ← Fetch container; pass clip + categories through
│       ├── RightPanelInspector.tsx               ← New presentational inspector layout
│       └── RightPanelInspector.test.tsx          ← UI coverage for approved layout
└── lib/
    ├── categories.ts                            ← Add folder-label lookup helper
    ├── categories.test.ts                       ← Unit tests for folder-label lookup
    ├── clipInspector.ts                         ← Duration + media-kind helpers
    └── clipInspector.test.ts                    ← Unit tests for metadata helpers
```

## Task Overview

| # | Task | 설명 |
|---|------|------|
| 1 | Inspector Strings & Formatters | `공유`, `동영상/이미지`, `링크 없음` 문자열과 포맷 헬퍼 추가 |
| 2 | Folder Label Lookup | `clip.folders` ID를 현재 로케일 레이블로 변환 |
| 3 | Inspector UI & Wiring | 새 inspector 컴포넌트 작성, route/container/shell 연결 |
| 4 | Verification & Finish | 테스트, lint, 수동 확인, 안전한 커밋 |

---

## Task 1: Inspector Strings & Formatters

**Files:**
- Create: `src/lib/clipInspector.ts`
- Create: `src/lib/clipInspector.test.ts`
- Modify: `src/app/[lang]/dictionaries/ko.json`
- Modify: `src/app/[lang]/dictionaries/en.json`

- [ ] **Step 1: Write the failing formatter tests**

Create `src/lib/clipInspector.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { formatClipDuration, getClipMediaKind } from "./clipInspector";

describe("formatClipDuration", () => {
  it("rounds short clips into mm:ss", () => {
    expect(formatClipDuration(3.7)).toBe("00:04");
    expect(formatClipDuration(65.1)).toBe("01:05");
  });

  it("formats long clips into hh:mm:ss", () => {
    expect(formatClipDuration(3661)).toBe("01:01:01");
  });
});

describe("getClipMediaKind", () => {
  it("maps common video extensions", () => {
    expect(getClipMediaKind("mp4")).toBe("video");
    expect(getClipMediaKind(".MOV")).toBe("video");
  });

  it("maps common image extensions", () => {
    expect(getClipMediaKind("webp")).toBe("image");
    expect(getClipMediaKind(".PNG")).toBe("image");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/lib/clipInspector.test.ts
```

Expected: FAIL because `src/lib/clipInspector.ts` does not exist yet.

- [ ] **Step 3: Implement the inspector metadata helpers**

Create `src/lib/clipInspector.ts`:

```ts
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v", "avi", "mkv"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

function normalizeExtension(ext: string): string {
  return ext.trim().replace(/^\./, "").toLowerCase();
}

export function getClipMediaKind(ext: string): "video" | "image" {
  const normalized = normalizeExtension(ext);
  if (VIDEO_EXTENSIONS.has(normalized)) return "video";
  if (IMAGE_EXTENSIONS.has(normalized)) return "image";
  return "image";
}

export function formatClipDuration(durationInSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationInSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
```

Note: returning `"image"` as the fallback is acceptable for the current dataset because the approved UI only distinguishes `동영상` vs `이미지`, and current clip assets are still image/video only.

- [ ] **Step 4: Add localized inspector strings**

Update `src/app/[lang]/dictionaries/ko.json` under `clip`:

```json
"inspectorRating": "평가",
"inspectorDuration": "지속 시간",
"fileType": "파일 형식",
"share": "공유",
"video": "동영상",
"image": "이미지",
"noLink": "링크 없음"
```

Update `src/app/[lang]/dictionaries/en.json` under `clip`:

```json
"inspectorRating": "Rating",
"inspectorDuration": "Duration",
"fileType": "File Type",
"share": "Share",
"video": "Video",
"image": "Image",
"noLink": "No link"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/lib/clipInspector.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit only the touched files**

Run:

```bash
git add src/lib/clipInspector.ts src/lib/clipInspector.test.ts 'src/app/[lang]/dictionaries/ko.json' 'src/app/[lang]/dictionaries/en.json'
git commit -m "feat: add right panel inspector metadata helpers"
```

---

## Task 2: Folder Label Lookup

**Files:**
- Modify: `src/lib/categories.ts`
- Create: `src/lib/categories.test.ts`

- [ ] **Step 1: Write the failing category-label tests**

Create `src/lib/categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCategoryLabel } from "./categories";
import type { CategoryTree } from "./types";

const categories: CategoryTree = {
  combat: {
    slug: "combat",
    i18n: { ko: "교전", en: "Combat" },
    children: {
      ultimate: {
        slug: "ultimate",
        i18n: { ko: "필살기", en: "Ultimate" },
      },
    },
  },
};

describe("getCategoryLabel", () => {
  it("returns nested labels in the requested locale", () => {
    expect(getCategoryLabel("ultimate", categories, "ko")).toBe("필살기");
    expect(getCategoryLabel("ultimate", categories, "en")).toBe("Ultimate");
  });

  it("falls back to the folder id when the node does not exist", () => {
    expect(getCategoryLabel("UNKNOWN_ID", categories, "ko")).toBe("UNKNOWN_ID");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/lib/categories.test.ts
```

Expected: FAIL because `getCategoryLabel` is not exported yet.

- [ ] **Step 3: Implement the lookup helper**

Update `src/lib/categories.ts`:

```ts
import type { CategoryNode, CategoryTree, Locale } from "./types";

export function getCategoryLabel(
  id: string,
  tree: CategoryTree,
  lang: Locale
): string {
  const node = findNode(id, tree);
  return node?.i18n[lang] ?? id;
}
```

Keep the existing `findNode()` recursion and reuse it instead of introducing a second tree walker.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/lib/categories.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit only the touched files**

Run:

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat: add folder label lookup for inspector"
```

---

## Task 3: Inspector UI & Wiring

**Files:**
- Create: `src/components/layout/RightPanelInspector.tsx`
- Create: `src/components/layout/RightPanelInspector.test.tsx`
- Modify: `src/components/layout/RightPanel.tsx`
- Modify: `src/components/layout/RightPanelContent.tsx`
- Modify: `src/app/[lang]/browse/page.tsx`

- [ ] **Step 1: Read the relevant Next.js App Router guide before touching the route file**

Run:

```bash
sed -n '1,120p' node_modules/next/dist/docs/01-app/index.md
```

Expected: reminder that App Router route files use React Server Components patterns and should keep server/client boundaries explicit.

- [ ] **Step 2: Write the failing inspector UI test**

Create `src/components/layout/RightPanelInspector.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RightPanelInspector } from "./RightPanelInspector";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip } from "@/lib/types";

const categories: CategoryTree = {
  folderRoot: {
    slug: "combat",
    i18n: { ko: "교전", en: "Combat" },
    children: {
      folderChild: {
        slug: "ultimate",
        i18n: { ko: "필살기", en: "Ultimate" },
      },
    },
  },
};

const clip: Clip = {
  id: "clip-1",
  name: "연출 한손 검 필살기",
  ext: "mp4",
  size: 261111,
  width: 640,
  height: 360,
  duration: 7.6,
  tags: ["검", "한손", "연출"],
  folders: ["folderChild"],
  star: 2,
  annotation: "작품 메모",
  url: "",
  palettes: [{ color: [10, 20, 30], ratio: 80 }],
  btime: 0,
  mtime: 0,
  i18n: {
    title: { ko: "연출 한손 검 필살기", en: "One-hand sword finisher" },
    description: { ko: "", en: "" },
  },
  videoUrl: "/videos/clip-1.mp4",
  thumbnailUrl: "/thumbnails/clip-1.webp",
  previewUrl: "/previews/clip-1.mp4",
  lqipBase64: "",
  category: "combat",
  relatedClips: [],
};

const dict = {
  clip: {
    folders: "폴더",
    tags: "태그",
    properties: "속성",
    memo: "메모",
    sourceUrl: "소스 URL",
    inspectorRating: "평가",
    inspectorDuration: "지속 시간",
    fileType: "파일 형식",
    share: "공유",
    video: "동영상",
    image: "이미지",
    noLink: "링크 없음",
    colorPalette: "색상 팔레트",
  },
} satisfies Pick<Dictionary, "clip">;

describe("RightPanelInspector", () => {
  it("renders the approved folder/tag/property layout", () => {
    render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByText("필살기")).toBeInTheDocument();
    expect(screen.getByText("검")).toBeInTheDocument();
    expect(screen.getByText("공유")).toBeInTheDocument();
    expect(screen.getByText("동영상")).toBeInTheDocument();
    expect(screen.queryByText("규격")).not.toBeInTheDocument();
    expect(screen.queryByText("파일 크기")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the UI test to verify it fails**

Run:

```bash
npx vitest run src/components/layout/RightPanelInspector.test.tsx
```

Expected: FAIL because `RightPanelInspector.tsx` does not exist yet.

- [ ] **Step 4: Build the presentational inspector and wire it in**

Create `src/components/layout/RightPanelInspector.tsx` with these responsibilities:

```tsx
"use client";

import { MEDIA_BASE_URL } from "@/lib/constants";
import { getCategoryLabel } from "@/lib/categories";
import { formatClipDuration, getClipMediaKind } from "@/lib/clipInspector";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip, Locale } from "@/lib/types";

interface RightPanelInspectorProps {
  clip: Clip;
  categories: CategoryTree;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
}

export function RightPanelInspector({
  clip,
  categories,
  lang,
  dict,
}: RightPanelInspectorProps) {
  const title = clip.i18n.title[lang] || clip.name;
  const folderLabels = clip.folders.map((id) => getCategoryLabel(id, categories, lang));
  const mediaKind = getClipMediaKind(clip.ext) === "video" ? dict.clip.video : dict.clip.image;
  const previewUrl = `${MEDIA_BASE_URL}${clip.thumbnailUrl}`;
  const swatches = clip.palettes.slice(0, 6);

  return (
    <div className="p-4">
      <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,#3a3b40_0%,#33353a_100%)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
        <div className="relative overflow-hidden rounded-2xl">
          <img src={previewUrl} alt={title} className="h-44 w-full object-cover" />
          <span className="absolute left-3 top-3 rounded-xl bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
            {clip.ext.toUpperCase()}
          </span>
        </div>

        {swatches.length > 0 && (
          <div className="mt-4 flex w-fit gap-2 rounded-full bg-white/5 px-3 py-2">
            {swatches.map((palette, index) => (
              <span
                key={`${palette.color.join("-")}-${index}`}
                className="h-5 w-5 rounded-full border border-white/10"
                style={{ backgroundColor: `rgb(${palette.color.join(",")})` }}
              />
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3 text-sm text-white">
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">{title}</div>
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-white/65">
            {clip.annotation || dict.clip.memo}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-white/65">
            {clip.url || dict.clip.noLink}
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="mb-2 text-xs font-medium text-white/60">{dict.clip.folders}</div>
            <div className="flex flex-wrap gap-2">
              {folderLabels.map((label) => (
                <span key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="mb-2 text-xs font-medium text-white/60">{dict.clip.tags}</div>
            <div className="flex flex-wrap gap-2">
              {clip.tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-xs text-amber-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="mb-2 text-xs font-medium text-white/60">{dict.clip.properties}</div>
            <dl className="grid grid-cols-[84px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-white/60">{dict.clip.inspectorRating}</dt>
              <dd>{"★".repeat(clip.star)}{"☆".repeat(5 - clip.star)}</dd>
              <dt className="text-white/60">{dict.clip.inspectorDuration}</dt>
              <dd>{formatClipDuration(clip.duration)}</dd>
              <dt className="text-white/60">{dict.clip.fileType}</dt>
              <dd>{mediaKind}</dd>
            </dl>
          </div>
        </div>

        <button type="button" className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-white/5 bg-white/5 text-sm text-white">
          {dict.clip.share}
        </button>
      </div>
    </div>
  );
}
```

Then wire the shell/container:

1. Update `src/components/layout/RightPanel.tsx` width from `w-72` to `w-80`.
2. Update `src/app/[lang]/browse/page.tsx` to pass `categories={categories}` into `RightPanelContent`.
3. Update `src/components/layout/RightPanelContent.tsx` props:

```tsx
import { RightPanelInspector } from "./RightPanelInspector";
import type { CategoryTree, Clip, Locale } from "@/lib/types";

interface RightPanelContentProps {
  lang: Locale;
  dict: Dictionary;
  categories: CategoryTree;
}
```

And render:

```tsx
if (!clip) return null;

return (
  <RightPanelInspector
    clip={clip}
    categories={categories}
    lang={lang}
    dict={dict}
  />
);
```

Keep the existing fetch/abort logic intact. The only container changes should be prop typing and delegating render to `RightPanelInspector`.

- [ ] **Step 5: Run the UI test to verify it passes**

Run:

```bash
npx vitest run src/components/layout/RightPanelInspector.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit only the touched files**

Run:

```bash
git add src/components/layout/RightPanel.tsx src/components/layout/RightPanelContent.tsx src/components/layout/RightPanelInspector.tsx src/components/layout/RightPanelInspector.test.tsx 'src/app/[lang]/browse/page.tsx'
git commit -m "feat: redesign right panel inspector layout"
```

---

## Task 4: Verification & Finish

**Files:**
- No new files expected
- If a verification issue requires a fix, stage only the files from Tasks 1-3 that changed

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
npx vitest run src/lib/clipInspector.test.ts src/lib/categories.test.ts src/components/layout/RightPanelInspector.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run lint on the touched files**

Run:

```bash
npx eslint src/lib/clipInspector.ts src/lib/clipInspector.test.ts src/lib/categories.ts src/lib/categories.test.ts src/components/layout/RightPanel.tsx src/components/layout/RightPanelContent.tsx src/components/layout/RightPanelInspector.tsx src/components/layout/RightPanelInspector.test.tsx 'src/app/[lang]/browse/page.tsx' 'src/app/[lang]/dictionaries/ko.json' 'src/app/[lang]/dictionaries/en.json'
```

Expected: no lint errors in touched files.

- [ ] **Step 3: Run the app and verify the approved UI manually**

Run:

```bash
npm run dev
```

Manual checklist on `http://localhost:3000/ko/browse`:

- Select a clip card so the right panel opens
- Confirm the panel is visibly wider than before
- Confirm the layout order is `preview → palette → title/memo/link → folders → tags → properties → 공유`
- Confirm `속성` only shows `평가`, `지속 시간`, `파일 형식`
- Confirm `파일 형식` reads `동영상` for an mp4 clip
- Confirm folder IDs are rendered as localized labels, not raw IDs

- [ ] **Step 4: Commit any final verification fixes**

If verification required no changes, skip this commit.

If verification required a small fix, run:

```bash
git add <only-the-files-you-fixed>
git commit -m "fix: polish right panel inspector details"
```

---

## Plan Review

Use the writing-plans review checklist against:

- Plan: `docs/superpowers/plans/2026-03-23-reflix-right-panel-inspector-implementation.md`
- Spec: `docs/superpowers/specs/2026-03-23-reflix-right-panel-inspector-design.md`

Approval criteria:

- No placeholder steps or TODOs
- Every approved spec requirement is covered
- Folder label mapping path is explicit
- Implementer can execute tasks without guessing

Because this session cannot dispatch reviewer subagents unless the user explicitly asks for them, perform this review locally if no subagent was requested.
