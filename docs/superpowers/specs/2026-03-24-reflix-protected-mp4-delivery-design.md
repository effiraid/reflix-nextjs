# Reflix Protected MP4 Delivery Design

## Goal

브라우즈의 움직이는 미리보기와 상세 재생은 유지하면서, production에서 공개 `mp4` 직접 다운로드를 어렵게 만든다.

## Constraints

- 브라우즈 성능 저하는 허용하지 않는다.
- 브라우즈의 움직이는 미리보기는 반드시 유지한다.
- 보호 대상은 `mp4`만이다.
- `webp`/`png`/JSON은 계속 공개 자산으로 남겨도 된다.
- 목표는 `real access control`이 아니라 `casual deterrence`다.

## Current Risks

- `public/videos/{id}.mp4`와 `public/previews/{id}.mp4`가 앱 도메인에서 그대로 공개된다.
- 공개 JSON이 `/videos/...`와 `/previews/...` 상대 경로를 그대로 노출한다.
- `controlsList="nodownload"`와 우클릭 방지는 보안 경계가 아니다.
- per-asset signed URL 방식은 browse에서 카드 수만큼 signer 호출이 생겨 성능 조건과 충돌할 수 있다.

## Approved Architecture

- production에서는 `videos/*`와 `previews/*`를 private R2에만 둔다.
- `media.reflix.dev`는 Cloudflare Worker 앞단으로 둔다.
- Worker는 `videos/*`와 `previews/*` 요청에 대해서만 짧은 수명의 signed session cookie를 검증한 뒤 private R2에서 파일을 읽어 응답한다.
- Worker는 브라우저 비디오 재생이 깨지지 않도록 `Range` 요청과 `HEAD` 요청을 올바르게 처리한다.
- `thumbnails/*`는 계속 공개 자산으로 유지한다.
- 앱은 기존처럼 media URL을 직접 요청한다. 카드별 signer API 호출은 없다.
- session cookie는 앱 HTML 응답 시점에 Next 쪽에서 심는다.
- session cookie는 `HttpOnly`, `Secure`, `SameSite=None`, `Domain=.reflix.dev`로 설정한다. (`SameSite=None`은 cross-origin fetch에서 쿠키가 포함되기 위해 필요하다. `2026-03-26-clip-sharing-design.md` 참조.)
- Worker와 Next는 동일한 `MEDIA_SESSION_SECRET`으로 쿠키를 서명/검증한다.

## Performance Guarantee

- 브라우즈 카드가 `preview mp4`를 요청하는 방식은 유지한다.
- 카드별 presign API 호출은 도입하지 않는다.
- browse 진입 전에 session cookie가 이미 존재하도록 만들어 preview 시작 경로에 추가 네트워크 왕복을 넣지 않는다.
- preview 실패 시 해당 카드만 정적 thumbnail로 조용히 다운그레이드한다.

## Data Contract

- generated JSON의 상대 경로 계약은 유지한다.
- `videoUrl`은 계속 `/videos/{id}.mp4`를 가리킨다.
- `previewUrl`은 계속 `/previews/{id}.mp4`를 가리킨다.
- `thumbnailUrl`은 계속 `/thumbnails/{id}.webp`를 가리킨다.
- `src/lib/mediaUrl.ts`는 환경에 따라 상대 경로를 `https://media.reflix.dev`로 prefix 하는 역할만 맡는다.

## Runtime Behavior

### Local Dev / Vercel Preview

- 지금처럼 same-origin public assets를 사용한다.
- private media gateway, signed cookie, Worker 보호는 켜지지 않는다.
- `NEXT_PUBLIC_MEDIA_URL`이 비어 있으면 기존 동작을 유지한다.

### Production

- 앱은 `NEXT_PUBLIC_MEDIA_URL=https://media.reflix.dev`를 사용한다.
- browse와 inspector의 preview는 `media.reflix.dev/previews/{id}.mp4`를 직접 요청한다.
- quick view와 detail의 full video는 `media.reflix.dev/videos/{id}.mp4`를 직접 요청한다.
- 해당 요청은 Worker에서 session cookie 검증을 통과해야만 응답된다.

