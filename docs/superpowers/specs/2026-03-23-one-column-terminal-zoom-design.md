# One-Column Terminal Zoom Design

## Goal

`SubToolbar`의 `+` 컨트롤을 끝까지 올렸을 때 기존 masonry 카드 레이아웃을 유지한 채 `1열 보기`까지 진입할 수 있게 만든다.

## Current Behavior

- `thumbnailSize`는 `0..3`으로 clamp 된다.
- masonry 컬럼 수는 `5 - thumbnailSize`로 계산되어 `5..2열`까지만 지원한다.
- `SubToolbar` range input도 `max=3`으로 고정되어 있다.

## Approved Behavior

- `thumbnailSize` 상한을 `4`로 확장한다.
- 컬럼 수 매핑을 `0→5열`, `1→4열`, `2→3열`, `3→2열`, `4→1열`로 바꾼다.
- `1열`은 별도 list/card 레이아웃을 만들지 않고, 기존 masonry 카드가 단일 컬럼으로 넓게 배치되는 형태로 처리한다.
- preview 정책은 기존 규칙을 유지해 `columnCount <= 3`이면 활성화한다. 따라서 `1열`에서도 preview는 켜진다.

## Files

- Modify: `src/components/layout/SubToolbar.tsx`
- Modify: `src/components/layout/SubToolbar.test.tsx`
- Modify: `src/components/clip/MasonryGrid.tsx`
- Modify: `src/stores/uiStore.ts`
- Create: `src/lib/thumbnailSize.ts`
- Create: `src/lib/thumbnailSize.test.ts`

## Testing

- thumbnail size clamp가 `4`까지 허용되는지 검증한다.
- thumbnail size to column count 매핑에 `4→1`이 추가됐는지 검증한다.
- `SubToolbar`의 range max와 `+` 버튼이 새 상한을 반영하는지 검증한다.
