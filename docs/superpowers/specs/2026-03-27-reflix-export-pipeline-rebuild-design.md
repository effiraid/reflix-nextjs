# Reflix Export Pipeline Rebuild Design

## Goal

`LIF-14`의 목표는 Reflix export를 “작은 배치에서 겨우 돌아가는 스크립트”에서 “10k 규모에서도 재개 가능하고 운영자가 믿을 수 있는 파이프라인”으로 재구성하는 것이다.

이번 설계는 아래를 동시에 만족해야 한다.

- 비싼 단계가 더 이상 단일 순차 루프에 묶이지 않는다.
- 중간 실패 후에도 명시적 체크포인트를 기준으로 안전하게 재개할 수 있다.
- `related-clips` 계산을 독립 단계로 분리하고, 전체 재계산만 강제하지 않는 구조로 바꾼다.
- 운영자가 각 단계의 진행률, 실패 범위, 재개 동작을 한글 메시지로 이해할 수 있다.

## Non-Goals

- Eagle을 소스 오브 트루스에서 제거하지 않는다.
- CI 기반 완전 자동 publish 시스템이나 별도 원격 job service를 이번 범위에 넣지 않는다.
- browse payload, deploy artifact 분리 문제는 이 문서에서 직접 해결하지 않는다.

## Current Problems

현재 export는 기능적으로는 동작하지만, 운영 안정성 관점에서는 아래 문제가 있다.

### 1. 비싼 단계가 순차 실행에 묶여 있다

- clip별 영상 처리
- preview 생성
- thumbnail 변환
- LQIP 생성
- R2 업로드

이 단계들이 대부분 item 단위 순차 루프에 묶여 있어서 clip 수가 커질수록 총 시간이 선형으로 늘어난다.

### 2. 재개가 “파일이 있으면 건너뛴다” 수준에 머물러 있다

현재도 일부 output 파일이 있으면 skip되지만, 이것만으로는 안전한 체크포인트라고 보기 어렵다.

- 결과 파일이 있어도 그 파일이 검증된 성공 산출물인지 알기 어렵다.
- clip JSON, browse artifact, related-clips, upload는 별도 단계 완료로 기록되지 않는다.
- 일부 단계만 실패했을 때 어디까지 재사용해도 되는지 명확하지 않다.

### 3. related-clips가 긴 tail stage가 될 수 있다

현재 구조는 merged output을 쓴 뒤 전체 clip JSON을 다시 읽어서 `relatedClips`를 덮어쓴다. 이 방식은 아이템 수가 작을 때는 단순하지만, 10k 규모에서는 “마지막 정리 단계”가 의미 있는 병목이 될 수 있다.

### 4. 운영자가 상태를 읽기 어렵다

지금은 실행 로그가 있어도 다음 질문에 바로 답하기 어렵다.

- 총 몇 개 중 몇 개가 끝났는가
- 지금 어느 단계인가
- 재시작 시 무엇을 재사용하는가
- 실패가 전체 실패인지 일부 실패인지

## Approved Direction

이번 이슈는 단순 루프 최적화가 아니라, export를 명시적 stage 기반 파이프라인으로 재구성한다.

선택한 방향은 다음과 같다.

- bounded concurrency를 도입한다.
- 안전 우선 재개 정책을 채택한다.
- run 단위 체크포인트를 도입한다.
- `related-clips`를 독립 stage로 분리하고 부분 재계산을 기본 전략으로 설계한다.
- 상태가 의심스러울 때는 부분 재사용보다 재계산 또는 중단을 택한다.

## Operator Experience

운영자가 체감해야 하는 경험은 아래와 같다.

1. export를 시작하면 run 하나가 생성된다.
2. run은 대상 수, 현재 단계, 성공/실패/건너뜀 개수를 기록한다.
3. 중간에 멈춰도 다음 실행이 “검증된 단계만” 재사용한다.
4. 애매한 상태는 조용히 넘기지 않고 한글 메시지로 드러낸다.
5. 업로드 실패, related 실패, 일부 clip 실패를 전체 실패와 구분해서 볼 수 있다.

예상 콘솔 메시지 예시:

- `실행 시작: 총 2,418개 클립`
- `미디어 처리 단계: 완료 1,900개 / 실패 12개 / 대기 506개`
- `재개 모드: 검증된 결과를 재사용하고 실패한 12개만 다시 처리합니다`
- `연관 클립 계산 단계: 영향받은 387개 클립만 다시 계산합니다`
- `업로드 단계: 예정 7,140개 / 업로드 완료 6,980개 / 건너뜀 160개 / 실패 0개`
- `실행 완료: 총 2,418개 중 성공 2,406개 / 실패 12개`

원칙:

- 사람이 보는 출력은 모두 한글로 맞춘다.
- 내부 state key와 code identifier는 구현 편의를 위해 영어를 유지해도 된다.
- 경고와 실패 메시지는 “무엇을 자동 재사용했고, 무엇을 다시 계산했는지”를 분명히 말해야 한다.

## Pipeline Architecture

export는 아래 stage로 재구성한다.

1. `discover`
2. `process-media`
3. `build-artifacts`
4. `compute-related`
5. `upload`
6. `finalize`

각 stage는 입력, 완료 조건, 실패 semantics를 분리해서 가진다.

### 1. discover

역할:

- 이번 run에서 처리할 clip 목록을 확정한다.
- `--ids`, `--batch`, `--full` 해석 결과를 run manifest에 고정한다.
- 실행 중 배치 내용이 흔들리지 않게 한다.

완료 기준:

- 대상 clip ID 목록이 run manifest에 저장된다.
- 각 clip에 대한 기본 source snapshot이 기록된다.

### 2. process-media

역할:

- 비디오 해상도 확인
- LQIP 생성
- 영상 변환
- preview 생성
- thumbnail 생성

정책:

- clip 단위 bounded concurrency를 적용한다.
- 같은 clip 내부에서는 output 충돌을 막기 위해 asset 생성 순서를 통제한다.
- 결과 파일만 보고 성공 처리하지 않고, 파일 존재 + 0 byte 아님 + stage checkpoint까지 맞아야 성공으로 본다.

완료 기준:

- clip별 media outputs가 검증된다.
- clip별 media checkpoint가 저장된다.

### 3. build-artifacts

역할:

- `buildClipIndex`
- `buildFullClip`
- 개별 clip JSON 작성
- merged index 작성
- browse summary / projection 작성

정책:

- clip별 artifact input이 확정된 뒤에만 실행한다.
- 원자적 쓰기를 기본으로 하여 반쯤 써진 JSON이 성공 상태로 남지 않게 한다.
- artifact stage는 media stage와 분리된 성공 단위를 가진다.

완료 기준:

- clip JSON
- `src/data/index.json`
- `public/data/browse/*`

위 산출물들이 모두 검증되고 artifact checkpoint가 기록된다.

### 4. compute-related

역할:

- `relatedClips`를 독립 stage로 계산하고 반영한다.

정책:

- “항상 전체 재계산”을 기본 구조로 두지 않는다.
- 이번 run에서 변경된 clip과 그 clip들과 태그/폴더를 공유하는 이웃 clip을 영향 범위로 계산한다.
- 정상 상황에서는 영향 범위만 다시 계산한다.
- 영향 범위 계산 근거가 불충분하거나 checkpoint가 의심스러우면 전체 재계산으로 fallback 한다.

완료 기준:

- 영향 대상 clip들의 `relatedClips`가 최신 규칙으로 다시 기록된다.
- related stage가 부분 갱신인지 전체 갱신인지 run summary에 남는다.

### 5. upload

역할:

- R2 대상 파일을 계획하고 업로드한다.

정책:

- 업로드도 bounded concurrency를 사용한다.
- 각 파일은 `planned`, `uploaded`, `skipped`, `failed` 상태를 개별적으로 가진다.
- upload 실패가 local artifact 성공을 무효화하지는 않지만, run 전체는 실패 상태가 될 수 있다.
- 재개 시에는 검증된 local 결과를 재사용하고 upload만 다시 시도할 수 있어야 한다.

완료 기준:

- 대상 파일별 업로드 결과가 checkpoint에 기록된다.