## Failure Policy

- 모든 보안 실패는 `fail-closed`다.
- cookie가 없거나 만료되거나 위조되면 Worker는 `403`을 반환한다.
- browse preview 실패 시 정적 thumbnail만 남긴다.
- right panel preview 실패 시 정적 thumbnail만 남긴다.
- quick view/detail full video 실패 시 poster는 유지하되 재생은 막는다.
- 어떤 경우에도 공개 `/videos/*.mp4` 또는 `/previews/*.mp4`로 fallback 하지 않는다.

## Files

- Modify: `src/proxy.ts`
- Modify: `src/lib/mediaUrl.ts`
- Modify: `src/components/clip/ClipCard.tsx`
- Modify: `src/components/layout/RightPanelInspector.tsx`
- Modify: `src/components/clip/VideoPlayer.tsx`
- Modify: `README.md`
- Modify: export/publish docs that currently describe public production mp4 delivery
- Add: `workers/media-gateway/src/index.ts`
- Add: `workers/media-gateway/wrangler.toml`
- Add: tests for proxy cookie behavior and media failure fallback paths

## Infrastructure Changes

- `reflix-media` R2 bucket must treat `videos/*` and `previews/*` as private Worker-only reads.
- `thumbnails/*` may remain publicly readable.
- `media.reflix.dev` must point to the Worker, not directly to an R2 public custom domain.
- production app deploy must not expose `public/videos/*` or `public/previews/*` at `reflix.dev`.

## Testing

- `src/proxy.ts`
  - production HTML 요청에서만 media cookie를 설정하는지 검증
  - `/api`, `/_next`, `/data`, 정적 파일 요청은 건드리지 않는지 검증
  - cookie 옵션이 기대값과 일치하는지 검증
- `src/components/clip/ClipCard.tsx`
  - preview가 정상일 때 기존처럼 `<video>` overlay가 유지되는지 검증
  - preview 실패 시 정적 thumbnail만 남는지 검증
- `src/components/layout/RightPanelInspector.tsx`
  - preview 실패 시 정적 thumbnail fallback이 동작하는지 검증
- `src/components/clip/VideoPlayer.tsx`
  - full video 실패 시 public mp4 fallback 없이 poster 상태로 남는지 검증
- Worker
  - cookie 없음, 만료, 위조, 잘못된 path, 잘못된 method를 차단하는지 검증
  - 유효한 cookie로 `videos/*`와 `previews/*`를 읽을 수 있는지 검증
  - `Range` 요청이 정상적으로 부분 응답으로 처리되는지 검증

## Manual Verification

- 일반 브라우저 세션에서 browse motion preview가 기존처럼 유지되는지 확인
- 일반 브라우저 세션에서 quick view/detail playback이 유지되는지 확인
- seek/replay 시 `Range` 기반 재생이 깨지지 않는지 확인
- cookie 없이 `curl https://media.reflix.dev/previews/<id>.mp4` 요청 시 차단되는지 확인
- cookie 없이 `curl https://media.reflix.dev/videos/<id>.mp4` 요청 시 차단되는지 확인
- DevTools에서 복사한 media URL을 새 시크릿 창에서 열었을 때 차단되는지 확인

## Rollout

1. Worker와 private R2 읽기 경로를 먼저 준비한다.
2. production에서 `media.reflix.dev`를 Worker로 전환한다.
3. Next production에 `NEXT_PUBLIC_MEDIA_URL`과 `MEDIA_SESSION_SECRET`를 설정한다.
4. 앱 배포물에서 `public/videos`와 `public/previews`가 production public origin에 노출되지 않도록 정리한다.
5. browse/detail playback과 직접 URL 차단을 함께 검증한다.

## Not In Scope

- DRM, HLS, DASH
- 로그인 기반 접근 제어
- 워터마킹
- 완전한 스크래퍼 차단
- `webp`/`png` 보호
