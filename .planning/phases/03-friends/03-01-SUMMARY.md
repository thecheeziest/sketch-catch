---
phase: 03-friends
plan: 01
subsystem: api
tags: [fastify, prisma, redis, ioredis, presence, friends]

# Dependency graph
requires:
  - phase: 02-auth-profile
    provides: authenticate 미들웨어, User/FriendRequest/Friendship Prisma 모델, redis 클라이언트
provides:
  - Redis presence 유틸 (setPresence, getPresence, PresenceStatus)
  - authenticate 미들웨어 presence 자동 갱신
  - friends.service.ts — 친구 비즈니스 로직 전체
  - friends.ts — 5개 REST 엔드포인트
  - main.ts friendsRoutes 등록
affects: [03-02-ui, 03-03-hooks, 04-rooms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parseTarget: 닉네임#코드 파싱 — lastIndexOf('#') + 코드 5자리 검증"
    - "normalizeIds: userAId < userBId 정규화로 Friendship @@unique 보장"
    - "커스텀 에러 클래스 code 필드 패턴 (me.service.ts와 동일)"
    - "fire-and-forget void setPresence — 인증 흐름 블록 없이 presence 갱신"

key-files:
  created:
    - apps/server/src/services/friends.service.ts
    - apps/server/src/routes/friends.ts
  modified:
    - apps/server/src/db/redis.ts
    - apps/server/src/middleware/authenticate.ts
    - apps/server/src/main.ts

key-decisions:
  - "z.string().refine(v => v.includes('#')) 사용 — Zod에 .includes() 메서드 없어 refine으로 대체"
  - "sendFriendRequest parseTarget 실패 시 SelfRequestError throw — 라우트 sendRequestSchema에서 '#' 포함 여부로 먼저 필터하므로 서비스 진입 시 파싱 실패는 형식 오류와 동일 처리"
  - "DuplicateRequestError는 Prisma unique 제약 위반 catch로 감지 — @@unique([senderId, receiverId]) 활용"

patterns-established:
  - "presence TTL 300초(5분): 인증 요청마다 갱신, 5분 무활동 시 OFFLINE"
  - "친구 목록 presenceStatus: getPresence 병렬 호출(Promise.all)"

requirements-completed: [FRND-01, FRND-02, FRND-03, FRND-04]

# Metrics
duration: 2min
completed: 2026-05-15
---

# Phase 03 Plan 01: 친구 API 서버 구현 Summary

**REST 기반 친구 요청/수락/거절/삭제 + Redis TTL presence(ONLINE/OFFLINE/IN_GAME) — 5개 엔드포인트 완전 구현**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-15T11:11:46Z
- **Completed:** 2026-05-15T11:13:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Redis presence 유틸(`setPresence`/`getPresence`, TTL 300초) 추가, 모든 인증 요청에서 자동 갱신
- 친구 서비스 전체 구현: `닉네임#코드` 파싱, `normalizeIds`로 Friendship 정규화, 커스텀 에러 클래스 6종
- 5개 REST 엔드포인트 + main.ts 등록, typecheck 완전 통과

## Task Commits

1. **Task 1: Redis presence 유틸 + authenticate 미들웨어 갱신** - `c04ee36` (feat)
2. **Task 2: friends.service.ts + friends.ts route + main.ts 등록** - `19ded19` (feat)

**Plan metadata:** (docs commit 후 기록)

## Files Created/Modified
- `apps/server/src/db/redis.ts` - setPresence, getPresence, PresenceStatus 타입 추가
- `apps/server/src/middleware/authenticate.ts` - void setPresence(payload.sub) fire-and-forget 추가
- `apps/server/src/services/friends.service.ts` - 친구 비즈니스 로직 전체 (신규)
- `apps/server/src/routes/friends.ts` - 5개 엔드포인트 플러그인 (신규)
- `apps/server/src/main.ts` - friendsRoutes 등록

## Decisions Made
- `z.string().refine(v => v.includes('#'))` 사용 — Zod v3에 `.includes()` 체인 메서드 없음
- `parseTarget` 실패 시 `SelfRequestError` throw — 라우트에서 `#` 포함 여부를 먼저 필터하므로 서비스 진입 후 파싱 실패는 사실상 없지만 방어적 처리

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod `z.string().includes('#')` → `z.string().refine()` 대체**
- **Found during:** Task 2 (friends.ts route 작성)
- **Issue:** 플랜 코드에 `z.string().includes('#')` 사용 — Zod에 `.includes()` 체인 메서드가 없어 타입 오류 발생
- **Fix:** `z.string().refine((v) => v.includes('#'), { message: '...' })` 으로 대체
- **Files modified:** apps/server/src/routes/friends.ts
- **Verification:** typecheck exit 0
- **Committed in:** `19ded19` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** 기능 동작 동일, 타입 안전성 유지.

## Issues Encountered
None

## User Setup Required
None - 기존 Redis/PostgreSQL 환경 그대로 사용.

## Next Phase Readiness
- 서버 친구 API 완료 → 03-02(공용 UI) + 03-03(API 훅) 병렬 진행 가능
- Phase 4 소켓 연결 후 `setPresence` 로직을 소켓 heartbeat로 교체 시 `authenticate.ts` 한 줄만 제거

## Self-Check: PASSED

- FOUND: apps/server/src/services/friends.service.ts
- FOUND: apps/server/src/routes/friends.ts
- FOUND: .planning/phases/03-friends/03-01-SUMMARY.md
- FOUND: commit c04ee36
- FOUND: commit 19ded19

---
*Phase: 03-friends*
*Completed: 2026-05-15*
