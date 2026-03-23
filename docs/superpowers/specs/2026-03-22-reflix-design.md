# Reflix — 게임 애니메이션 레퍼런스 플랫폼 설계

## 개요

animationreference.org를 기반으로 한 게임 애니메이션 레퍼런스 플랫폼. Eagle의 자산 관리 UX(호버 프리뷰, 스페이스바 탐색, 다차원 필터링, 별점 평가, 태그 시스템)를 웹에 구현하고, Pinterest 스타일의 Masonry 그리드로 콘텐츠를 표시한다.

## 핵심 결정사항

| 항목 | 결정 |
|---|---|
| 콘텐츠 소스 | 관리자 직접 업로드 |
| 인증 | 없음 (공개 열람), 추후 프리미엄 모델 전환 가능 |
| 카테고리 | Eagle 라이브러리 기반 (7,282개 아이템, 37개 태그 그룹) |
| 타겟 사용자 | 게임 애니메이터, 학생, 모든 애니메이터, 게임 개발팀 |
| 비디오 플레이어 | 점진적 (기본 → 고급) |
| 아키텍처 | Static JSON + Next.js SSG/ISR 하이브리드 (추후 Supabase + Vercel 전환) |
| 다국어 | 한국어 + 영어 (Next.js 16 내장 dictionary 패턴, 경로 prefix: `/ko/`, `/en/`) |
| 반응형 | PWA (Next.js 16 내장 PWA 지원, 데스크톱/태블릿/모바일) |
| 테마 | 라이트/다크 모드 전환 지원, 색상은 추후 지정 |

## 사이트 구조

### 페이지 맵

```
/[locale]/ ..................... 홈 (히어로 + 카테고리 + 인기 클립)
/[locale]/browse .............. 3패널 탐색 (핵심)
/[locale]/browse?category=combat  카테고리 필터 적용
/[locale]/browse?tag=화남&tag=검  다중 태그 필터 적용
/[locale]/clip/[id] ........... 클립 상세 (비디오 플레이어 + 메타데이터)
/[locale]/search .............. 검색 결과
/admin ........................ 관리자 (초기엔 미구현, Supabase 전환 시 구축)

예: /ko/browse, /en/browse, /ko/clip/L3TR52T22TPVR
루트 / 접속 시 브라우저 언어 감지 → /ko/ 또는 /en/ 리다이렉트
(proxy.ts — Next.js 16의 middleware 대체 파일 — 에서 처리)
```

### 사용자 흐름

- **탐색**: 홈 → 카테고리 클릭 → /browse (필터 적용) → 그리드에서 호버 프리뷰 → 클릭 or 스페이스바 → 상세
- **검색**: 검색바 입력 → 자동완성 (태그/카테고리) → 검색 결과 그리드 → 클립 상세
- **관리자**: 로그인 → /admin → 클립 업로드 (영상 + 메타데이터/태그 입력) → 게시

## 데이터 모델

### 클립 (Clip) — Eagle metadata.json 기반

Eagle 원본 필드를 그대로 보존하고, 웹 전용 필드만 추가한다.

```json
{
  "id": "L3TR52T22TPVR",
  "name": "연출 아케인 힘듦 일어나기 비몽사몽",
  "ext": "mp4",
  "size": 817348,
  "width": 640,
  "height": 360,
  "duration": 8.555,
  "tags": ["아케인", "일어나기", "힘듦", "아픔", "비틀비틀"],
  "folders": ["L475K68YP1NH3"],
  "star": 3,
  "annotation": "작품",
  "url": "",
  "palettes": [
    { "color": [14, 13, 12], "ratio": 66 },
    { "color": [74, 81, 66], "ratio": 9 }
  ],
  "btime": 1653975943463,
  "mtime": 1669363438000,

  "i18n": {
    "title": { "ko": "아케인 힘듦 일어나기", "en": "" },
    "description": { "ko": "", "en": "" }
  },
  "videoUrl": "/videos/L3TR52T22TPVR.mp4",
  "thumbnailUrl": "/thumbnails/L3TR52T22TPVR.png",
  "webpUrl": "/webp/L3TR52T22TPVR.webp",
  "lqipBase64": "data:image/jpeg;base64,/9j/4AAQSkZJ...",
  "category": "direction-video",
  "relatedClips": ["L951Y2DB121ZU", "LBLQQF3DATC0J", "L475K68YP1NH3", "LNQ11AV1W2571", "LE51BATCBL1T4"]
}
```

