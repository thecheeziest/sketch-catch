---
phase: 04-room-lobby
plan: "04"
subsystem: api
tags: [socket.io, fastify-socket.io, jwt, presence, redis, vitest]

requires:
  - phase: 04-room-lobby/04-02
    provides: rooms.service.ts (getRoomState/saveRoomState)
  - phase: 04-room-lobby/04-01
    provides: socket-room.test.ts Wave 0 스캐폴드, setPresence (redis.ts)
provides:
  - "/game 네임스페이스 JWT 미들웨어 (game.namespace.ts)"
  - "handleRoomJoin/Leave/Ready/Start 4개 핸들러 (handlers/room.ts)"
  - "ClientEvents/ServerEvents Socket.io EventsMap 호환 함수 시그니처 (shared)"
affects:
  - "04-room-lobby (Phase 5 인게임 이벤트 핸들러)"
  - "모바일 소켓 클라이언트 통합"

tech-stack:
  added: []
  patterns:
    - "Socket.io EventsMap은 함수 시그니처 형태로 정의 (e.g., 'room:state': (state: RoomState) => void)"
    - "Namespace.use() 미들웨어로 모든 소켓 이벤트 전 JWT 인증 강제"
    - "socket.on('disconnect') 에 handleRoomLeave 등록 (Pitfall 4 회피)"
    - "noUncheckedIndexedAccess 환경에서 배열[0]은 [0]! 단언 + 주석으로 보장 근거 명시"

key-files:
  created:
    - apps/server/src/socket/game.namespace.ts
    - apps/server/src/socket/handlers/room.ts
  modified:
    - apps/server/src/types/fastify.d.ts
    - apps/server/src/main.ts
    - apps/server/src/__tests__/socket-room.test.ts
    - packages/shared/src/events/socket-events.ts

key-decisions:
  - "ClientEvents/ServerEvents를 함수 시그니처 형태로 변환: 객체 타입은 Socket.io EventParams<Map,Ev>=Parameters<Map[Ev]>=never로 귀결되어 emit 타입 전면 오류 발생"
  - "socket.on(CLIENT_EVENT.ROOM_JOIN,...) 대신 직접 리터럴 'room:join' 사용: 상수를 통한 타입 추론이 socket.on 오버로드와 불일치"

patterns-established:
  - "Socket.io EventsMap 정의는 함수 시그니처 형태 필수"

requirements-completed: [LBBY-01, LBBY-02, LBBY-03]

duration: 5min
completed: 2026-05-19
---

# Phase 04 Plan 04: Socket.io /game 네임스페이스 + room 핸들러 Summary

**Socket.io /game 네임스페이스에 JWT 미들웨어 + 4개 room 핸들러(join/leave/ready/start)를 구현해 LBBY-01/02/03 충족, 방장 승계·allReady 서버 계산·presence D-15 완성**

## Performance

- **Duration:** 약 5분
- **Started:** 2026-05-19T08:40:00Z
- **Completed:** 2026-05-19T08:44:28Z
- **Tasks:** 2 (Task 1: 통합/네임스페이스, Task 2: TDD handlers)
- **Files modified:** 6

## Accomplishments

- `/game` 네임스페이스 JWT 미들웨어: `socket.handshake.auth.token` 검증 → `socket.data.userId` 바인딩
- 4개 room 핸들러: join(슬롯 채움), leave(방장 승계), ready(allReady 서버 계산), start(비방장 거부)
- D-15 presence: 대기실 입장 시 `IN_GAME`, 퇴장 시 `ONLINE` 갱신
- socket-room.test.ts 10개 케이스 GREEN (LBBY-01/02/03)

## Task Commits

1. **Task 1: Fastify-Socket.io 통합 + /game 네임스페이스 + JWT 미들웨어** - `c482157` (feat)
2. **Task 2: handlers/room.ts — join/leave/ready/start + 방장 승계 + presence** - `f65297e` (feat)

## Files Created/Modified

