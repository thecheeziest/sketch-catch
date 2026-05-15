---
phase: 02-auth-profile
plan: 01
subsystem: data-model
tags: [prisma, schema, migration, shared, zod, characters]
dependency_graph:
  requires: []
  provides:
    - "@@unique([nickname, friendCode]) Prisma 복합 제약"
    - "auth_nickname_code_unique 마이그레이션 SQL"
    - "CHARACTER_IDS 20종 상수 + isValidCharacterId"
    - "authSuccessResponseSchema / RefreshResponse / UpdateMeInput Zod 스키마"
  affects:
    - apps/server/prisma/schema.prisma
    - packages/shared/src/constants/
    - packages/shared/src/schemas/
tech_stack:
  added: []
  patterns:
    - "Prisma 복합 @@unique 제약 (D-01)"
    - "z.enum(CHARACTER_IDS) 방식의 enum 검증"
    - "Zod refine으로 최소 1개 이상 필드 선택 강제"
key_files:
  created:
    - packages/shared/src/constants/characters.ts
    - apps/server/prisma/migrations/20260515095645_auth_nickname_code_unique/migration.sql
  modified:
    - apps/server/prisma/schema.prisma
    - packages/shared/src/constants/index.ts
    - packages/shared/src/schemas/auth.ts
    - packages/shared/src/schemas/user.ts
decisions:
  - "D-01 구현: nickname/friendCode 개별 @unique 제거, @@unique([nickname, friendCode]) 복합 제약으로 교체 — 동일 닉네임 다른 코드 허용"
  - "characterIdSchema를 z.string().min(1).max(40) → z.enum(CHARACTER_IDS)로 교체 — Phase 2에서 ID 풀 확정"
  - "로컬 DB 없음 환경 → prisma migrate dev --create-only 대신 수동 SQL 생성 (fallback 적용)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-15T00:58:42Z"
  tasks: 2
  files_modified: 6
---

# Phase 02 Plan 01: 데이터 모델 기반 + Shared 스키마 Summary

Prisma User 모델에 `@@unique([nickname, friendCode])` 복합 제약을 적용하고 마이그레이션 SQL을 생성했으며, packages/shared에 캐릭터 20종 상수와 AuthSuccessResponse/RefreshResponse/UpdateMeInput Zod 스키마를 추가했다.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Prisma 스키마 D-01 정책 반영 + 마이그레이션 생성 | 6257f58 | schema.prisma, migration.sql |
| 2 | packages/shared 캐릭터 ID 상수 + 인증/프로필 응답 스키마 추가 | a2f3d1d | characters.ts, index.ts, auth.ts, user.ts |

## Decisions Made

1. **D-01 구현 완료:** `nickname @unique` + `friendCode @unique` → `@@unique([nickname, friendCode])`. 동일 닉네임이라도 친구코드가 다르면 가입 허용. 마이그레이션 SQL에 DROP INDEX × 2 + CREATE INDEX × 1 포함.

2. **characterIdSchema 강화:** 기존 `z.string().min(1).max(40)` 에서 `z.enum(CHARACTER_IDS)` 로 교체. Phase 2에서 ID 풀이 확정되었으므로 실제 존재하는 캐릭터 ID만 허용.

3. **updateMeSchema refine 전략:** `.refine()` 으로 "최소 1개 이상 필드 필수" 제약 추가. 빈 PATCH 요청을 Zod 레벨에서 차단.

## Deviations from Plan

**1. [Rule 3 - Fallback] 수동 마이그레이션 SQL 생성**
- **Found during:** Task 1
- **Issue:** 로컬 DB 없음 — `prisma migrate dev` 명령 실행 불가
- **Fix:** 계획의 Step 4 fallback 지시에 따라 타임스탬프 디렉토리 수동 생성 + SQL 직접 작성
- **Files modified:** `apps/server/prisma/migrations/20260515095645_auth_nickname_code_unique/migration.sql`
- **Commit:** 6257f58

그 외 — 계획 그대로 실행.

## Known Stubs

None.

## Self-Check: PASSED

- `apps/server/prisma/schema.prisma`: `@@unique([nickname, friendCode])` 포함 확인
- `apps/server/prisma/migrations/20260515095645_auth_nickname_code_unique/migration.sql`: 존재 확인
- `packages/shared/src/constants/characters.ts`: 20개 ID 포함 확인
- Commits 6257f58, a2f3d1d: 존재 확인
- `pnpm --filter @sketch-catch/shared typecheck`: exit 0
- `pnpm --filter @sketch-catch/server typecheck`: exit 0