**필드 설명:**
- `i18n.title.en`: 초기엔 빈 문자열. 추후 수동 또는 번역 API로 채움
- `lqipBase64`: LQIP를 base64로 인라인 (~300 bytes). HTML에 직접 삽입하여 네트워크 요청 없이 blur placeholder 표시
- `category`: Eagle 폴더 ID → slug 매핑으로 생성 (하이픈 표기)
- `relatedClips`: export 시 태그 유사도로 미리 계산된 관련 클립 ID 5~10개

### 카테고리 (Eagle 폴더 → 웹 카테고리)

Eagle 폴더 ID로 직접 매핑한다.

```json
{
  "L951Y2DB8U9LQ": {
    "slug": "clips",
    "i18n": { "ko": "클립 분류", "en": "Clips" },
    "children": {
      "L475K68YP1NH3": { "slug": "direction-video", "i18n": { "ko": "연출(영상)", "en": "Direction (Video)" } },
      "LBLQQF3DATC0J": { "slug": "direction-game", "i18n": { "ko": "연출(게임)", "en": "Direction (Game)" } },
      "L951Y2DBP7GW0": {
        "slug": "dialogue",
        "i18n": { "ko": "대화 그룹", "en": "Dialogue" },
        "children": {
          "LNQ11AV1W2571": { "slug": "dialogue-main", "i18n": { "ko": "대화", "en": "Dialogue" } },
          "L951Y2DBAAWN4": { "slug": "idle-general", "i18n": { "ko": "대기(일반)", "en": "Idle (General)" } },
          "L951Y2DBDDEU8": { "slug": "idle-combat", "i18n": { "ko": "대기(전투)", "en": "Idle (Combat)" } },
          "L951Y2DC2F7R7": { "slug": "emote-ingame", "i18n": { "ko": "감정표현(인게임)", "en": "Emote (In-game)" } }
        }
      },
      "L951Y2DC15G7B": {
        "slug": "movement",
        "i18n": { "ko": "이동 그룹", "en": "Movement" },
        "children": {
          "L951Y2DCUS32V": { "slug": "walk", "i18n": { "ko": "걷기", "en": "Walking" } },
          "L951Y2DCQ8GH0": { "slug": "run", "i18n": { "ko": "달리기", "en": "Running" } },
          "MDDW9EWAOMUXA": { "slug": "sprint", "i18n": { "ko": "전력질주", "en": "Sprint" } },
          "LI1OBKZ059SGS": { "slug": "jump", "i18n": { "ko": "점프", "en": "Jump" } },
          "L951Y2DCS8TTU": { "slug": "movement-other", "i18n": { "ko": "이동(기타)", "en": "Other Movement" } }
        }
      },
      "L951Y2DCQ5YQ9": {
        "slug": "combat",
        "i18n": { "ko": "교전 그룹", "en": "Combat" },
        "children": {
          "L951Y2DB121ZU": { "slug": "combat-ready", "i18n": { "ko": "전투 준비", "en": "Combat Ready" } },
          "LNPMWX908R1NR": { "slug": "attack", "i18n": { "ko": "교전(공격)", "en": "Attack" } },
          "MDDWTXD49SKZS": { "slug": "indirect", "i18n": { "ko": "직접적 타격 X", "en": "Indirect" } },
          "LE51BATCBL1T4": { "slug": "ultimate", "i18n": { "ko": "필살기", "en": "Ultimate" } },
          "L9QT7EUXB1KW9": { "slug": "return", "i18n": { "ko": "리턴", "en": "Return" } },
          "L951Y2DC2XEG9": { "slug": "buff", "i18n": { "ko": "버프", "en": "Buff" } },
          "L951Y2DCT93FD": { "slug": "charge", "i18n": { "ko": "충전", "en": "Charge" } }
        }
      },
      "L951Y2DCBVCYS": {
        "slug": "hit-reaction",
        "i18n": { "ko": "피격 그룹", "en": "Hit Reaction" },
        "children": {
          "L951Y2DCOTAJ6": { "slug": "hit", "i18n": { "ko": "피격", "en": "Hit" } },
          "L951Y2DCJ1DAI": { "slug": "stun", "i18n": { "ko": "기절", "en": "Stun" } },
          "L951Y2DCT25Y7": { "slug": "death", "i18n": { "ko": "사망", "en": "Death" } }
        }
      }
    }
  },
  "L951YJXMQ4GRC": {
    "slug": "weapons",
    "i18n": { "ko": "무기 분류", "en": "Weapons" },
    "children": {
      "L951YJXMS03D0": {
        "slug": "melee",
        "i18n": { "ko": "둔기류", "en": "Melee" },
        "children": {
          "L951YJXMED230": { "slug": "sword", "i18n": { "ko": "검", "en": "Sword" } },
          "L951YJXM6LFV6": { "slug": "dagger", "i18n": { "ko": "단검", "en": "Dagger" } },
          "L951YJXMDC0IG": { "slug": "blunt", "i18n": { "ko": "둔기", "en": "Blunt" } },
          "L951YJXM2W7LT": { "slug": "spear", "i18n": { "ko": "창, 봉", "en": "Spear & Staff" } },
          "L951YJXM3MHGT": { "slug": "shield", "i18n": { "ko": "방패", "en": "Shield" } }
        }
      },
      "L951YJXMYASC0": {
        "slug": "ranged",
        "i18n": { "ko": "원거리류", "en": "Ranged" },
        "children": {
          "L951YJXMX9H86": { "slug": "magic", "i18n": { "ko": "마법", "en": "Magic" } },
          "L951YJXM1E4ZI": { "slug": "bow", "i18n": { "ko": "활", "en": "Bow" } },
          "L951YJXM907RF": { "slug": "gun", "i18n": { "ko": "총", "en": "Gun" } }
        }
      },
      "L951YJXMDIKP9": {
        "slug": "other-weapons",
        "i18n": { "ko": "기타 무기류", "en": "Other Weapons" },
        "children": {
          "L951YJXMQKZGR": { "slug": "body", "i18n": { "ko": "신체(격투가)", "en": "Body (Martial)" } }
        }
      }
    }
  },
  "LI1NQS5NKKQ57": {
    "slug": "poses",
    "i18n": { "ko": "포즈", "en": "Poses" },
    "children": {
      "L9OZ80G066SKO": { "slug": "preset", "i18n": { "ko": "프리셋 포즈", "en": "Preset Poses" } },
      "LBU7Y2H4GH2QO": { "slug": "idle", "i18n": { "ko": "대기(일반)", "en": "Idle" } }
    }
  }
}
```

