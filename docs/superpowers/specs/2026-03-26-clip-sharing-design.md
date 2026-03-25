# Clip Sharing Design

## Goal

개별 클립의 공유 기능을 구현한다. 공유 링크는 기존 클립 상세 페이지 URL을 그대로 사용하며, 다운로드 방지를 서버/클라이언트 양쪽에서 강화한다.

## Prerequisites

이 스펙은 `2026-03-24-reflix-protected-mp4-delivery-design.md`의 아키텍처(Cloudflare Worker + 세션 쿠키)가 구현된 상태를 전제한다.

## Scope

### In Scope

- Cloudflare Worker에 Referer/Origin 검증 추가
- 상세 페이지 영상 재생을 Blob URL 방식으로 전환
- `ShareButton` 재사용 컴포넌트
- OG 메타태그 확인/보강

### Not In Scope

- 컬렉션/검색결과/보드 공유 (추후 별도 스펙)
- 임베드 뷰 (`/embed/{id}`) (추후 별도 스펙)
- HLS 스트리밍, DRM, 워터마킹
- 만료 링크, 비밀번호 보호, 인증

## Design

### 1. CORS 및 Referer/Origin 검증 (Cloudflare Worker)

기존 Worker의 세션 쿠키 검증에 CORS 지원과 Referer/Origin 헤더 검증을 추가한다.

#### CORS (Cross-Origin Resource Sharing)

앱(`reflix.dev`)에서 미디어(`media.reflix.dev`)로의 cross-origin fetch가 동작하려면 Worker 응답에 CORS 헤더가 필요하다.

**Worker 응답 헤더:**
```
Access-Control-Allow-Origin: https://reflix.dev
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Range
```

**OPTIONS preflight 핸들링:** Worker는 `OPTIONS` 요청에 위 헤더를 포함한 204 응답을 반환한다.

**쿠키 정책 변경:** 선행 스펙의 세션 쿠키가 `SameSite=Lax`로 설정되어 있으나, `SameSite=Lax` 쿠키는 cross-origin subresource 요청(fetch)에 포함되지 않는다. Blob URL fetch가 동작하려면 쿠키를 `SameSite=None; Secure`로 변경해야 한다. 이 변경은 선행 스펙(`2026-03-24-reflix-protected-mp4-delivery-design.md`)의 cookie 옵션 섹션에도 반영한다.

#### Referer/Origin 검증

**매칭 로직:** `URL` 파싱 후 hostname 비교 방식을 사용한다.

```typescript
function isAllowedOrigin(hostname: string): boolean {
  return hostname === 'reflix.dev'
    || hostname.endsWith('.reflix.dev')
    || hostname === 'localhost'
    || hostname === '127.0.0.1';
}
```

**검증 순서:**
1. `Origin` 헤더가 있으면 → `new URL(origin).hostname`으로 검증
2. `Origin`이 없고 `Referer` 헤더가 있으면 → `new URL(referer).hostname`으로 검증
3. **둘 다 없는 경우** → 쿠키 검증만으로 통과 허용. 일부 브라우저/Referrer-Policy 설정에서 정상 요청에도 헤더가 누락될 수 있으므로, Referer 부재만으로 차단하지 않는다.
4. 헤더가 있지만 허용 도메인이 아닌 경우 → 403 Forbidden

**환경 변수:**
- `ALLOWED_ORIGINS` — 추가 허용 origin 목록 (쉼표 구분). 하드코딩된 `reflix.dev` 패턴과 **합산**된다. Worker의 wrangler.toml에서 환경별로 설정. 예: Vercel preview 도메인.

**주의:** Referer 검증은 보조 수단이다. 쿠키 검증이 주 방어선이고, Referer는 curl 등으로 직접 URL 접근을 차단하는 추가 레이어다.

### 2. Blob URL 재생 (VideoPlayer)

클립 상세 페이지(`/[lang]/clip/[id]`)의 원본 영상 재생을 Blob URL 방식으로 전환한다.

**적용 범위:**
- 상세 페이지 `VideoPlayer`의 원본 영상 (`/videos/{id}.mp4`) — Blob URL 적용
- QuickViewModal의 영상 — **프리뷰 영상**(`/previews/{id}.mp4`, ~70KB)을 사용하므로 직접 URL 유지. QuickView는 빈번하게 열고 닫히므로 매번 fetch → Blob 변환 시 UX 저하. 원본 영상이 필요한 경우(상세 페이지 전환) 그때 Blob URL 적용.
- 브라우즈 그리드 프리뷰 (`/previews/{id}.mp4`) — 현행 유지 (직접 URL). 카드 수만큼 fetch가 발생하므로 성능 이슈.