### 6. finalize

역할:

- run 전체 요약 작성
- 실패 수와 경고 수 집계
- 필요한 경우 prune 실행
- 최종 성공 또는 실패 판정

정책:

- 필수 stage가 모두 완료된 뒤에만 성공으로 마감한다.
- 부분 성공 상태를 숨기지 않는다.
- prune은 실패가 남아 있는 상태에서 자동 실행하지 않는다.

## Run Workspace and Checkpoint Model

각 export 실행은 `.tmp/export-runs/<run-id>/` 아래의 전용 작업 디렉터리를 가진다.

예시 구조:

```text
.tmp/export-runs/<run-id>/
  manifest.json
  summary.json
  stages/
    discover.json
    process-media.json
    build-artifacts.json
    compute-related.json
    upload.json
    finalize.json
  items/
    <clip-id>.json
```

### manifest.json

포함 정보:

- run id
- started at
- source mode (`ids`, `batch`, `full`)
- source label
- requested clip ids
- concurrency 설정
- resume 여부
- 관련 플래그 (`dry-run`, `r2`, `prune`)

### items/<clip-id>.json

clip별 상태 파일은 최소 아래 정보를 가진다.

- source snapshot
  - Eagle mtime
  - media path
  - thumbnail path
- stage state
  - media
  - artifacts
  - related
  - upload
- outputs
  - local file paths
  - file size / 검증 정보
- last error

### Checkpoint Rules

- checkpoint는 stage 성공 후에만 기록한다.
- checkpoint 파일 쓰기도 가능한 한 원자적으로 처리한다.
- checkpoint가 있다고 해서 무조건 재사용하지 않는다.
- checkpoint와 실제 파일 검증이 모두 통과해야 재사용한다.

## Safe Resume Semantics

재개 정책은 “속도보다 신뢰”를 우선한다.

### 재사용 조건

아래를 모두 만족할 때만 재사용한다.

- 해당 stage checkpoint가 존재한다.
- 필요한 output file이 존재한다.
- output file size가 0이 아니다.
- source snapshot과 현재 입력이 stage 재사용에 안전하다고 판단된다.

### 재계산 조건

아래 중 하나라도 만족하면 해당 stage를 다시 계산한다.

- checkpoint는 있지만 output 검증이 실패한다.
- 입력 metadata가 바뀌었다.
- 이전 stage는 성공했지만 다음 stage에서 필요한 파생 산출물이 없다.
- 현재 code version과 checkpoint schema가 맞지 않는다.

### 중단 조건

아래 경우는 조용히 재시도하지 않고 run을 실패로 남긴다.

- 어떤 결과를 재사용해도 되는지 판단할 수 없다.
- stage 간 의존성이 깨져 있어서 부분 재개가 위험하다.
- checkpoint 파일 자체가 손상되었다.

## Concurrency Strategy

### Local Media Concurrency

- 병렬성은 clip 단위로 적용한다.
- 기본값은 보수적으로 시작하고, CLI 또는 config로 조정 가능하게 둔다.
- 한 clip 내부의 동일 output 경로를 두 worker가 동시에 만지지 않게 한다.
- 실패한 clip 하나가 전체 worker pool을 즉시 중단시키지 않도록 per-item failure를 분리한다.

### Upload Concurrency

- upload도 별도 worker limit를 가진다.
- skip-existing 확인과 upload 결과를 파일 단위로 기록한다.
- 재시도는 유지하되, 각 attempt 결과가 summary에 드러나야 한다.

## Related-Clips Redesign

이번 이슈에서 `related-clips`는 단순 후처리 단계를 넘어, 부분 갱신 가능한 구조로 재설계한다.

### 핵심 아이디어

- 추천 계산에 영향을 주는 필드만 별도로 본다.
- 이번 run에서 실제로 관련도에 영향을 준 clip을 찾는다.
- 그 clip들과 태그/폴더를 공유하는 이웃 clip만 재계산 대상으로 확장한다.
- 정상 상황에서는 이 영향 범위만 다시 계산한다.

### 영향 판단 기준