### 태그 그룹 (필터 축)

Eagle의 37개 태그 그룹을 필터 카테고리로 매핑한다. 주요 필터 축:

- **감정** (6 하위 그룹, ~160태그): 기쁨, 슬픔, 화남, 불안, 아픔, 사랑
- **게임 클래스** (6): 전사, 격투가, 암살자, 마법사, 궁수, 서포터
- **무기** (44): 검, 단검, 대검, 창, 방패, 마법, 활, 총 등
- **행동** (350+): 걷기, 달리기, 잡기, 포옹 등
- **작품** (100+): 검은사막, 원신, 아케인, 오버워치 등
- **인물** (75+): 건달, 공주, 몬스터, 전사 등
- **상황** (130+): 갇힘, 감금, 전쟁, 발견 등
- **성격** (46): 건방짐, 당당함, 섹시함 등
- **스포츠** (16), **악기** (11), **신체** (35), **물건** (100+), **장소/환경** (24)

**태그 i18n:** 태그는 한국어 원본 그대로 사용. 영어 UI에서도 한국어 태그를 표시하되, 주요 태그(카테고리명, 감정 등)는 `data/tag-i18n.json`에 한→영 매핑 제공. 매핑이 없는 태그는 한국어 그대로 표시.

**`data/tag-groups.json` 스키마:**

```json
{
  "groups": [
    {
      "id": "emotion-joy",
      "name": { "ko": "기쁨", "en": "Joy" },
      "parent": "emotion",
      "color": "#22c55e",
      "tags": ["기쁨", "웃음", "환호", "행복", "감격"]
    }
  ],
  "parentGroups": [
    {
      "id": "emotion",
      "name": { "ko": "감정", "en": "Emotion" },
      "children": ["emotion-joy", "emotion-sad", "emotion-angry", "emotion-fear", "emotion-pain", "emotion-love"]
    }
  ]
}
```

### 데이터 파이프라인

```
Eagle Library (7,282 items)
    │
    ▼  export 스크립트 (Node.js)
    │  - metadata.json 읽기
    │  - folders → category 매핑
    │  - tags → tagGroups 분류
    │  - i18n 필드 생성
    │  - 영상 → WebP 애니메이션 썸네일 생성
    │  - LQIP base64 생성
    │  - 관련 클립 유사도 계산
    │
    ▼
data/clips/*.json       (개별 클립 JSON — 상세 페이지용)
data/categories.json    (카테고리 트리)
data/tag-groups.json    (태그 그룹 + i18n)
data/tag-i18n.json      (태그 한→영 매핑)
data/index.json         (경량 인덱스 — 탐색 그리드 + 필터링용)
    │
    ▼  Next.js SSG/ISR (하이브리드)
    │
    ▼
정적 HTML 페이지 (Vercel 배포)
```

**`data/index.json` 스키마** — 탐색 그리드용 경량 인덱스. 전체 클립의 필터링 가능 필드만 포함:

