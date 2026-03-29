# Reflix 미디어 전략

> 최종 업데이트: 2026-03-29

## 3단계 로딩 파이프라인

```
[뷰포트 밖]  DOM 없음 (가상화)
     ↓ 뷰포트 진입
[1단계]  LQIP blur (base64 인라인, ~300B)
     ↓ IntersectionObserver
[2단계]  정적 WebP 썸네일 (~4KB)
     ↓ 300ms 체류 + 2-3열일 때만
[3단계]  MP4 루프 프리뷰 (~70KB)
     ↓ 뷰포트 이탈
[2단계]  다시 정적 썸네일 (프리뷰 해제)
```

## 미디어 포맷 결정

| 용도 | 포맷 | 설정 | 평균 크기 | 이유 |
|------|------|------|----------|------|
| LQIP | JPEG base64 | 32px 첫 프레임, q50 | ~300B | 인라인으로 네트워크 요청 없음 |
| 정적 썸네일 | **Static WebP** | q80 | ~4KB | PNG 대비 95% 절감, 97%+ 브라우저 지원 |
| 프리뷰 루프 | **MP4 (H.264)** | 480w, 15fps, CRF 28 | ~70KB | Animated WebP 대비 69% 절감, 하드웨어 디코딩 |
| 원본 영상 | MP4 (H.264) | 원본 유지 | ~1.3MB | 재인코딩 안 함 (화질 보존) |

### 각 포맷 선택 근거

**정적 썸네일 — Static WebP (PNG 대신)**
- 실측: PNG 89KB → WebP 4KB (22배 절감)
- 7,000개 기준: 607MB → 28MB
- Eagle 썸네일은 animated WebP(.png 확장자)라서 어차피 변환 필요

**프리뷰 루프 — Short MP4 (Animated WebP 대신)**
- 실측: Animated WebP 338KB → MP4 104KB (3배 절감)
- H.264 코덱이 프레임 간 압축에서 WebP보다 훨씬 효율적
- `<video muted autoplay loop playsinline>`으로 이미지처럼 동작
- VP9(-51%)이나 AV1(-60%)이 더 작지만 인코딩 5-10배 느림 → 7,000개에 비현실적

**원본 영상 — 재인코딩 안 함**
- 이미 H.264 720p, 평균 1.3MB로 충분히 작음
- 재인코딩 시 세대 손실(generation loss) 발생
- H.265(~24%)만 H.264로 변환 (브라우저 호환)
- 1080p 이상만 720p로 다운스케일

### 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| Animated WebP 프리뷰 | MP4보다 3배 큼, 하드웨어 디코딩 미지원 |
| PNG 썸네일 | WebP보다 22배 큼 |
| VP9 프리뷰 | 인코딩 5배 느림, 7,000개 처리 비현실적 |
| AV1 프리뷰 | 인코딩 10배 느림, Apple 기기 하드웨어 지원 제한적 |
| AVIF 썸네일 | WebP보다 20-30% 작지만 브라우저 지원이 아직 부족 |
| 원본 재인코딩 | 31% 절감이지만 화질 손실, 7,000개 처리 시간 소요 |

## 열 수별 프리뷰 전략

| 슬라이더 | 열 수 | 카드 크기 | 동시 표시 | 프리뷰 |
|---------|-------|----------|---------|--------|
| 3 | 2열 | 큼 | ~6개 | MP4 루프 ✅ |
| 2 | 3열 | 중간 | ~9개 | MP4 루프 ✅ |
| 1 | 4열 | 작음 | ~12개 | 정적 WebP ❌ |
| 0 | 5열 | 매우 작음 | ~15개 | 정적 WebP ❌ |

**4열부터 MP4 끄는 이유:** 동시에 12개 이상의 `<video>` 태그가 재생되면
메모리와 디코딩 부하가 급증. 정적 썸네일은 4KB라 부담 없음.

## R2 버킷 구조

```
reflix-media/
├── videos/{id}.mp4          (원본, 평균 1.3MB)
├── thumbnails/{id}.webp     (정적 WebP, 평균 ~4KB)
└── previews/{id}.mp4        (MP4 루프, 평균 ~70KB)
# LQIP는 R2에 저장 안 함 — index.json에 base64로 인라인
```

## Production 전달 정책

- `preview mp4`는 browse 성능 때문에 계속 유지한다.
- production의 `videos/*`와 `previews/*`는 private R2 + `media.reflix.dev` Worker를 통해서만 서빙한다.
- 앱은 `src/proxy.ts`에서 짧은 수명의 media session cookie를 발급한다.
- `thumbnails/*`와 clip JSON은 계속 공개 자산으로 남긴다.
- 보호가 실패하면 browse/inspector는 정적 썸네일로, full player는 poster만 남기고 재생은 막는다.

## 상세 공유 링크 운영 원칙

- Reflix는 팀 안에서 레퍼런스 링크를 빠르게 공유하는 도구여야 한다.
- 따라서 `/ko/clip/{id}` 같은 상세 링크는 guest도 바로 열 수 있어야 하고, 원본 영상도 재생 가능해야 한다.
- 대신 browse/search는 discovery surface로 취급한다. guest가 검색이나 필터를 쓰면 결과는 보여주되 블러 처리하고, 로그인 전에는 열지 못하게 유지한다.
- 요약하면: `발견 흐름은 제한`, `공유된 상세 링크 소비 흐름은 개방`이 기본 원칙이다.

## 용량 프로젝션

| 규모 | 원본 MP4 | 썸네일 WebP | 프리뷰 MP4 | 합계 | R2 월비용 |
|------|---------|-----------|----------|------|---------|
| 7,000개 | 9.1GB | 28MB | 490MB | ~9.6GB | ~$0.15 |
| 10,000개 | 13GB | 40MB | 700MB | ~13.7GB | ~$0.21 |
| 100,000개 | 130GB | 400MB | 7GB | ~137GB | ~$2.1 |

## Export 파이프라인 명령어

```bash
# 전체 export (로컬)
node scripts/export.mjs --full --local

# 5개만 테스트
node scripts/export.mjs --limit 5 --local

# 특정 아이템
node scripts/export.mjs --ids ID1,ID2 --local

# 변경 확인만 (실제 파일 안 만듦)
node scripts/export.mjs --dry-run
```

## FFmpeg 설정 상세

```bash
# LQIP (32px 첫 프레임 → JPEG → base64)
ffmpeg -y -i input.mp4 \
  -vf "select=eq(n\,0),scale=32:-1" \
  -frames:v 1 -q:v 50 output_lqip.jpg

# 정적 썸네일 (Eagle animated WebP → static WebP)
webpmux -get frame 1 eagle_thumbnail.png -o frame1.webp
cwebp -q 80 frame1.webp -o output.webp

# MP4 프리뷰 루프 (480w, 15fps, CRF 28)
ffmpeg -y -i input.mp4 \
  -vf "scale=480:-1,fps=15" \
  -c:v libx264 -crf 28 -preset fast \
  -an -movflags +faststart \
  output_preview.mp4

# H.265 → H.264 변환 (원본 중 H.265인 것만)
ffmpeg -y -i input.mp4 \
  -c:v libx264 -crf 23 -preset medium \
  -c:a copy output.mp4
```