**구현:**

```typescript
// src/lib/blobVideo.ts

/**
 * 영상 URL을 fetch하여 Blob URL로 변환한다.
 * credentials: 'include'로 세션 쿠키를 자동 포함한다.
 */
export async function fetchBlobUrl(
  videoUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(videoUrl, {
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error(`Media fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
```

**VideoPlayer 변경:**

1. 마운트 시 `fetchBlobUrl()` 호출
2. 로딩 중: 기존 poster(LQIP/WebP 썸네일) 표시
3. Blob URL 준비 완료: `<video src={blobUrl}>` 할당, 자동 재생 시작하지 않음
4. 언마운트 시: `URL.revokeObjectURL(blobUrl)` 호출하여 메모리 해제
5. fetch 실패 시: poster 상태 유지, 재생 불가 (기존 failure policy와 동일)

**메모리 영향:** 원본 영상 평균 1.3MB. 한 번에 하나의 클립만 재생하므로 메모리 문제 없음.

**Range 요청과의 관계:** Blob URL은 전체 파일을 메모리에 올리므로 seek 시 추가 네트워크 요청이 발생하지 않는다. Worker의 Range 요청 처리는 Blob URL 방식에서는 사용되지 않지만, 프리뷰 등 직접 URL 재생에서 여전히 필요하다.

### 3. ShareButton 컴포넌트

클립 공유 버튼을 하나의 재사용 컴포넌트로 만든다.

**파일:** `src/components/clip/ShareButton.tsx`

**Props:**

```typescript
interface ShareButtonProps {
  clipId: string;
  lang: string;
  /** 버튼 스타일 변형. 기본값 'default' */
  variant?: 'default' | 'icon-only';
  className?: string;
}
```

**동작:**

1. 사용자가 버튼 클릭
2. `navigator.clipboard.writeText()` 로 `${window.location.origin}/${lang}/clip/${clipId}` 복사. 로컬 개발 시 `http://localhost:3000/...`이 복사되며 이는 의도된 동작이다. production에서는 `https://reflix.dev/...`가 복사된다.
3. 버튼 상태가 `idle` → `copied`로 전환
   - idle: 공유 아이콘 + "공유" 텍스트 (icon-only면 아이콘만)
   - copied: 체크 아이콘 + "복사됨" 텍스트 (icon-only면 체크 아이콘만)
4. 2초 후 `idle`로 복원

**클립보드 API 폴백:**

```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback for older browsers / non-HTTPS
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
```

**사용처:**

| 위치 | variant | 비고 |
|------|---------|------|
| QuickViewModal | `default` | 기존 공유 버튼 교체 |
| RightPanelInspector | `default` | 미구현 onClick 연결 |
| ClipDetail 페이지 | `default` | 새로 추가 |

**i18n:** 기존 딕셔너리의 `dict.clip.share` 키 사용. `copied` 상태용 키 추가 필요: `dict.clip.copied`.

### 4. OG 메타태그

클립 상세 페이지의 OG 메타태그를 확인하고 누락분을 보강한다.

**필수 태그:**

Next.js의 `generateMetadata()` API로 설정한다:

```typescript
// src/app/[lang]/clip/[id]/page.tsx
export async function generateMetadata({ params }: PageProps<'/[lang]/clip/[id]'>): Promise<Metadata> {
  const { lang, id } = await params;
  const clip = await getClip(id);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reflix.dev';
  // og:image는 공개 썸네일 사용 — 보호 대상이 아님
  // thumbnails는 앱 도메인에서 서빙 (media.reflix.dev가 아닌 reflix.dev)
  // 크롤러가 쿠키 없이도 접근 가능해야 하므로
  const thumbnailUrl = `${siteUrl}/thumbnails/${id}.webp`;

  return {
    title: clip.i18n.title[lang],
    description: `${clip.category} · ${clip.tags.join(', ')}`,
    openGraph: {
      title: clip.i18n.title[lang],
      description: `${clip.category} · ${clip.tags.join(', ')}`,
      url: `${siteUrl}/${lang}/clip/${id}`,
      siteName: 'Reflix',
      type: 'video.other',
      images: [{ url: thumbnailUrl, width: clip.width, height: clip.height }],
    },
    twitter: {
      card: 'summary_large_image',
      title: clip.i18n.title[lang],
      description: `${clip.category} · ${clip.tags.join(', ')}`,
      images: [thumbnailUrl],
    },
  };
}
```

