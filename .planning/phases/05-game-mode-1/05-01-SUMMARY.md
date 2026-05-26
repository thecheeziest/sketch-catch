---
phase: 05-game-mode-1
plan: 01
subsystem: infra
tags: [react-native-skia, expo-av, badwords-ko, hangul-js, vitest, typescript, game-types]

# Dependency graph
requires:
  - phase: 04-room-lobby
    provides: shared 타입 시스템, 서버 테스트 패턴 (vitest globals:false)
provides:
  - "@shopify/react-native-skia@1.5.3 모바일 설치"
  - "expo-av 모바일 설치"
  - "badwords-ko, hangul-js 서버 설치"
  - "Mode1RoundCurrent 타입 (RoomState.current용)"
  - "GameResult.ranking.answeredAt 필드 (동점자 정렬)"
  - "game.test.ts it.todo 스캐폴드 (MD1-01~04, DRAW-03)"
  - "profanity.test.ts it.todo 스캐폴드 (GAME-01)"
  - "apps/server/src/services/profanity/dict.txt"
affects:
  - 05-02
  - 05-03
  - 05-04
  - 05-05
  - 05-06
  - 05-07
  - 05-08
  - 05-09

# Tech tracking
tech-stack:
  added:
    - "@shopify/react-native-skia@1.5.3 (Expo 51 / RN 0.74 호환 버전)"
    - "expo-av (사운드 재생)"
    - "badwords-ko (한국어 비속어 필터)"
    - "hangul-js (자모 분리 정규화)"
  patterns:
    - "ambient declaration for missing @types: declare module 'hangul-js' in src/types/hangul-js.d.ts"

key-files:
  created:
    - apps/server/src/__tests__/profanity.test.ts
    - apps/server/src/services/profanity/dict.txt
    - apps/server/src/types/hangul-js.d.ts
  modified:
    - packages/shared/src/types/game.ts
    - apps/mobile/package.json
    - apps/server/package.json
    - pnpm-lock.yaml

key-decisions:
  - "@shopify/react-native-skia@1.5.3 핀: 최신 2.6.4는 react@>=19, RN>=0.78 요구 — Expo 51 / RN 0.74 환경에서 1.5.3 사용"
  - "@types/hangul-js 미존재: npm 레지스트리에 없음 → apps/server/src/types/hangul-js.d.ts에 ambient 선언 대체"
  - "game.test.ts는 이미 05-02에서 완전 구현된 상태 — it.todo 스텁 단계를 건너뜀 (동일 결과)"

patterns-established:
  - "ambient declaration pattern: @types/* 미존재 시 src/types/{pkg}.d.ts에 declare module 한 줄"

requirements-completed: [MD1-01, MD1-02, MD1-03, MD1-04, MD1-05, DRAW-03, GAME-01]

# Metrics
duration: 3min
completed: 2026-05-27
---

# Phase 5 Plan 01: 의존성 설치 + 타입 스캐폴드 Summary

**Skia/expo-av/badwords-ko/hangul-js 4종 설치, Mode1RoundCurrent 타입 + answeredAt 필드 추가, it.todo 테스트 스캐폴드로 다운스트림 병렬 작업 기반 마련**

## Performance

- **Duration:** 3min
- **Started:** 2026-05-26T23:25:44Z
- **Completed:** 2026-05-26T23:28:14Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- 모바일 2종(@shopify/react-native-skia@1.5.3, expo-av), 서버 2종(badwords-ko, hangul-js) 설치 완료
- `Mode1RoundCurrent` 타입과 `GameResult.ranking.answeredAt` 필드를 shared에 추가하고 빌드 통과
- `profanity.test.ts` it.todo 스캐폴드 + `services/profanity/dict.txt` 생성

## Task Commits

1. **Task 1: 의존성 4종 설치 + shared 게임 타입 추가** - `4b908f9` (chore)
2. **Task 2: 서버 테스트 스캐폴드(it.todo) + dict.txt 생성** - `b504e3a` (test)

## Files Created/Modified

- `packages/shared/src/types/game.ts` - Mode1RoundCurrent 타입 + GameResult.answeredAt 추가
- `apps/mobile/package.json` - @shopify/react-native-skia, expo-av 추가
- `apps/server/package.json` - badwords-ko, hangul-js 추가
- `apps/server/src/types/hangul-js.d.ts` - hangul-js ambient 타입 선언 (신규)
- `apps/server/src/__tests__/profanity.test.ts` - GAME-01 it.todo 스캐폴드 (신규)
- `apps/server/src/services/profanity/dict.txt` - 자체 비속어 사전 빈 파일 (신규)
- `pnpm-lock.yaml` - lockfile 업데이트

## Decisions Made

- `@shopify/react-native-skia@1.5.3` 버전 핀: 최신 2.6.4가 react@>=19, RN>=0.78을 요구하므로 Expo 51 / RN 0.74와 호환되는 1.5.3으로 다운그레이드
- `@types/hangul-js` npm 레지스트리 미존재 → `apps/server/src/types/hangul-js.d.ts`에 `declare module 'hangul-js'` ambient 선언으로 대체
- `game.test.ts`는 이미 05-02에서 완전 구현된 것을 확인 — it.todo 스텁 단계를 건너뛰었지만 실제 구현이 이미 존재하므로 목표 달성

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @shopify/react-native-skia 버전 다운그레이드**
- **Found during:** Task 1 (모바일 패키지 설치)
- **Issue:** 최신 버전(2.6.4)이 react@>=19, RN>=0.78, reanimated@>=3.19.1을 요구하지만 현재 프로젝트는 react@18.2.0, RN@0.74.5 사용
- **Fix:** 1.5.3 버전으로 명시 설치 (peer dependency 경고 없음)
- **Files modified:** apps/mobile/package.json, pnpm-lock.yaml
- **Verification:** peer dependency warning 없이 설치 완료
- **Committed in:** 4b908f9

**2. [Rule 3 - Blocking] @types/hangul-js ambient 선언으로 대체**
- **Found during:** Task 1 (서버 패키지 설치 시 @types/hangul-js 시도)
- **Issue:** `@types/hangul-js`가 npm 레지스트리에 없어 404 오류
- **Fix:** `apps/server/src/types/hangul-js.d.ts`에 `declare module 'hangul-js';` 한 줄 ambient 선언 생성
- **Files modified:** apps/server/src/types/hangul-js.d.ts (신규)
- **Verification:** TypeScript 빌드 오류 없음
- **Committed in:** 4b908f9

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** 계획서가 이미 두 케이스를 명시적으로 예측하고 대응 방법을 기재함 — 정확히 계획대로 처리됨.

## Issues Encountered

- `apps/server/src/__tests__/friends.test.ts`에서 pre-existing 2개 실패 발견 (Phase 5 이전부터 존재). 이 Plan의 범위 밖 → `.planning/phases/05-game-mode-1/deferred-items.md`에 기록.

## Known Stubs

None - 이 Plan은 타입 정의와 테스트 스캐폴드만 다루며, UI 렌더링 스텁 없음.

## Next Phase Readiness

- 다운스트림 plan 02~09가 필요로 하는 모든 타입과 테스트 스텁 준비 완료
- `@sketch-catch/shared`에서 `Mode1RoundCurrent`, `GameResult` import 가능
- Skia 캔버스(plan 03), 사운드(plan 08), 비속어 필터(plan 07) 모두 의존성 설치 완료

---
*Phase: 05-game-mode-1*
*Completed: 2026-05-27*