```json
{
  "clips": [
    {
      "id": "L3TR52T22TPVR",
      "name": "연출 아케인 힘듦 일어나기 비몽사몽",
      "tags": ["아케인", "일어나기", "힘듦"],
      "folders": ["L475K68YP1NH3"],
      "star": 3,
      "category": "direction-video",
      "width": 640,
      "height": 360,
      "duration": 8.555,
      "webpUrl": "/webp/L3TR52T22TPVR.webp",
      "thumbnailUrl": "/thumbnails/L3TR52T22TPVR.png",
      "lqipBase64": "data:image/jpeg;base64,/9j/..."
    }
  ],
  "totalCount": 7282,
  "generatedAt": "2026-03-22T12:00:00Z"
}
```

**필터링 전략:** `index.json`을 클라이언트에서 한 번 로드 후 메모리에서 필터링.
- 7,282개 × ~300 bytes/항목 ≈ 2.2MB (gzip 후 ~500KB). 초기 로드 1회로 즉시 필터링 가능.
- 10만개까지 확장 시 ~30MB → 이 시점에서 Supabase API 전환 (index.json 방식 한계).
- 폴더/태그/별점 필터는 배열 교집합 연산. 정렬은 Array.sort().
- Pagefind 검색은 별도로 동작하며, 필터와 결합 시 Pagefind 결과 ID 목록을 index.json 필터와 교집합.

### 렌더링 전략 (SSG/ISR 하이브리드)

| 페이지 | 렌더링 | 이유 |
|---|---|---|
| `/[locale]/` (홈) | SSG | 정적 콘텐츠, 빌드 시 생성 |
| `/[locale]/browse` | SSG | index.json 클라이언트 필터링, 서버 로직 없음 |
| `/[locale]/clip/[id]` | ISR | 7,000~100,000개 → 빌드 시 전부 생성 불가. 첫 접속 시 생성 후 캐싱 |
| `/[locale]/search` | SSG | Pagefind 클라이언트 검색, 서버 로직 없음 |

## UI 설계

### 레이아웃: Eagle 3패널 + Pinterest Masonry 그리드

```
┌──────────────────────────────────────────────────────┐
│  REFLIX   ◀ ▶  교전 그룹       🔀 ≡ ▦ ▤  🔍 검색  🌐 │
├────────────┬─────────────────────────┬───────────────┤
│ 좌측 패널   │  중앙 Masonry 그리드     │  우측 정보 패널 │
│            │                         │               │
│ All  7,282 │  1,247개  [화남✕][교전✕] │  [프리뷰 영상]  │
│ ★4+  1,024 │                         │  ▶ ──●── 0:12 │
│            │  ┌───┐ ┌─────┐ ┌───┐   │               │
│ ▼ 클립 분류 │  │   │ │     │ │   │   │  제목 + ⭐     │
│   연출(영상) │  │   │ │     │ │   │   │  메모          │
│   연출(게임) │  └───┘ │     │ └───┘   │  소스 URL      │
│   ▶ 대화   │  ┌─────┐└─────┘┌─────┐  │  태그          │
│   ▶ 이동   │  │     │┌───┐  │     │  │  폴더          │
│   ▼ 교전   │  │     ││   │  │     │  │  색상 팔레트    │
│    전투준비  │  │     ││   │  │     │  │  속성          │
│    공격     │  └─────┘└───┘  └─────┘  │   크기/해상도   │
│    필살기   │                         │   포맷/추가일   │
│   ▶ 피격   │  ↓ 무한 스크롤 (가상화) ↓ │               │
│ ▶ 무기 분류 │                         │               │
│ ▶ 포즈     │                         │               │
│            │                         │               │
│ 태그 필터   │                         │               │
│ 감정: ●●●  │                         │               │
│ 클래스: ●● │                         │               │
│ 무기: ●●●  │                         │               │
│ 작품: ●●●  │                         │               │
│ 🔍 태그필터 │                         │               │
└────────────┴─────────────────────────┴───────────────┘
```

### 좌측 패널

- **빠른 필터**: All, Uncategorized, Untagged, 별점 4+ (카운트 표시)
- **폴더 트리**: Eagle 폴더 구조 그대로. 접기/펴기, 아이템 카운트 표시
- **태그 필터**: 태그 그룹별 칩 (감정은 색상 코딩). 태그 검색바

### 중앙 그리드

- **Pinterest Masonry 레이아웃**: 카드 높이가 영상 종횡비에 따라 가변
- **움직이는 WebP 썸네일**: 3단계 로딩 (blur → 정적 → 애니메이션)
- **활성 필터 바**: 적용된 필터 칩 표시 + 제거 버튼
- **무한 스크롤**: @tanstack/react-virtual 가상화 적용
- **정렬**: 최신순, 별점순, 이름순

### 우측 정보 패널

