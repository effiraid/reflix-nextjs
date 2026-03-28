# Guest-To-Free CTA Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** guest가 잠긴 결과를 눌렀을 때 `로그인해서 Free 시작` CTA를 먼저 보여주고, 로그인 후 같은 browse 문맥과 클릭 대상 결과로 복귀시켜 free 가치 체험을 바로 이어가게 만든다.

**Architecture:** browse URL 자체를 복귀 상태의 기준으로 쓰고, `next` 쿼리에 `resumeClip`과 `resumeOpen`을 싣는 방식으로 구현한다. 서버 세션 저장 없이 기존 auth callback, browse hydration, clip selection 로직을 재사용한다.

**Tech Stack:** Next.js App Router, Supabase Auth, Zustand, existing auth redirect helpers

---

## File Structure

- Modify: `/Users/macbook/reflix-nextjs/src/components/clip/ClipCard.tsx`
- Modify: `/Users/macbook/reflix-nextjs/src/components/pricing/PricingModal.tsx`
- Modify: `/Users/macbook/reflix-nextjs/src/app/[lang]/login/LoginForm.tsx`
- Modify: `/Users/macbook/reflix-nextjs/src/app/[lang]/browse/BrowseClient.tsx`
- Modify: `/Users/macbook/reflix-nextjs/src/lib/authRedirect.ts`
- Create: `/Users/macbook/reflix-nextjs/src/lib/guestResume.ts`
- Test: `/Users/macbook/reflix-nextjs/src/components/pricing/PricingModal.test.tsx`
- Test: `/Users/macbook/reflix-nextjs/src/app/[lang]/browse/BrowseClient.test.tsx`
- Test: `/Users/macbook/reflix-nextjs/src/lib/authRedirect.test.ts`

## Task 1: Define Resume Contract

- [ ] 정한다: guest locked CTA는 `next=/{lang}/browse?...&resumeClip={id}&resumeOpen=1`
- [ ] `resumeClip`과 `resumeOpen`을 다루는 작은 helper를 `/Users/macbook/reflix-nextjs/src/lib/guestResume.ts`에 만든다.
- [ ] helper 책임은 세 가지로 제한한다: URL 생성, URL 소비, 반복 실행 방지용 URL cleanup
- [ ] 테스트 기준을 먼저 적는다.
  - 정상 `clipId`면 resume URL 생성
  - 잘못된 값이면 무시
  - 소비 후 query cleanup 가능

## Task 2: Guest Click Intent From Locked Cards

- [ ] `/Users/macbook/reflix-nextjs/src/components/clip/ClipCard.tsx`에서 guest가 잠긴 카드를 눌렀을 때, 단순 `openPricingModal()`이 아니라 “어떤 clip을 눌렀는지”를 모달이 알 수 있게 intent를 넘기는 방향으로 바꾼다.
- [ ] 최소 변경 원칙:
  - 기존 free/pro의 잠긴 카드 동작은 유지
  - guest만 추가 분기
- [ ] 필요하면 UI store에 `pricingModalIntent` 같은 작은 상태를 추가한다.

## Task 3: Guest-First Pricing Modal

- [ ] `/Users/macbook/reflix-nextjs/src/components/pricing/PricingModal.tsx`를 guest/free/pro 모드별로 다르게 렌더링한다.
- [ ] guest 모드에서는:
  - primary CTA = `로그인해서 Free 시작`
  - secondary CTA = `Pro 보기`
  - free benefits를 먼저 읽히게 배치
- [ ] free/pro 모드에서는:
  - 기존 Pro 업그레이드 중심 흐름 유지
- [ ] 모달이 guest intent의 `clipId`와 현재 browse URL을 받아 login URL을 만들게 한다.

## Task 4: Preserve Browse Context Through Login

- [ ] `/Users/macbook/reflix-nextjs/src/app/[lang]/login/LoginForm.tsx`가 현재는 `buildAuthCallbackUrl(lang, origin)`만 쓰므로, `next`를 받을 수 있게 확장한다.
- [ ] 로그인 페이지는 query의 `next`를 읽어 `buildAuthCallbackUrl(lang, origin, next)`에 넘긴다.
- [ ] `/Users/macbook/reflix-nextjs/src/lib/authRedirect.ts`의 기존 내부 경로 sanitize 규칙을 그대로 유지하면서 `resumeClip`, `resumeOpen`이 붙은 browse URL도 안전하게 통과하는지 확인한다.

## Task 5: Resume On Browse After Login

- [ ] `/Users/macbook/reflix-nextjs/src/app/[lang]/browse/BrowseClient.tsx`에서 URL의 `resumeClip`, `resumeOpen`을 읽는다.
- [ ] projection/filter 결과가 준비된 뒤 한 번만 resume를 수행한다.
- [ ] 규칙:
  - free에서 해당 clip이 unlocked면 `setSelectedClipId(clipId)` + quick view open
  - free에서도 locked면 selected 상태만 맞춘 뒤 Pro 모달 오픈
  - 실행 후 URL에서 `resumeClip`, `resumeOpen` 제거

## Task 6: Tests

- [ ] `/Users/macbook/reflix-nextjs/src/lib/authRedirect.test.ts`
  - `next=/ko/browse?...&resumeClip=...&resumeOpen=1`이 sanitize 통과하는지 확인
- [ ] `/Users/macbook/reflix-nextjs/src/components/pricing/PricingModal.test.tsx`
  - guest 모드면 primary CTA가 `로그인해서 Free 시작`
  - free 모드면 기존처럼 Pro 업그레이드 중심
- [ ] `/Users/macbook/reflix-nextjs/src/app/[lang]/browse/BrowseClient.test.tsx`
  - login 복귀 후 unlocked clip이면 auto-open
  - free에서도 locked면 Pro 모달로 전환
  - resume query가 처리 후 cleanup되는지 확인

## Task 7: Manual Verification

- [ ] guest 상태에서 browse 검색 후 4번째 잠긴 결과 클릭
- [ ] guest용 모달에서 `로그인해서 Free 시작` CTA 확인
- [ ] 로그인 후 같은 검색 결과로 복귀하는지 확인
- [ ] free에서 4번째 결과가 열리며 quick view가 자동 오픈되는지 확인
- [ ] guest 상태에서 6번째 이상 결과 클릭 후 로그인
- [ ] free에서도 여전히 잠긴 결과면 Pro CTA가 열리는지 확인
- [ ] free/pro 기존 업그레이드 흐름이 깨지지 않았는지 확인

## Notes

- 이번 작업은 guest-first CTA 흐름만 다룬다.
- guest `3개`, free `5개`, pro `전체`라는 잠금 기준 자체는 이미 반영된 정책을 그대로 사용한다.
- `최근 본 것`, `저장` 확장 기능은 이번 작업 범위에 넣지 않는다.
