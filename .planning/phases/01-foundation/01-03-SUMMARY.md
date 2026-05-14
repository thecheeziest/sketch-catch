---
phase: 01-foundation
plan: 03
subsystem: server
tags: [fastify, prisma, redis, docker, postgresql, zod, pino, typescript]

requires:
  - phase: 01-foundation/01-01
    provides: "pnpm workspace, tsconfig.base.json, @sketch-catch/shared 스캐폴딩"
  - phase: 01-foundation/01-02
    provides: "SHARED_PACKAGE_VERSION, SOCKET_NAMESPACE, ClientEvents/ServerEvents 타입"

provides:
  - "apps/server 워크스페이스 (@sketch-catch/server)"
  - "Prisma 스키마 5개 모델 (User, FriendRequest, Friendship, GameReplay, WordPool)"
  - "Prisma 스키마 3개 enum (Provider, ReqStatus, Category)"
  - "Fastify 서버 entrypoint (src/main.ts)"
  - "Zod 환경변수 검증 (src/lib/env.ts)"
  - "pino 로거 (src/lib/logger.ts)"
  - "PrismaClient 싱글톤 (src/db/prisma.ts)"
  - "ioredis 연결 (src/db/redis.ts)"
  - "GET /health 라우트 (db/redis 상태 반환)"
  - "Railway 배포용 Dockerfile"
  - "docker-compose.yml (postgres:16-alpine + redis:7-alpine)"
  - "apps/server/.env.example 환경변수 템플릿"

affects:
  - 01-04 (apps/mobile — 서버와 동일 shared package import 패턴 확인)
  - Phase 2 (인증 라우트 — apps/server 토대 위에 구현)
  - Phase 3 (방/로비 Socket.io — apps/server에 socket/ 추가)
  - Phase 4 (게임 로직 — apps/server에 game/ 추가)

tech-stack:
  added:
    - fastify@^4.28.1
    - "@fastify/cors@^9.0.1"
    - "@fastify/rate-limit@^9.1.0"
    - "@prisma/client@^5.20.0"
    - prisma@^5.20.0
    - ioredis@^5.4.1
    - socket.io@^4.7.5
    - zod@^3.23.8 (서버 독립 의존)
    - pino@^9.4.0
    - pino-pretty@^11.2.2
    - dotenv@^16.4.5
    - tsx@^4.19.1
  patterns:
    - "src/lib/env.ts Zod safeParse + process.exit(1) 패턴 — 잘못된 환경변수 즉시 차단"
    - "lazyConnect: true ioredis — 연결 시점 명시적 제어"
    - "Fastify { logger } 옵션에 pino 인스턴스 직접 주입"
    - "Dockerfile multi-stage build (deps → build → runner)"

key-files:
  created:
    - apps/server/package.json
    - apps/server/tsconfig.json
    - apps/server/prisma/schema.prisma
    - apps/server/.env.example
    - apps/server/src/lib/env.ts
    - apps/server/src/lib/logger.ts
    - apps/server/src/db/prisma.ts
    - apps/server/src/db/redis.ts
    - apps/server/src/routes/health.ts
    - apps/server/src/main.ts
    - apps/server/Dockerfile
    - docker-compose.yml
    - .env.example
  modified:
    - pnpm-lock.yaml (server 의존성 추가)

key-decisions:
  - "Fastify { logger } 옵션에 pino 인스턴스 직접 주입: loggerInstance는 Fastify 4.x 타입에 없음 — logger 옵션이 올바른 방식"
  - "docker 미사용 환경에서 prisma migrate dev 생략: 파일 생성 + typecheck + build로 검증. 실제 마이그레이션은 docker 환경에서 prisma migrate dev --name init으로 실행"

requirements-completed: []

duration: 3min
completed: 2026-05-14
---

# Phase 01 Plan 03: apps/server 워크스페이스 + Fastify + Prisma + Redis Summary

**Fastify 서버 토대 구성 — Prisma(5모델/3enum), Redis(ioredis), Zod 환경변수, /health 라우트, docker-compose, Railway Dockerfile — typecheck + build 통과, @sketch-catch/shared workspace:* import 검증 완료**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-14T00:30:50Z
- **Completed:** 2026-05-14T00:33:50Z
- **Tasks:** 2
- **Files created/modified:** 13

## Accomplishments

- `apps/server` 워크스페이스 생성 — `@sketch-catch/shared` workspace:* 의존, pnpm install 성공
- Prisma 스키마: DEVELOPER.md §3 전체 복사 (5개 모델 + 3개 enum, 인덱스/유니크 제약 포함)
- `prisma generate` 성공 — Prisma Client 생성
- Fastify 서버 소스 7개 파일 — env.ts Zod 검증, pino 로거, PrismaClient, ioredis, /health 라우트, main.ts
- `pnpm --filter @sketch-catch/server typecheck` 통과 (에러 0)
- `pnpm --filter @sketch-catch/server build` 통과 — `dist/main.js` 생성
- docker-compose.yml: postgres:16-alpine + redis:7-alpine, healthcheck 포함
- Railway 배포용 Dockerfile multi-stage build (migrate deploy → node dist/main.js)