선택된 클립의 상세 정보를 Eagle 스타일로 표시:
- 영상 프리뷰 + 미니 플레이어 컨트롤
- 제목, 별점 (⭐), 해상도, 재생시간
- 메모 (annotation)
- 소스 URL
- 태그 목록 (칩)
- 소속 폴더
- 색상 팔레트 (Eagle palettes에서 추출된 색상 원형)
- 속성 (파일 크기, 해상도, 포맷, 추가일)

### 인터랙션

#### 호버 프리뷰 (ClipCard 내에서 처리)
- 썸네일에 마우스 올리면 **애니메이션 WebP가 자동 재생** (이미 로드된 경우)
- 마우스 X 위치에 따라 WebP 프레임 스크러빙 (CSS object-position 활용은 불가 → 대안: 호버 시 숨겨진 `<video>` 태그로 전환하여 currentTime 조절)
- 하단에 재생 시간 표시
- 호버 0.3초 후 재생 시작 (불필요한 재생 방지)
- **참고**: 기본 상태에서는 애니메이션 WebP 루프 재생, 호버 시 실제 MP4 `<video>` 로 전환하여 스크러빙 제공

#### 스페이스바 탐색 (QuickViewModal)
- 그리드에서 클립 선택 후 Space → 퀵 프리뷰 모달 (오버레이)
- ← → 키로 이전/다음 클립 이동
- ESC로 닫기
- 모달에는 영상 프리뷰 + 메타데이터 + 태그 표시
- **우측 패널과의 관계**: 클릭으로 클립 선택 시 우측 패널에 정보 표시, 스페이스바는 모달 오버레이. 둘은 독립적 — 모달 닫으면 우측 패널의 선택 상태 유지

### 반응형

- **데스크톱 (≥1280px)**: 3패널, 4열 Masonry 그리드
- **태블릿 (768~1279px)**: 2열 그리드, 좌우 패널은 슬라이드 오버
- **모바일 (<768px)**: 1~2열 그리드, 패널은 바텀시트 or 슬라이드

### 홈페이지 (/)

- 히어로 섹션: 타이틀 + CTA ("탐색 시작하기")
- 카테고리 카드: 클립 분류, 무기 분류, 포즈 (3열 그리드)
- 인기 클립: 별점 높은 클립 Masonry 그리드

### 클립 상세 (/[locale]/clip/[id]) — ISR

**진입 경로 2가지:**
- 그리드 클릭 → 모달로 빠른 프리뷰 → "상세 보기" 링크로 이동
- 외부 공유 링크 / Google 검색 → 직접 진입

**페이지 구성:**
- 커스텀 비디오 플레이어 (재생/정지, 속도 조절, 프레임 단위 탐색)
- 메타데이터 패널 (태그, 폴더, 별점, 메모)
- 관련 클립 그리드 (태그 유사도 기반, export 시 미리 계산)
- SEO 메타태그 + OG 이미지 (공유 링크 프리뷰)

**렌더링:** ISR — 첫 접속 시 생성 후 캐싱. 빌드 시간 제로. 10만개 대응 가능.

**관련 클립 추천 로직:**
- 빌드/export 시 태그 겹침 수 + 같은 폴더 가산 + 같은 작품 가산으로 유사도 계산
- 클립당 관련 클립 ID 5~10개를 JSON에 미리 저장
- 런타임 계산 없이 JSON에서 바로 로딩

## WebP 성능 전략

7,000+ 움직이는 WebP 썸네일을 무한 스크롤로 표시하기 위한 3단계 로딩:

```
[스크롤 밖] DOM 없음 (@tanstack/react-virtual 가상화)
      ↓ 뷰포트 진입
[1단계] blur placeholder (LQIP, 2KB 미만)
      ↓ IntersectionObserver 감지
[2단계] 정적 WebP 1프레임 로드
      ↓ 0.3초 체류 확인
[3단계] 애니메이션 WebP 로드 & 자동 재생
      ↓ 뷰포트 이탈
[언로드] WebP 해제, 메모리 회수
```

결과: 7,000개여도 실제 DOM 30~50개, 동시 WebP 재생 12~16개.

## 기술 스택

### 이미 설치됨
- Next.js 16
- React 19
- Tailwind CSS 4
- TypeScript 5

### 추가 필요
- **@tanstack/react-virtual** — 가상 스크롤 (Masonry 그리드 기반으로 커스텀 구현 필요 — 라이브러리 자체는 1차원 가상화만 지원하므로, 열 기반 masonry를 직접 계산하고 virtual row로 매핑)
- **next-themes** — 라이트/다크 모드 전환
- **zustand** — 상태 관리 (필터, 선택, UI)
- **pagefind** — 정적 검색 엔진 (빌드 시 인덱스 생성, 클라이언트에서 청크 로딩. 10만개+ 대응)
- **@aws-sdk/client-s3** — R2 업로드 (export 스크립트용, dev dependency)

