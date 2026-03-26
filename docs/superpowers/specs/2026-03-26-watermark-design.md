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

서버 컴포넌트로 구현. `size` prop으로 두 가지 크기를 지원한다.

```tsx
interface WatermarkProps {
  size?: 'sm' | 'md';
}
```

#### Size Variants

| Size | Context | Font Size | Padding | Position |
|------|---------|-----------|---------|----------|
| `sm` | ClipCard 프리뷰 | `text-[10px]` | `px-1.5 py-0.5` | `bottom-1.5 right-2` |
| `md` | VideoPlayer | `text-[11px]` | `px-2 py-0.5` | `bottom-2 right-3` |

#### CSS Properties

- `pointer-events-none` — 비디오 클릭/드래그 방해 안 함
- `select-none` — 텍스트 선택 방지
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

### 2. VideoPlayer (`src/components/clip/VideoPlayer.tsx`)

비디오 컨테이너 내부, 기존 오버레이 요소들과 같은 레벨에 삽입한다. 항상 표시.

**컨트롤 바 겹침 방지**: VideoPlayer 하단 컨트롤 바가 있으므로, 워터마크의 `bottom` 위치를 컨트롤 바 높이(약 40px) 위로 설정한다. 컨트롤 바가 표시될 때는 `bottom-12`, 숨겨져 있을 때는 `bottom-2`로 조정하거나, 고정 위치로 컨트롤 바 위에 배치한다.

## Edge Cases

- **풀스크린**: `absolute` 포지셔닝이 비디오 컨테이너 내부이므로 풀스크린에서도 자동 유지
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
