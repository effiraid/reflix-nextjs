# Guest-To-Free CTA Flow Design

## Goal

잠긴 결과를 클릭한 guest 사용자에게 바로 `Pro 업그레이드`를 강하게 미는 대신,
`로그인해서 Free 시작`을 1순위 CTA로 보여주고,
로그인 후에는 같은 browse 맥락으로 돌아와 방금 누른 결과를 이어서 보게 만든다.

## Product Decision

- `guest`: browse, 검색, 프리뷰는 가능하지만 결과는 일부만 열리고 원본 영상은 불가
- `free`: 로그인한 비구독자. 원본 영상 재생 가능, 보드 1개 사용 가능
- `pro`: 전체 결과, 다중 필터, 셔플, 무제한 보드

## Current Problem

- 잠긴 카드 클릭은 곧바로 가격 모달로 연결된다.
- guest도 같은 모달을 보지만, 현재 흐름은 guest의 첫 보상을 `Free 시작`보다 `Pro` 쪽에 더 가깝게 느끼게 만든다.
- 로그인 완료 후에는 현재 검색/필터/클릭 대상 맥락이 유지되지 않는다.

## Chosen Approach

추천 방향은 `guest 잠긴 카드 클릭 -> guest용 CTA 모달 -> 로그인 -> 같은 browse URL + resume 파라미터 복귀 -> free로 열리면 자동 선택/오픈` 흐름이다.

이 방식을 고른 이유:

- guest가 `Free`의 가치를 바로 체감한다.
- 검색/필터 문맥을 잃지 않는다.
- 별도 서버 상태 없이 내부 URL 파라미터만으로 복귀를 구현할 수 있다.

## Flow

1. guest가 잠긴 결과 카드를 클릭한다.
2. 가격 모달은 `guest 모드`로 열린다.
3. 모달의 1순위 CTA는 `로그인해서 Free 시작`이다.
4. CTA는 현재 browse URL과 클릭한 `clipId`를 `next` 파라미터에 실어 로그인 페이지로 보낸다.
5. 로그인 콜백은 해당 `next`로 복귀한다.
6. browse 클라이언트는 `resumeClip`과 `resumeOpen`을 읽는다.
7. 로그인 후 free 기준에서 그 클립이 열리는 상태면 자동으로 선택하고 quick view를 연다.
8. 여전히 free에서 잠겨 있는 결과라면, 해당 카드를 선택 상태로 맞추고 Pro 업그레이드 모달을 연다.

## URL Contract

`next`는 내부 경로만 허용하고 기존 `sanitizePostAuthRedirect()`를 그대로 사용한다.

복귀 URL 예시:

`/ko/browse?q=arcane&mode=direction&resumeClip=L3TR52T22TPVR&resumeOpen=1`

## UI Rules

- guest 모달 제목: 로그인하면 Free로 원본 영상과 저장 기능을 시작할 수 있다는 메시지
- guest 모달 primary CTA: `로그인해서 Free 시작`
- guest 모달 secondary CTA: `Pro 보기`
- free/pro 사용자가 잠긴 결과를 클릭한 경우에는 기존처럼 Pro 업그레이드 중심 CTA를 유지

## Edge Cases

- `resumeClip`이 없거나 잘못된 값이면 무시
- 복귀 후 projection/filters 로딩 전에는 자동 오픈을 시도하지 않음
- 복귀한 클립이 guest에서는 잠겼지만 free에서 열리면 바로 quick view 오픈
- free에서도 잠겨 있으면 자동으로 Pro CTA 모달 오픈
- 한 번 소비한 `resumeClip`/`resumeOpen`은 URL에서 제거해 반복 실행을 막음

## Files Likely Affected

- `src/components/clip/ClipCard.tsx`
- `src/components/pricing/PricingModal.tsx`
- `src/app/[lang]/login/LoginForm.tsx`
- `src/app/[lang]/browse/BrowseClient.tsx`
- `src/lib/authRedirect.ts`
- 필요 시 새 helper: `src/lib/guestResume.ts`

