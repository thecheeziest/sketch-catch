---
phase: 02-auth-profile
plan: "04"
subsystem: server-auth
tags: [auth, jwt, jwks, kakao, apple, redis, fastify, vitest, tdd]
dependency_graph:
  requires: ["02-01", "02-02"]
  provides: ["POST /auth/kakao", "POST /auth/apple", "POST /auth/refresh", "POST /auth/logout", "signTokens", "verifyAccessToken", "verifyRefreshToken", "upsertUserByProvider", "ensureUniqueNicknameCode"]
  affects: ["02-05", "02-07", "02-08"]
tech_stack:
  added: []
  patterns:
    - "jose JWKS 원격 검증 (Kakao/Apple)"
    - "jose HS256 JWT sign/verify"
    - "Fastify FastifyPluginAsync 라우트 패턴"
    - "Redis session:{userId} 단일 기기 정책 (D-05)"
    - "vitest mock + Fastify inject 라우트 테스트"
key_files:
  created:
    - apps/server/src/auth/jwt.ts
    - apps/server/src/auth/kakao.ts
    - apps/server/src/auth/apple.ts
    - apps/server/src/services/user.service.ts
    - apps/server/src/routes/auth.ts
    - apps/server/src/__tests__/task1.test.ts
  modified:
    - apps/server/src/lib/env.ts
    - apps/server/src/main.ts
    - apps/server/src/__tests__/auth.test.ts
decisions:
  - "jose 단일 라이브러리로 JWKS 원격 검증 + HS256 자체 JWT 모두 처리 — ESM 네이티브, Web Crypto API 기반"
  - "Redis session:{userId}에 현 accessToken 저장으로 단일 기기 정책 구현 (D-05)"
  - "NicknameCodeConflictError 클래스에 code 프로퍼티 추가 — catch 후 error code 판별 가능"
  - "verifyToken 내부 함수에 expectedTyp 파라미터로 access/refresh typ claim 교차 사용 차단"
metrics:
  duration: "3분 19초"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_changed: 9
---

# Phase 02 Plan 04: 서버 인증 라우트 구현 Summary

**One-liner:** jose JWKS 검증 + HS256 JWT 발급/갱신 + Fastify auth 라우트 4개 + Redis 단일 기기 세션 구현

## What Was Built

카카오/애플 OAuth idToken JWKS 검증부터 자체 JWT 발급, Redis 세션 관리까지 서버 인증 전체 파이프라인 구현.

- **`auth/jwt.ts`**: `signTokens` (access 15m + refresh 30d), `verifyAccessToken`, `verifyRefreshToken`. typ claim으로 access/refresh 토큰 교차 사용 차단.
- **`auth/kakao.ts`**: Kakao JWKS (`kauth.kakao.com/.well-known/jwks.json`) 원격 검증. issuer 검증 포함.
- **`auth/apple.ts`**: Apple JWKS (`appleid.apple.com/auth/keys`) 검증. issuer + audience(APPLE_BUNDLE_ID) 검증.
- **`services/user.service.ts`**: `upsertUserByProvider` (기존 사용자 반환 or 신규 생성, isNew 플래그), `ensureUniqueNicknameCode` (닉네임#코드 조합 중복 검사, NicknameCodeConflictError).
- **`routes/auth.ts`**: POST /auth/kakao, /auth/apple, /auth/refresh, /auth/logout. 모든 로그인/refresh 시 `redis.set(session:{userId}, accessToken)` (D-05 단일 기기).
- **`lib/env.ts`**: KAKAO_ISSUER, APPLE_ISSUER, JWT_ACCESS_TTL, JWT_REFRESH_TTL 필드 추가.
- **`main.ts`**: authRoutes 등록.

## Tests

- `task1.test.ts` — 6개: verifyKakaoToken throw, signTokens round-trip, wrong secret null, wrong typ null, 닉네임코드 중복 throw, excludeUserId pass
- `auth.test.ts` — 5개: 카카오 유효 토큰 200 + D-05 redis.set, 카카오 무효 토큰 401, body malformed 400, refresh 유효 200, refresh 무효 401

**총 15개 테스트 PASS, 0 FAIL**

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: JWT + JWKS + User 서비스 | `0a925f0` | env.ts, jwt.ts, kakao.ts, apple.ts, user.service.ts, task1.test.ts |
| Task 2: /auth/* 라우트 + main.ts + 테스트 | `8f358ef` | routes/auth.ts, main.ts, auth.test.ts |

## Deviations from Plan

### 병렬 에이전트 협업

**발견 시점:** Task 1 구현 중
**상황:** 병렬 실행 환경에서 다른 에이전트가 동시에 auth/jwt.ts, auth/kakao.ts, auth/apple.ts, routes/auth.ts, main.ts를 생성함. env.ts의 신규 필드도 추가됨.
**처리:** 중복 생성 없이 누락된 파일(services/user.service.ts, __tests__/task1.test.ts)만 신규 작성. 이미 생성된 파일은 내용 검증 후 그대로 활용. 테스트 mock 패턴은 vitest hoisting 방식에 맞게 수정(vi.resetModules + 재import 대신 파일 상단 vi.mock + vi.mocked 사용).

### Auto-fix: Task 1 테스트 mock 패턴 수정

**Rule 2 (누락 기능):** 초기 task1.test.ts의 ensureUniqueNicknameCode 테스트에서 vi.resetModules() + beforeEach 내 vi.mock 조합이 vitest hoisting과 충돌하여 mock이 적용되지 않음.
**Fix:** vi.mock을 파일 상단으로 이동(hoisting 방식), beforeEach 내 mock 재정의 제거, vi.mocked(prisma.user.findFirst).mockResolvedValue() 패턴으로 교체.
**결과:** 6개 테스트 모두 PASS.

## Known Stubs

없음. 모든 구현이 실제 동작하며 스텁 없음.

## Self-Check: PASSED

모든 파일 존재 확인: jwt.ts, kakao.ts, apple.ts, user.service.ts, auth.ts, task1.test.ts
커밋 존재 확인: 0a925f0 (Task 1), 8f358ef (Task 2)