## Task Commits

1. **Task 1: apps/server 워크스페이스 + Prisma 스키마 + docker-compose** - `cefda35` (chore)
2. **Task 2: Fastify 서버 파일들** - `95bd049` (feat, 병렬 에이전트 01-04 커밋에 포함됨)

## Files Created/Modified

- `apps/server/package.json` - @sketch-catch/server 워크스페이스 (fastify, prisma, ioredis, zod 등)
- `apps/server/tsconfig.json` - tsconfig.base.json extends, packages/shared project reference
- `apps/server/prisma/schema.prisma` - User/FriendRequest/Friendship/GameReplay/WordPool + Provider/ReqStatus/Category
- `apps/server/.env.example` - DATABASE_URL, REDIS_URL, KAKAO_REST_KEY, APPLE_BUNDLE_ID, JWT_SECRET
- `apps/server/src/lib/env.ts` - Zod envSchema, safeParse + process.exit(1)
- `apps/server/src/lib/logger.ts` - pino 로거 (dev: pino-pretty, prod: JSON)
- `apps/server/src/db/prisma.ts` - PrismaClient 싱글톤 + connect/disconnect
- `apps/server/src/db/redis.ts` - ioredis lazyConnect + error logging
- `apps/server/src/routes/health.ts` - GET /health → { status, db, redis, timestamp }
- `apps/server/src/main.ts` - Fastify bootstrap + cors + @sketch-catch/shared import
- `apps/server/Dockerfile` - multi-stage (deps/build/runner), pnpm prisma migrate deploy
- `docker-compose.yml` - postgres:16-alpine + redis:7-alpine + healthcheck
- `.env.example` - 루트 모노레포 공통 안내

## Decisions Made

- **Fastify `{ logger }` 옵션 사용**: 플랜 명세의 `loggerInstance`는 Fastify 4.x 타입 정의에 없는 옵션. `logger` 옵션에 pino 인스턴스를 직접 주입하는 방식이 올바른 Fastify 4.x API. [Rule 1 - Bug]
- **docker 미사용 환경 prisma migrate skip**: 로컬에 docker가 없어 `prisma migrate dev --name init` 실행 불가. 플랜 명세에서 선택 사항으로 명시되어 있어 skip. typecheck + build로 정적 검증 완료.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fastify loggerInstance → logger 옵션 수정**
- **Found during:** Task 2
- **Issue:** 플랜 명세의 `Fastify({ loggerInstance: logger })`가 Fastify 4.x 타입에 존재하지 않음 — typecheck 에러 발생
- **Fix:** `Fastify({ logger })`로 수정 (pino 인스턴스를 logger 옵션에 직접 주입)
- **Files modified:** `apps/server/src/main.ts`
- **Commit:** `95bd049`

## Issues Encountered

- 병렬 에이전트(01-04)가 실행 중 `apps/server/src/` 파일들이 staged 상태에서 01-04 커밋에 포함됨. 결과적으로 Task 2 파일들은 커밋 `95bd049`(01-04 feat 커밋)에 들어있으나 파일 자체는 정상적으로 git에 추적되고 있음.

## User Setup Required

- Railway 프로젝트 생성 후 PostgreSQL + Redis 플러그인 추가
  - `DATABASE_URL`: Railway PostgreSQL 연결 URL
  - `REDIS_URL`: Railway Redis 연결 URL
- 로컬 개발: `docker compose up -d` → `pnpm --filter @sketch-catch/server prisma:migrate` (docker 환경에서)

## Next Phase Readiness

- Phase 2 인증 라우트가 `apps/server/src/routes/`에 추가될 수 있는 상태
- `apps/server/src/db/prisma.ts` PrismaClient로 User 모델 즉시 사용 가능
- `apps/server/src/db/redis.ts` redis 인스턴스로 세션/큐 관리 가능
- docker 환경에서 `pnpm --filter @sketch-catch/server prisma:migrate` 실행 → 5개 테이블 생성 가능

## Self-Check: PASSED

- 13개 파일 모두 존재 확인
- `cefda35` (Task 1), `95bd049` (Task 2 파일 포함) 커밋 존재 확인
- `pnpm --filter @sketch-catch/server typecheck` 에러 없음
- `pnpm --filter @sketch-catch/server build` 에러 없음
- `apps/server/dist/main.js` 존재 확인

---
*Phase: 01-foundation*
*Completed: 2026-05-14*