- `apps/server/src/socket/game.namespace.ts` — /game 네임스페이스, JWT 미들웨어, 이벤트 바인딩
- `apps/server/src/socket/handlers/room.ts` — 4개 room 핸들러 (LBBY-01/02/03 + D-15)
- `apps/server/src/types/fastify.d.ts` — FastifyInstance.io + FastifyRequest.userId 타입 선언
- `apps/server/src/main.ts` — socketioPlugin 등록, registerGameNamespace 호출
- `apps/server/src/__tests__/socket-room.test.ts` — Wave 0 todo → 10개 실제 테스트 GREEN
- `packages/shared/src/events/socket-events.ts` — ClientEvents/ServerEvents 함수 시그니처 형태로 변환

## Decisions Made

1. **ClientEvents/ServerEvents 함수 시그니처 변환**: 원래 `{ 'room:state': RoomState }` 객체 형태였으나, Socket.io의 `EventParams<Map, Ev> = Parameters<Map[Ev]>`가 함수가 아닌 타입에 `Parameters<>` 적용 시 `never`를 반환해 `emit()` 전체 타입 오류 발생. `{ 'room:state': (state: RoomState) => void }` 함수 형태로 변환해 해결.
2. **`socket.on` 이벤트명 직접 리터럴 사용**: `CLIENT_EVENT.ROOM_JOIN` 상수를 `socket.on()`에 전달 시 TypeScript가 해당 키의 페이로드 타입을 추론하지 못함. 직접 `'room:join'` 리터럴로 변경.
3. **`[0]!` 단언 + 주석**: `noUncheckedIndexedAccess` 설정 하에서 `players.sort()[0]`가 `undefined` 가능으로 인식됨. `players.length === 0` 체크 후 continue로 보장됨을 주석으로 명시하고 `[0]!` 단언 적용.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] shared ClientEvents/ServerEvents 타입을 Socket.io EventsMap 호환 함수 시그니처로 변환**
- **Found during:** Task 1 (typecheck 실행 시)
- **Issue:** `ClientEvents`/`ServerEvents`가 `{ event: DataType }` 객체 형태로 정의되어 `Parameters<Map[Ev]>` = `never`가 되어 `emit()` 전체 타입 오류 발생
- **Fix:** 모든 이벤트를 `(payload: DataType) => void` 함수 시그니처 형태로 변환
- **Files modified:** `packages/shared/src/events/socket-events.ts`
- **Verification:** `pnpm --filter @sketch-catch/server typecheck` 통과
- **Committed in:** `c482157` (Task 1 commit)

**2. [Rule 1 - Bug] socket.on에서 CLIENT_EVENT 상수 대신 리터럴 사용**
- **Found during:** Task 1 (typecheck 실행 시)
- **Issue:** `socket.on(CLIENT_EVENT.ROOM_JOIN, ...)` 호출 시 타입 추론 실패 (`code` 파라미터가 any)
- **Fix:** 직접 `'room:join'` 리터럴 사용, 미사용된 `CLIENT_EVENT` import 제거
- **Files modified:** `apps/server/src/socket/game.namespace.ts`
- **Verification:** `pnpm --filter @sketch-catch/server typecheck` 통과
- **Committed in:** `c482157` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 - Bug, 2건)
**Impact on plan:** 타입 시스템 정확성 확보. 기능 동작에 변화 없음.

## Issues Encountered

- `packages/shared/dist`가 이전 빌드 결과를 유지하고 있어 `allReady` 필드가 없었음 → `pnpm --filter @sketch-catch/shared build` 실행으로 해결

## Known Stubs

없음 — 모든 핸들러가 실제 Redis/Prisma 연동 코드로 구현됨 (테스트에서 mock 처리).

## Next Phase Readiness

- Socket.io 서버 통합 완료 — Phase 5 인게임 이벤트 핸들러 추가 가능
- 모바일 소켓 클라이언트 연결 (useRoomStore, LobbyScreen) 구현 가능
- LBBY-01/02/03 서버 구현 완료, 클라이언트 연동 남음

---
*Phase: 04-room-lobby*
*Completed: 2026-05-19*