**`og:image` URL 정책:** 썸네일은 앱 도메인(`reflix.dev/thumbnails/...`)에서 서빙한다. `media.reflix.dev`는 쿠키 검증이 필요하므로 크롤러가 접근할 수 없다. 선행 스펙에서 `thumbnails/*`는 공개 자산으로 유지하기로 했으므로 앱 도메인에서 직접 서빙해도 무방하다.

## Files

### 수정

- `workers/media-gateway/src/index.ts` — CORS 헤더, OPTIONS 핸들링, Referer/Origin 검증 로직 추가
- `workers/media-gateway/wrangler.toml` — `ALLOWED_ORIGINS` 환경 변수 추가
- `src/lib/mediaSession.ts` — 쿠키 `SameSite` 를 `Lax` → `None` 으로 변경
- `src/components/clip/VideoPlayer.tsx` — Blob URL 재생 방식 전환
- `src/components/clip/QuickViewModal.tsx` — ShareButton 사용, Blob URL 적용
- `src/components/layout/RightPanelInspector.tsx` — ShareButton 연결
- `src/app/[lang]/clip/[id]/page.tsx` — ShareButton 추가, OG 메타태그 보강

### 추가

- `src/lib/blobVideo.ts` — Blob URL 생성/해제 유틸리티
- `src/components/clip/ShareButton.tsx` — 공유 버튼 컴포넌트
- `src/components/clip/ShareButton.test.tsx` — 공유 버튼 테스트

### 딕셔너리

- `src/app/[lang]/dictionaries/ko.json` — `clip.copied` 키 추가
- `src/app/[lang]/dictionaries/en.json` — `clip.copied` 키 추가

## Testing

### Unit Tests

- `ShareButton`
  - 클릭 시 `navigator.clipboard.writeText`가 올바른 URL로 호출되는지 검증
  - 복사 후 버튼 텍스트가 "복사됨"으로 변경되는지 검증
  - 2초 후 원래 상태로 복원되는지 검증
  - clipboard API 실패 시 폴백이 동작하는지 검증

- `blobVideo.ts`
  - 정상 응답 시 Blob URL이 반환되는지 검증
  - fetch 실패 시 에러가 throw 되는지 검증
  - `credentials: 'include'`가 설정되는지 검증

- `VideoPlayer` (Blob URL 관련)
  - Blob URL 로딩 중 poster가 표시되는지 검증
  - Blob URL 준비 후 video src가 `blob:` 프로토콜인지 검증
  - 언마운트 시 `revokeObjectURL`이 호출되는지 검증

### Worker Tests

- CORS: `OPTIONS` preflight 요청에 올바른 헤더가 반환되는지 검증
- CORS: `GET` 응답에 `Access-Control-Allow-Origin`과 `Access-Control-Allow-Credentials` 헤더가 포함되는지 검증
- Referer가 `https://reflix.dev/...`일 때 허용되는지 검증
- Origin/Referer 둘 다 없는 경우 쿠키만으로 통과하는지 검증
- Origin/Referer가 외부 도메인일 때 403 반환하는지 검증
- `ALLOWED_ORIGINS` 환경 변수에 추가된 도메인이 허용되는지 검증
- `evil-reflix.dev` 같은 서브도메인 위조가 차단되는지 검증

### Manual Verification

- 클립 상세 페이지에서 영상이 정상 재생되는지 확인
- 개발자 도구 네트워크 탭에서 `<video>` src가 `blob:` URL인지 확인
- 공유 버튼 클릭 → 클립보드에 올바른 URL이 복사되는지 확인
- 버튼 상태가 "공유" → "복사됨" → "공유"로 전환되는지 확인
- 복사된 URL을 새 탭에서 열었을 때 클립 페이지가 정상 로드되는지 확인
- 카카오톡/슬랙에 URL 붙여넣기 시 프리뷰 카드가 표시되는지 확인
- `curl` 직접 요청 시 403이 반환되는지 확인

## Future Extensions

- 컬렉션/검색결과/보드 공유 — `ShareButton`을 확장하여 다른 공유 대상 지원
- 임베드 뷰 — `/embed/{id}` 경량 페이지. `blobVideo.ts`와 보안 로직 재사용
- 공유 시트 — `ShareButton` 내부에 드롭다운 추가 (카카오톡, X, 이메일 등)
- 네이티브 공유 — `navigator.share()` API. 모바일 우선 적용
