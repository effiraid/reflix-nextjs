# Watermark Feature Design Spec

## Overview

비디오 플레이어 위에 CSS 오버레이로 `reflix.dev` 텍스트 워터마크를 표시한다. 무단 도용 방지와 브랜드 노출 두 가지 목적을 동시에 달성한다.

## Requirements

- **내용**: `reflix.dev` 텍스트
- **위치**: 우하단
- **스타일**: 반투명 검은 배경 필(60% opacity) + 흰 글씨(90% opacity), rounded corners
- **적용 대상**:
  - 브라우징 그리드 ClipCard — 비디오 프리뷰 재생 시에만 표시 (썸네일 상태에서는 숨김)
  - 클립 상세 페이지 VideoPlayer — 항상 표시 (풀스크린 포함)
- **구현 방식**: CSS absolute positioning 오버레이

## Component Design

### `Watermark` 컴포넌트

새 파일: `src/components/clip/Watermark.tsx`

`'use client'` 없이 작성하되, 소비자(ClipCard, VideoPlayer)가 모두 클라이언트 컴포넌트이므로 실제로는 클라이언트 번들에 포함된다. 순수 표현 컴포넌트로 서버 데이터 의존성 없음.

`size` prop으로 두 가지 크기를 지원한다.

```tsx
interface WatermarkProps {
  size?: 'sm' | 'md';
}
```

#### Size Variants

| Size | Context | Font Size | Padding | Position |
|------|---------|-----------|---------|----------|
| `sm` | ClipCard 프리뷰 | `text-[10px]` | `px-1.5 py-0.5` | `bottom-7 right-2` |
| `md` | VideoPlayer | `text-[11px]` | `px-2 py-0.5` | `bottom-2 right-3` |

`sm`의 `bottom-7`은 ClipCard 하단 info bar(`bg-gradient-to-t from-black/60`, 약 28px 높이)와의 겹침을 방지하기 위한 값이다.

#### CSS Properties

- `pointer-events-none` — 비디오 클릭/드래그 방해 안 함
- `select-none` — 텍스트 선택 방지
- `aria-hidden="true"` — 스크린 리더에서 숨김 (장식적 요소)
- `z-20` — 기존 VideoPlayer 오버레이(`z-10`) 위에 렌더링
- `bg-black/60` — 반투명 검은 배경
- `text-white/90` — 흰 글씨
- `rounded` — 4px border radius
- `tracking-wide` — 자간
- `font-medium` (sm) / `font-semibold` (md)

## Integration Points

### 1. ClipCard (`src/components/clip/ClipCard.tsx`)

`showPreview` 조건과 동일한 조건에서 Watermark를 렌더링한다. 기존 `{showPreview && <video ... />}` 블록 안에 Watermark를 함께 넣는다.

```tsx
{showPreview && (
  <>
    <video ... />
    <Watermark size="sm" />
  </>
)}
```

ClipCard의 루트 `<div>`가 `relative` + `overflow-hidden`이므로, Watermark의 `absolute` 포지셔닝이 카드 영역 내에서 정상 동작한다.

### 2. VideoPlayer (`src/components/clip/VideoPlayer.tsx`)

Watermark를 `<div className="relative bg-black">` (비디오 영역 컨테이너) **내부**에, 기존 `z-10` 오버레이와 같은 형제 요소로 삽입한다. 항상 표시.

**컨트롤 바**: 컨트롤 바는 비디오 영역 컨테이너 **외부** (아래쪽 형제 `<div>`)에 위치하므로, 워터마크와 겹치지 않는다. `bottom-2 right-3`이 그대로 적용된다.

## Edge Cases

- **풀스크린**: 풀스크린은 최상위 `containerRef`에 적용되며, Watermark는 그 안의 비디오 영역 컨테이너에 위치한다. 비디오 콘텐츠 영역 우하단에 표시되며 (풀스크린 뷰포트 우하단이 아님), 이것이 의도된 동작이다.
- **프리뷰 로딩 실패**: `showPreview`가 false가 되므로 워터마크도 자동으로 숨겨짐 (ClipCard)
- **다크/라이트 모드**: 검은 배경 필이라 양쪽 모두 가독성 확보됨
- **모바일**: 반응형 크기 조정 불필요 — `sm`/`md` 고정 크기가 모든 뷰포트에서 적절

## Out of Scope

- Canvas 렌더링 / FFmpeg 워터마크 (향후 보호 수준 강화 시 검토)
- 워터마크 on/off 토글 설정
- 로고 이미지 워터마크
- 우클릭 저장 방지 (별도 기능)

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/clip/Watermark.tsx` | **Create** — 재사용 워터마크 컴포넌트 |
| `src/components/clip/ClipCard.tsx` | **Edit** — 프리뷰 재생 시 Watermark 삽입 |
| `src/components/clip/VideoPlayer.tsx` | **Edit** — Watermark 삽입 |
