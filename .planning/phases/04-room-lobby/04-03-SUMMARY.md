---
phase: 04-room-lobby
plan: "03"
subsystem: server/match
tags: [redis, zset, matchqueue, rest-api, tdd]
dependency_graph:
  requires: ["04-01"]
  provides: ["match.service.ts (enqueueMatch/dequeueMatch)", "POST /match", "DELETE /match"]
  affects: ["04-02 (rooms.service.ts 선행 구현 포함)"]
tech_stack:
  added: []
  patterns: ["Redis ZSET 매치큐 (ZADD/ZPOPMIN/ZREM)", "Pitfall 7 레이스 컨디션 방어", "Fastify 라우트 플러그인"]
key_files:
  created:
    - apps/server/src/services/match.service.ts
    - apps/server/src/routes/match.ts
    - apps/server/src/services/rooms.service.ts
  modified:
    - apps/server/src/__tests__/match.test.ts
    - apps/server/src/main.ts
decisions:
  - "rooms.service.ts를 04-03에서 선행 구현: wave 2 병렬 실행 중 04-02 산출물 미존재로 match.service가 createRoom을 import할 수 없어 Deviation Rule 3(블로킹 이슈)으로 자동 처리"
  - "matchQueueKey 함수 시그니처: (count) => matchqueue:1:{count} (D-08: 모드 1 고정으로 mode 파라미터 생략)"
  - "tryCreateMatch 반환 타입: { code: string } | null — 라우트에서 matched: true/false 분기"
metrics:
  duration: "160s"
  completed: "2026-05-18T08:38:52Z"
  tasks: 2
  files: 5
---

# Phase 04 Plan 03: 랜덤 매칭 큐 (Redis ZSET) Summary

Redis ZSET 기반 랜덤 매칭 큐 서비스 — enqueueMatch(ZADD + tryCreateMatch), dequeueMatch(3큐 ZREM), Pitfall 7 레이스 컨디션 방어 포함.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | match.service.ts — Redis ZSET 매치큐 (TDD) | 15f7f66 | match.service.ts, match.test.ts, rooms.service.ts |
| 2 | match.ts 라우트 + main.ts 등록 | 3b69a29 | routes/match.ts, main.ts |

## Verification Results

- `match.test.ts` — 4/4 GREEN (ROOM-03/ROOM-04)
- `pnpm --filter @sketch-catch/server typecheck` — 통과
- `main.ts` — `roomsRoutes` + `matchRoutes` 둘 다 등록됨

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] rooms.service.ts 선행 구현**
- **Found during:** Task 1 RED 단계
- **Issue:** match.service.ts가 `createRoom`을 `./rooms.service.js`에서 import하는데, 04-02(wave 2 병렬 실행)의 산출물인 rooms.service.ts가 존재하지 않아 테스트 및 typecheck 블로킹
- **Fix:** 04-03 Task 1에서 rooms.service.ts를 선행 구현 (createRoom/getRoomState/saveRoomState/assertJoinable + RoomFullError/RoomLockedError 에러 클래스)
- **Files modified:** apps/server/src/services/rooms.service.ts (신규 생성)
- **Commit:** 15f7f66

**2. [Rule 3 - Blocking] main.ts roomsRoutes 이미 존재 → matchRoutes만 추가**
- **Found during:** Task 2
- **Issue:** 04-02 에이전트가 이미 main.ts에 roomsRoutes를 추가한 상태였음. 플랜 지시대로 중복 등록 없이 matchRoutes만 추가
- **Fix:** import + app.register(matchRoutes)만 추가 (roomsRoutes 중복 등록 없음)
- **Files modified:** apps/server/src/main.ts
- **Commit:** 3b69a29

## Known Stubs

없음. match.service.ts는 실제 Redis ZSET 동작 + createRoom 호출 완전 구현.

## Self-Check: PASSED

- [x] apps/server/src/services/match.service.ts — 존재 확인
- [x] apps/server/src/routes/match.ts — 존재 확인
- [x] apps/server/src/services/rooms.service.ts — 존재 확인
- [x] 15f7f66 커밋 존재
- [x] 3b69a29 커밋 존재
- [x] match.test.ts 4/4 GREEN
- [x] typecheck 통과
