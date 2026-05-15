---
phase: 02-auth-profile
plan: 03
subsystem: auth
tags: [kakao-login, apple-authentication, expo-secure-store, zustand, tanstack-query, react-hook-form, vitest, expo-plugin]

# Dependency graph
requires: []
provides:
  - apps/mobile에 인증 관련 네이티브/JS 의존성 10종 설치
  - app.json expo.plugins에 kakao-login, expo-secure-store 등록 (Expo prebuild 지원)
  - app.json ios.usesAppleSignIn: true (Apple Sign In entitlement)
  - vitest 테스트 인프라 (node environment, src alias)
  - auth-store.test.ts placeholder (AUTH-05/D-06 todo 가시화)
affects: [02-06, 02-07, 02-08, 02-09]

# Tech tracking
tech-stack:
  added:
    - "@react-native-seoul/kakao-login@^5.4.2"
    - "@invertase/react-native-apple-authentication@^2.5.1"
    - "expo-secure-store@^13.0.2 (SDK 51 호환)"
    - "@tanstack/react-query@^5.100.10"
    - "zustand@^5.0.13"
    - "immer@^11.1.8"
    - "react-hook-form@^7.75.0"
    - "@hookform/resolvers@^3.10.0"
    - "expo-clipboard@^6.0.3 (SDK 51 호환)"
    - "@expo/vector-icons@^15.1.1"
    - "vitest@^2.1.0 (devDep)"
  patterns:
    - "vitest node environment로 순수 TS 로직(store, validation) 테스트 — RN 컴포넌트 테스트는 manual"
    - "expo install로 SDK 51 호환 버전 재정렬 (expo-secure-store, expo-clipboard)"

key-files:
  created:
    - apps/mobile/vitest.config.ts
    - apps/mobile/src/__tests__/smoke.test.ts
    - apps/mobile/src/__tests__/auth-store.test.ts
  modified:
    - apps/mobile/package.json
    - apps/mobile/app.json

key-decisions:
  - "expo-clipboard 채택 (RESEARCH 제안 @react-native-clipboard/clipboard 대신 — Expo 환경에서 추가 설정 불필요)"
  - "vitest.config.ts에서 import.meta.url 대신 path.resolve(__dirname) 사용 — expo/tsconfig.base module 설정 미명시로 import.meta 오류 발생"
  - "@types/react-native@0.74.0 미존재 → 0.73.0 (최신 버전) 대체"

patterns-established:
  - "pnpm exec npx expo install로 SDK 호환 버전 재정렬 — pnpm add 후 호환 경고 시 적용"

requirements-completed: [AUTH-01, AUTH-02, AUTH-05, PROF-04]

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 02 Plan 03: 모바일 의존성 설치 및 Expo Plugin 등록 Summary

**카카오/애플/SecureStore 등 인증 네이티브 SDK 10종 설치, Expo plugin 등록으로 Pitfall 2 회피, vitest 인프라 구축 및 auth-store 테스트 placeholder 작성**

## Performance

- **Duration:** 3min
- **Started:** 2026-05-15T00:56:33Z
- **Completed:** 2026-05-15T00:59:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- 인증 관련 네이티브/JS 패키지 10종 설치 (kakao-login, apple-auth, SecureStore, TanStack Query, Zustand, immer, react-hook-form, hookform/resolvers, expo-clipboard, vector-icons)
- app.json plugins에 kakao-login + expo-secure-store 등록 → EAS prebuild 시 iOS/Android 네이티브 코드 자동 삽입 (Pitfall 2 회피)
- app.json ios.usesAppleSignIn: true → Expo가 Apple Sign In entitlement 자동 추가
- vitest.config.ts 생성 + test/test:watch 스크립트 등록 → `pnpm test` 실행 가능
- auth-store.test.ts placeholder (AUTH-05/D-06 목표 가시화, Plan 07에서 실 구현 채움)

## Task Commits

1. **Task 1: 모바일 의존성 설치 + Expo plugin 등록** - `a15819a` (chore)
2. **Task 2: 모바일 auth-store 테스트 placeholder** - `f308247` (test)

## Files Created/Modified
- `apps/mobile/package.json` - 10개 의존성 추가, test/test:watch 스크립트 추가, vitest devDep
- `apps/mobile/app.json` - plugins 배열에 expo-secure-store/kakao-login 추가, ios.usesAppleSignIn: true 추가
- `apps/mobile/vitest.config.ts` - vitest 설정 (node env, src alias, 10초 timeout)
- `apps/mobile/src/__tests__/smoke.test.ts` - vitest 인프라 smoke test
- `apps/mobile/src/__tests__/auth-store.test.ts` - AUTH-05/D-06 todo placeholder

## Decisions Made
- expo-clipboard 채택: RESEARCH가 @react-native-clipboard/clipboard를 제안했으나 Expo 환경에서는 expo-clipboard가 추가 설정 없이 동작
- vitest.config.ts에서 `import.meta.url` 대신 `path.resolve(__dirname)` 사용: expo/tsconfig.base가 module 옵션을 명시하지 않아 import.meta가 TS 오류 발생
- @types/react-native@0.73.0 사용: 0.74.0은 미존재, react-native 0.74 자체적으로 타입 포함하므로 stub 패키지로 충분

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @types/react-native@0.74.0 미존재**
- **Found during:** Task 1 (devDependencies 설치)
- **Issue:** pnpm이 @types/react-native@^0.74.0 버전을 찾지 못함 (최신 0.73.0)
- **Fix:** @types/react-native@^0.73.0으로 대체 설치
- **Files modified:** apps/mobile/package.json
- **Verification:** pnpm install 성공
- **Committed in:** a15819a (Task 1 commit)

**2. [Rule 1 - Bug] vitest.config.ts import.meta.url TypeScript 오류**
- **Found during:** Task 1 (typecheck 단계)
- **Issue:** expo/tsconfig.base에 module 옵션 미설정 → import.meta 사용 불가 (TS1343)
- **Fix:** `import.meta.url` → `path.resolve(__dirname, './src')` 대체
- **Files modified:** apps/mobile/vitest.config.ts
- **Verification:** pnpm typecheck exit 0
- **Committed in:** a15819a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** 두 수정 모두 typecheck 통과를 위한 필수 수정. 계획 범위 벗어남 없음.

## Issues Encountered
- `npx expo install expo-secure-store expo-clipboard` 실행으로 초기 설치된 ^55.x 버전을 SDK 51 호환 버전(~13.0.2, ~6.0.3)으로 재정렬 완료

## User Setup Required
None - 카카오 앱키(KAKAO_NATIVE_APP_KEY_PLACEHOLDER)는 Plan 08에서 실제 EAS 빌드 시 설정 예정.

## Next Phase Readiness
- Plan 04(서버 의존성), Plan 05, 06 등과 독립 실행 가능
- Plan 07(모바일 인증 인프라)에서 auth-store.test.ts 실 구현 채울 준비 완료
- EAS dev client 재빌드(Plan 08) 전까지는 네이티브 모듈 import는 타입만 확인 가능

---
*Phase: 02-auth-profile*
*Completed: 2026-05-15*

## Self-Check: PASSED

- FOUND: apps/mobile/package.json
- FOUND: apps/mobile/app.json
- FOUND: apps/mobile/vitest.config.ts
- FOUND: apps/mobile/src/__tests__/smoke.test.ts
- FOUND: apps/mobile/src/__tests__/auth-store.test.ts
- FOUND: .planning/phases/02-auth-profile/02-03-SUMMARY.md
- FOUND: commit a15819a (Task 1)
- FOUND: commit f308247 (Task 2)