**사용하지 않는 이유:**
- ~~next-intl~~ → Next.js 16 내장 dictionary 패턴으로 충분 (2개 언어)
- ~~next-pwa~~ → Next.js 16 내장 PWA 지원 (`app/manifest.ts` + service worker)

## 컴포넌트 구조

```
proxy.ts                    ← 로케일 감지 + /ko/ or /en/ 리다이렉트 (Next.js 16)

app/
├── layout.tsx              ← RootLayout (라이트/다크 테마, PWA manifest)
├── [locale]/
│   ├── layout.tsx          ← LocaleLayout (i18n dictionary 로드)
│   ├── page.tsx            ← 홈 (SSG)
│   ├── browse/page.tsx     ← 3패널 탐색 (SSG, 클라이언트 필터링)
│   ├── clip/[id]/page.tsx  ← 클립 상세 (ISR)
│   └── search/page.tsx     ← 검색 결과 (SSG, Pagefind 클라이언트)
├── dictionaries/
│   ├── ko.json             ← 한국어 UI 문자열
│   └── en.json             ← 영어 UI 문자열
└── admin/page.tsx          ← 관리자 (미구현)

components/
├── layout/
│   ├── Navbar.tsx
│   ├── LeftPanel.tsx
│   └── RightPanel.tsx
├── clip/
│   ├── ClipCard.tsx         ← WebP 3단계 로딩
│   ├── MasonryGrid.tsx      ← 가상화 Masonry
│   ├── VideoPlayer.tsx      ← 커스텀 플레이어
│   └── QuickViewModal.tsx   ← 스페이스바 퀵뷰
├── filter/
│   ├── FolderTree.tsx
│   ├── TagFilter.tsx
│   └── ActiveFilters.tsx
└── common/
    ├── StarRating.tsx
    ├── TagChip.tsx
    └── SearchBar.tsx
```

## 상태 관리 (Zustand)

```typescript
// filterStore — URL 쿼리 파라미터와 양방향 동기화
{
  selectedFolders: string[]
  selectedTags: string[]
  starFilter: number | null
  searchQuery: string
  sortBy: 'newest' | 'rating' | 'name'
}

// clipStore
{
  selectedClipId: string | null
  clips: Clip[]
  isLoading: boolean
}

// uiStore
{
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  viewMode: 'masonry' | 'grid' | 'list'
  locale: 'ko' | 'en'
  theme: 'light' | 'dark' | 'system'   // next-themes로 관리
}
```

**URL ↔ Zustand 동기화:**
- `/browse?category=combat&tag=화남&star=4&sort=rating` 형태로 필터 상태를 URL에 반영
- 페이지 진입 시: URL 쿼리 파라미터 → Zustand 초기화
- 필터 변경 시: Zustand → `router.replace()` 로 URL 업데이트 (히스토리 푸시 아님)
- 브라우저 뒤로가기/앞으로가기: `popstate` 이벤트 → Zustand 업데이트
- 직접 URL 입력 / 공유 링크: URL 파라미터로 필터 복원

## 영상 호스팅

### Cloudflare R2 + CDN

영상 파일 특성: 평균 1.68MB, 중앙값 1.32MB, 평균 4.9초, 주로 720p H.264.
작은 파일 × 대량(1만~10만+) 패턴에 최적화된 호스팅 선택.

**선택 이유:**
- 전송(egress) 비용 무료 — 트래픽 증가에도 비용 폭탄 없음
- 10만개(230GB) 저장 시 월 ~$3.5
- S3 호환 API — 업로드 자동화 + 추후 Supabase 전환 시 유지 가능
- Cloudflare CDN 무료 (글로벌 300+ PoP)
- 파일이 작아 별도 트랜스코딩/HLS 불필요

**R2 버킷 구조:**
```
reflix-media/
├── videos/{id}.mp4          (원본 영상, 평균 1.68MB)
├── thumbnails/{id}.png      (정적 썸네일, 평균 333KB)
└── webp/{id}.webp           (애니메이션 WebP, 추정 200~500KB)
# LQIP는 R2에 저장하지 않음 — base64로 index.json에 인라인 (~300 bytes/개)
```

**접근 URL:** `https://media.reflix.app/videos/{id}.mp4` (커스텀 도메인)

**CORS 설정:** R2 버킷에 CORS 정책 필요 (Vercel에서 cross-origin 영상/이미지 로딩):
```json
[{ "AllowedOrigins": ["https://reflix.app", "http://localhost:3000"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400 }]
```

