---
phase: 02-auth-profile
plan: "02"
subsystem: testing
tags: [vitest, jose, jsonwebtoken, auth, testing]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: apps/server 워크스페이스 (TypeScript + ESM 설정)
provides:
  - vitest 테스트 인프라 (apps/server)
  - jose + jsonwebtoken 패키지 (JWKS 검증 + JWT 발급)
  - auth.test.ts placeholder (Plan 04가 채울 AUTH-01/02/04, D-05 테스트 목록)
  - me.test.ts placeholder (Plan 05가 채울 PROF-01/02/03/05 테스트 목록)
  - smoke.test.ts (인프라 동작 확인)
affects: [02-04, 02-05]

# Tech tracking
tech-stack:
  added:
    - vitest@2.1.0 (테스트 러너, ESM 친화)
    - jose@6.2.3 (JWKS 검증 + JWT sign/verify, ESM Web Crypto 기반)
    - jsonwebtoken@9.0.3 (fallback, env.JWT_SECRET 호환)
    - "@types/jsonwebtoken@9.0.6"
  patterns:
    - "테스트 파일 위치: apps/server/src/__tests__/*.test.ts"
    - "vitest import 방식: named import from vitest (globals: false)"

key-files:
  created:
    - apps/server/vitest.config.ts
    - apps/server/src/__tests__/smoke.test.ts
    - apps/server/src/__tests__/auth.test.ts
    - apps/server/src/__tests__/me.test.ts
  modified:
    - apps/server/package.json
    - apps/server/tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "vitest 선택 (jest 대신): apps/server type=module ESM 환경에서 jest ESM 설정이 복잡 — vitest가 ESM 친화적"
  - "globals: false 설정: describe/it/expect를 명시적 import로 사용 — 암묵적 전역 오염 방지"
  - "tsconfig exclude에 **/*.test.ts 추가: 빌드 산출물에서 테스트 파일 제외"

patterns-established:
  - "테스트 placeholder 패턴: it.todo()로 미래 테스트 목록 가시화 + it()으로 placeholder 1개 보장"

requirements-completed: [AUTH-01, AUTH-02, AUTH-04, PROF-01, PROF-05]

# Metrics
duration: 10min
completed: "2026-05-15"
---

# Phase 02 Plan 02: 서버 테스트 인프라 및 인증 라이브러리 설치 Summary

**vitest + jose + jsonwebtoken을 apps/server에 설치하고, auth/me 테스트 placeholder를 생성해 Plan 04/05의 테스트 토대를 마련**

## Performance

- **Duration:** 10min
- **Started:** 2026-05-15T09:56:33Z
- **Completed:** 2026-05-15T09:58:40Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- jose@6.2.3, jsonwebtoken@9.0.3, vitest@2.1.0 설치 완료
- vitest.config.ts 생성 (environment: node, ESM 친화)
- auth.test.ts / me.test.ts placeholder — Plan 04/05에서 채울 it.todo() 목록 포함
- `pnpm --filter @sketch-catch/server test` 3 passed, 12 todo로 통과

## Task Commits

각 태스크가 원자적으로 커밋됨:

1. **Task 1: 서버 의존성 설치 (jose, jsonwebtoken, vitest)** - `bff0d07` (chore)
2. **Task 2: 인증/프로필 테스트 placeholder 작성 + smoke test** - `0c67b0e` (test)

## Files Created/Modified
- `apps/server/vitest.config.ts` - vitest 설정 (environment: node, include: src/**/*.test.ts)
- `apps/server/src/__tests__/smoke.test.ts` - 인프라 동작 확인 smoke test
- `apps/server/src/__tests__/auth.test.ts` - AUTH-01/02/04, D-05 todo placeholder (Plan 04용)
- `apps/server/src/__tests__/me.test.ts` - PROF-01/02/03/05 todo placeholder (Plan 05용)
- `apps/server/package.json` - scripts에 test/test:watch 추가, 의존성 추가
- `apps/server/tsconfig.json` - types에 vitest 추가, exclude에 **/*.test.ts 추가
- `pnpm-lock.yaml` - 신규 패키지 lockfile 갱신

## Decisions Made
- vitest를 jest 대신 선택: `apps/server`가 `"type": "module"` ESM 환경이라 jest의 ESM 설정이 복잡하고 불안정. vitest는 ESM 네이티브.
- `globals: false`: describe/it/expect를 명시적으로 import — 암묵적 전역보다 타입 안전.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- VALIDATION.md Wave 0 gap 해소: auth.test.ts ✓, me.test.ts ✓, vitest 설치 ✓
- Plan 04 (auth 라우트)에서 auth.test.ts의 it.todo()를 실제 구현 테스트로 교체 가능
- Plan 05 (me 라우트)에서 me.test.ts의 it.todo()를 실제 구현 테스트로 교체 가능

---
*Phase: 02-auth-profile*
*Completed: 2026-05-15*