아래 값이 바뀐 clip은 related 영향 대상으로 본다.

- public tags
- folders
- category
- 추천 계산 규칙에 실제로 들어가는 기타 필드

이름, annotation 같은 값은 현재 추천 점수에 직접 들어가지 않는다면 related 영향 대상에서 제외할 수 있다.

### 안전 fallback

아래 경우는 전체 재계산으로 되돌린다.

- 영향 범위 계산에 필요한 기존 자료가 없다.
- checkpoint가 손상되었다.
- related 규칙 버전이 바뀌었다.
- 부분 갱신 결과의 완전성을 신뢰하기 어렵다.

## Output Consistency Rules

- `build-artifacts`가 끝나기 전에는 merged output을 최종 결과로 간주하지 않는다.
- `compute-related`가 끝나기 전에는 clip JSON이 detail-complete 상태가 아니다.
- `upload`가 실패해도 local artifact는 남을 수 있지만, run summary는 성공으로 닫히지 않는다.
- `finalize` 이전에는 “이번 export가 끝났다”는 메시지를 출력하지 않는다.

## Error Handling

오류는 아래 세 층으로 나눠 다룬다.

### Item Error

특정 clip만 실패한 경우다.

- media 변환 실패
- source file 누락
- 개별 JSON 작성 실패

이 경우 다른 clip 처리는 계속 진행할 수 있어야 한다.

### Stage Error

stage 전체가 신뢰할 수 없는 경우다.

- merged index 쓰기 실패
- browse artifact 쓰기 실패
- related 전체 갱신 단계 실패

이 경우 run은 실패 상태가 되며, 이후 stage는 보수적으로 막을 수 있다.

### Resume Integrity Error

재개 판단 자체가 위험한 경우다.

- checkpoint schema mismatch
- checkpoint corruption
- output verification mismatch

이 경우 자동 재개보다 재계산 또는 중단을 택한다.

## CLI and UX Expectations

새 CLI 경험은 아래 요구를 만족해야 한다.

- 지금 어떤 stage인지 바로 보인다.
- 병렬 처리 중에도 요약 숫자가 안정적으로 읽힌다.
- 실패 요약은 clip 수와 file 수를 분리해서 보여준다.
- 재개 실행 시 “무엇을 재사용했고 무엇을 다시 하는지”를 한글로 알려준다.

dry-run에서도 가능하면 아래를 예고해야 한다.

- 대상 수
- stage별 예상 작업 수
- 업로드 예정 수
- related 재계산 예상 범위

## Testing Expectations

이번 설계는 단순 happy path 테스트만으로는 부족하다.

최소 검증 범위:

- stage별 checkpoint 생성/재사용
- output 검증 실패 시 재계산 경로
- media 병렬 처리 중 일부 clip 실패
- upload 병렬 처리 중 일부 파일 실패 + 재개
- related 영향 범위 계산
- related fallback 전체 재계산
- 손상된 checkpoint 처리
- prune이 실패 run에서 자동 실행되지 않음

## Risks

- 병렬 처리 도입 시 동일 경로에 대한 write race
- checkpoint를 너무 자세히 기록해 오히려 복잡도가 커질 위험
- 부분 related 갱신 규칙이 불충분하면 잘못된 추천이 남을 위험
- 운영자 메시지가 장황해져 핵심 정보가 흐려질 위험

## Recommended Implementation Shape

구현은 거대한 단일 파일 확장보다 작은 모듈 분리를 우선한다.

권장 경계:

- export CLI orchestration
- run state / checkpoint persistence
- bounded concurrency helper
- media stage runner
- artifact stage runner
- related stage runner
- upload stage runner
- operator summary renderer

이렇게 나누면 stage별 테스트와 재개 semantics를 독립적으로 검증하기 쉽다.

## Final Decision

이번 `LIF-14`는 아래 방향으로 고정한다.

- stage 기반 export 파이프라인으로 재구성
- local media 병렬화
- upload 병렬화
- run 단위 체크포인트 도입
- 안전 우선 재개 정책
- `related-clips` 부분 갱신 + 안전 fallback 전체 재계산
- 운영자 콘솔 메시지 한글화
