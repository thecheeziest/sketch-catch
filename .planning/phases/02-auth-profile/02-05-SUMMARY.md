---
phase: 02-auth-profile
plan: 05
subsystem: server-auth
tags: [authentication, middleware, profile, jwt, redis, tdd]
dependency_graph:
  requires: [02-01, 02-04]
  provides: [authenticate-prehandler, me-routes, me-service]
  affects: [future-protected-routes]
tech_stack:
  added: []
  patterns: [fastify-prehandler, tdd-red-green, pure-function-time-injection]
key_files:
  created:
    - apps/server/src/middleware/authenticate.ts
    - apps/server/src/services/me.service.ts
    - apps/server/src/types/fastify.d.ts
    - apps/server/src/routes/me.ts
    - apps/server/src/auth/jwt.ts
    - apps/server/src/auth/kakao.ts
    - apps/server/src/auth/apple.ts
    - apps/server/src/services/user.service.ts
    - apps/server/src/routes/auth.ts
  modified:
    - apps/server/src/main.ts
    - apps/server/src/lib/env.ts
    - apps/server/src/__tests__/me.test.ts
    - apps/server/src/__tests__/auth.test.ts
decisions:
  - "assertNicknameCooldown에 now 파라미터 주입 — 시간 의존성 없이 순수 함수로 단위 테스트 가능"
  - "prisma.$transaction mock에 user.delete 명시 필요 — Prisma sequential transaction 구조"
metrics:
  duration: "6분"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_changed: 13
---

# Phase 02 Plan 05: authenticate preHandler + /me 라우트 Summary

Bearer JWT + Redis session 검증 미들웨어와 GET/PATCH/DELETE /me 3개 라우트 구현으로 프로필 관리 및 D-05/D-06 단일 기기 정책 완성.

## What Was Built

### Task 1: authenticate preHandler + Fastify 타입 확장 + me.service

**의존 모듈 구현 (Rule 3 - Blocking: 워크트리에 Plan 04 결과물 누락)**

- `apps/server/src/auth/jwt.ts` — `signTokens`, `verifyAccessToken`, `verifyRefreshToken` (jose HS256)
- `apps/server/src/auth/kakao.ts` — `verifyKakaoToken` (Kakao JWKS 원격 검증)
- `apps/server/src/auth/apple.ts` — `verifyAppleToken` (Apple JWKS + audience 검증)
- `apps/server/src/services/user.service.ts` — `upsertUserByProvider`, `ensureUniqueNicknameCode`, `NicknameCodeConflictError`
- `apps/server/src/routes/auth.ts` — POST /auth/{kakao,apple,refresh,logout} 4개 엔드포인트
- `apps/server/src/lib/env.ts` — KAKAO_ISSUER, APPLE_ISSUER, JWT_ACCESS_TTL, JWT_REFRESH_TTL 추가

**Plan 05 핵심 구현**

- `apps/server/src/types/fastify.d.ts` — `FastifyRequest.userId?: string` 선언 확장
- `apps/server/src/middleware/authenticate.ts` — Bearer 검증 → Redis session 매칭 (D-05/D-06)
- `apps/server/src/services/me.service.ts` — `assertNicknameCooldown`(30일 순수 함수), `updateMe`, `deleteMe`, `NicknameCooldownError`

### Task 2: /me 라우트 등록 + main.ts wiring + 통합 테스트

- `apps/server/src/routes/me.ts` — GET/PATCH/DELETE /me (모두 `preHandler: authenticate`)
- `apps/server/src/main.ts` — `meRoutes` 등록
- `apps/server/src/__tests__/me.test.ts` — 9개 테스트 (단위 3 + 통합 6)

## Test Results

21개 테스트 전체 통과:
- smoke.test.ts: 1개
- task1.test.ts: 6개
- auth.test.ts: 5개
- me.test.ts: 9개 (assertNicknameCooldown 3 + GET /me 3 + PATCH /me 2 + DELETE /me 1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 04 의존 모듈 누락 — 워크트리 격리 환경**

- **Found during:** Task 1 시작 시
- **Issue:** 이 워크트리(`39a71a5`)는 main 브랜치(`1442ce4`)보다 이전 커밋에 고정되어 있어 Plan 04 결과물(auth/, services/user.service.ts, routes/auth.ts, lib/env.ts 변경)이 워킹 트리에 없었음
- **Fix:** Plan 04 PLAN.md를 참조해 동일한 구현을 재현 — jwt.ts, kakao.ts, apple.ts, user.service.ts, routes/auth.ts, env.ts 변경
- **Files modified:** 위 6개 파일
- **Commit:** f7dea5f

**2. [Rule 1 - Bug] DELETE /me 테스트 500 오류 — prisma mock에 user.delete 미포함**

- **Found during:** Task 2 테스트 실행
- **Issue:** `prisma.$transaction` mock이 ops 배열을 단순 `Promise.all`로 처리했지만, `prisma.user.delete`가 mock 객체에 없어 `not a function` 에러 발생
- **Fix:** mock에 `prisma.user.delete: vi.fn().mockResolvedValue({})` 추가 + `$transaction`을 순차 await 방식으로 수정
- **Files modified:** apps/server/src/__tests__/me.test.ts
- **Commit:** f13855b (수정 포함)

## Requirements Fulfilled

- AUTH-03: 온보딩 PATCH /me로 닉네임/코드/캐릭터 확정 가능
- AUTH-04: updateMe 내 ensureUniqueNicknameCode → 409 NICKNAME_CODE_CONFLICT
- AUTH-05: authenticate preHandler Bearer + Redis session 검증
- PROF-01: 닉네임 30일 cooldown → 429 NICKNAME_CHANGE_COOLDOWN + nextChangeAt
- PROF-02: 친구코드 cooldown 없이 변경 (조합 중복 검사 적용)
- PROF-03: 캐릭터 cooldown 없이 변경
- PROF-04: GET /me 프로필 조회
- PROF-05: DELETE /me → FriendRequest → Friendship → GameReplay → User cascade (prisma.$transaction)
- D-05/D-06: 단일 기기 정책 — 모든 /me 라우트가 authenticate 통과 필수

## Known Stubs

없음. 모든 구현이 실제 동작하며 테스트로 검증됨.

## Self-Check: PASSED