**비용 프로젝션:**
| 규모 | 저장 용량 | 월 비용 |
|---|---|---|
| 1만개 | 23GB | ~$0.5 |
| 10만개 | 230GB | ~$3.5 |
| 100만개 | 2.3TB | ~$35 |

## WebP 썸네일 생성

### 인코딩 프리셋: Med (480w, 15fps, q65)

실제 라이브러리 MP4 5개 샘플 테스트 결과 선정. 원본 대비 평균 37% 크기, 평균 ~400KB.

**FFmpeg 명령어:**
```bash
# 애니메이션 WebP (영상 전체 변환)
ffmpeg -y -i input.mp4 \
  -vcodec libwebp -lossless 0 -q:v 65 \
  -loop 0 -vf "scale=480:-1,fps=15" \
  -an output.webp

# LQIP blur placeholder (첫 프레임, ~300 bytes)
ffmpeg -y -i input.mp4 \
  -vf "select=eq(n\,0),scale=32:-1" \
  -frames:v 1 -q:v 50 \
  output_lqip.jpg
```

**프리셋 상세:**
| 파라미터 | 값 | 이유 |
|---|---|---|
| 해상도 | 480px (너비 기준, 높이 자동) | 그리드 카드 표시에 충분 |
| 프레임레이트 | 15fps | 모션 판별 가능, 프레임 수 억제 |
| 품질 | q:v 65 | 디테일 유지 + 용량 억제 균형점 |
| 루프 | -loop 0 (무한 반복) | 썸네일 자동 재생용 |
| 오디오 | -an (제거) | 썸네일에 오디오 불필요 |

**스토리지 프로젝션 (R2 기준):**
| 규모 | MP4 | WebP | PNG 썸네일 | LQIP | 합계 | R2 월비용 |
|---|---|---|---|---|---|---|
| 1만개 | 17 GB | 4 GB | 3.3 GB | 3 MB | ~24 GB | ~$0.4 |
| 10만개 | 168 GB | 40 GB | 33 GB | 30 MB | ~241 GB | ~$3.6 |

**3단계 로딩 흐름:**
1. LQIP (~300 bytes, base64 인라인) → blur placeholder
2. 정적 PNG 썸네일 (평균 333KB) → 선명한 1프레임
3. 애니메이션 WebP (평균 ~400KB) → 움직이는 프리뷰

**H.265 → H.264 자동 변환:**
원본 MP4의 24%가 H.265(HEVC)인데, Chrome/Firefox에서 재생 불가. export 스크립트에서 H.265 감지 시 H.264로 자동 변환:
```bash
# H.265 감지
codec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 input.mp4)
# H.265이면 H.264로 변환
if [ "$codec" = "hevc" ]; then
  ffmpeg -y -i input.mp4 -c:v libx264 -crf 23 -preset medium -c:a copy output.mp4
fi
```

**참고:** FFmpeg에 libwebp 필요. macOS: `brew install ffmpeg-full` (keg-only, `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`)

## Eagle → R2 업로드 파이프라인

Eagle 라이브러리에서 Cloudflare R2로 에셋을 업로드하는 Node.js export 스크립트.

### 처리 흐름

```
Eagle Library (/images/{id}.info/)
    │
    ├─ metadata.json 읽기
    ├─ {id}.mp4 원본 영상
    └─ {id}_thumbnail.png 정적 썸네일
    │
    ▼  export 스크립트 (Node.js CLI)
    │
    ├─ 1. metadata.json 파싱 → Clip JSON 생성
    │     - folders → category 매핑
    │     - tags → tagGroups 분류
    │     - i18n 필드 생성 (초기: 한국어만, 영어는 빈 값)
    │     - 관련 클립 유사도 계산 → relatedClips[] 저장
    │
    ├─ 2. 영상 처리
    │     - H.265 감지 → H.264 자동 변환
    │     - 애니메이션 WebP 생성 (Med 프리셋: 480w, 15fps, q65)
    │     - LQIP 생성 (32px 첫 프레임 JPEG)
    │
    ├─ 3. R2 업로드 (S3 호환 API, @aws-sdk/client-s3)
    │     - videos/{id}.mp4
    │     - thumbnails/{id}.png
    │     - webp/{id}.webp
    │     - lqip/{id}.jpg
    │
    └─ 4. 인덱스 생성
          - data/clips/{id}.json (개별 클립)
          - data/index.json (전체 인덱스)
          - data/categories.json (카테고리 트리)
          - data/tag-groups.json (태그 그룹)
```

### 증분 업데이트

전체 재처리 대신, 변경된 아이템만 처리:

```
export 스크립트 실행 시:
1. .export-state.json 로드 (이전 처리 상태 — 아이템별 status/hash)
2. Eagle 라이브러리 전체 스캔 → metadata.json의 mtime 비교
3. 새로 추가됨 / mtime 변경됨 / 삭제됨 분류
4. 변경분만 처리 (영상 변환 + R2 업로드)
5. .export-state.json 업데이트 (아이템별로 처리 완료 기록)
6. 인덱스 JSON 재생성 (전체)
```

**에러 처리:** 개별 아이템 처리 실패 시 해당 아이템을 `.export-state.json`에 `"status": "failed"` 로 기록하고 다음 아이템으로 진행. 다음 실행 시 실패한 아이템 자동 재시도. 스크립트 종료 시 실패 개수와 ID 출력.

**병렬 처리:** FFmpeg 변환 최대 4개 동시 (`os.cpus().length`), R2 업로드 최대 10개 동시. 7,282개 초기 export 예상 시간: ~2-3시간 (H.265 변환 포함).

**설정:** Eagle 라이브러리 경로와 R2 자격증명은 `.env.local` 또는 환경 변수로 설정.

```bash
EAGLE_LIBRARY_PATH="/Users/.../레퍼런스 - 게임,연출.library"
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="reflix-media"
R2_PUBLIC_URL="https://media.reflix.app"
```

### CLI 인터페이스

```bash
# 전체 export (최초 1회)
node scripts/export.mjs --full

# 증분 export (변경분만)
node scripts/export.mjs

# dry-run (실제 업로드 없이 변경사항 확인)
node scripts/export.mjs --dry-run

# 특정 아이템만 재처리
node scripts/export.mjs --ids L3TR52T22TPVR,L951Y2DB121ZU
```

**비영상 아이템 처리:** Eagle 라이브러리에 비영상 파일(이미지 등)이 포함될 수 있음. `ext !== "mp4"` 아이템은 WebP 애니메이션 생성을 건너뛰고 정적 썸네일만 사용.

## 데이터 업데이트 자동화

Eagle에 새 클립을 추가하면 웹사이트에 반영되는 흐름.

### Phase 1: 수동 트리거 (초기)

```
관리자가 Eagle에 클립 추가/수정
    ↓
터미널에서 export 스크립트 실행
    ↓
R2에 에셋 업로드 + JSON 인덱스 갱신
    ↓
Vercel에 재배포 (vercel --prod 또는 git push)
    ↓
ISR이 클립 상세 페이지 재생성
```

### Phase 2: 반자동 (편의성 개선)

```
npm run export      ← 증분 export + R2 업로드
npm run deploy      ← export + Vercel 재배포 (한 번에)
```

package.json scripts로 한 줄 명령어화.

### Phase 3: 자동 (Supabase 전환 후)

Supabase 전환 시 Eagle → DB 동기화 자동화:
- Eagle 폴더 감시 (fs.watch 또는 chokidar) → 변경 감지 시 자동 export
- 또는 cron job으로 주기적 동기화 (예: 매일 새벽 3시)
- Supabase Edge Function으로 R2 업로드 + DB 갱신

## 알려진 기술 리스크

| 리스크 | 대응 |
|---|---|
| @tanstack/react-virtual이 masonry를 네이티브 지원하지 않음 | 열 기반으로 아이템을 분배하고 각 열을 virtualizer로 감싸는 커스텀 구현. 초기 프로토타입에서 검증 필요 |
| 애니메이션 WebP 12-16개 동시 재생 시 메모리 압박 | `<img>` src 제거만으로 디코딩 메모리 즉시 해제 안 될 수 있음. `URL.revokeObjectURL()` 또는 빈 1px 이미지로 교체하여 강제 해제. 성능 테스트 필요 |
| Pagefind i18n — 두 로케일 인덱스 분리 | Pagefind 빌드 시 로케일별 별도 인덱스 생성. 검색 시 현재 로케일 인덱스만 로드 |
| H.265 → H.264 변환 초기 시간 (~1,748개, 2-3시간) | 병렬 FFmpeg 4개 동시 실행. 초기 1회만 소요, 이후 증분 처리 |
| index.json 크기 증가 (10만개 → ~30MB) | 이 시점에서 Supabase API 전환. 그 전까지는 클라이언트 메모리 필터링으로 충분 |

## 추후 확장

- **프리미엄 모델**: Supabase Auth + Row Level Security + 관리자 대시보드 (유저/구독/결제)
- **백엔드 전환**: JSON → Supabase PostgreSQL + 관리자 UI
- **고급 플레이어**: 고스팅(오니언스킨), 드로잉 오버레이, 그리드 오버레이
- **커뮤니티**: 사용자 컬렉션, 댓글
- **AI 검색**: 시맨틱 검색 (Eagle AI Search 연동 가능)
