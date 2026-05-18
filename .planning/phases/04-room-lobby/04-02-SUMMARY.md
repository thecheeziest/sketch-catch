---
phase: 04-room-lobby
plan: 02
subsystem: server/rooms
tags: [rest-api, redis, room-management, fastify]
dependency_graph:
  requires: [04-01]
  provides: [POST /rooms, GET /rooms/:code, rooms.service.ts]
  affects: [04-03, 04-04]
tech_stack:
  added: []
  patterns: [fastify-plugin-async, redis-json-ttl, zod-safeParse, custom-error-class]
key_files:
  created:
    - apps/server/src/services/rooms.service.ts
    - apps/server/src/routes/rooms.ts
  modified:
    - packages/shared/src/types/room.ts
    - apps/server/src/__tests__/rooms.test.ts
    - apps/server/src/main.ts
decisions:
  - "rooms.service.ts는 04-01에서 이미 완전 구현 → 타입 확장(title?/locked?)만 추가"
  - "GET /rooms/:code: assertJoinable catch 후에도 성공 state 반환 (locked 아닌 정상 케이스)"
  - "POST /rooms title 미입력 시 라우트 레이어에서 ${nickname}의 방 기본값 처리"
metrics:
  duration: 2min
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_changed: 5
---

# Phase 04 Plan 02: 방 생성/조회 REST 레이어 Summary

방 생성(POST /rooms)·조회(GET /rooms/:code) REST 엔드포인트를 Fastify 플러그인으로 구현, Redis 기반 RoomState 저장/조회 서비스와 연결.

## What Was Built

- **rooms.service.ts**: createRoom(6자리 코드 + Redis EX 7200), getRoomState(JSON.parse), saveRoomState(KEEPTTL), assertJoinable(RoomFullError/RoomLockedError)
- **rooms.ts 라우트**: POST /rooms (createRoomSchema 검증, 201 반환), GET /rooms/:code (roomCodeSchema 검증, 상태별 404/409/403)
- **shared 타입 확장**: RoomState에 `title?: string; locked?: boolean;` 추가
- **rooms.test.ts**: ROOM-01/ROOM-02 케이스 4개 GREEN (todos → 실제 assertions)

## Verification Results

- rooms.test.ts: 4/4 PASSED
- typecheck: 0 errors
- main.ts: roomsRoutes 등록 확인

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note:** rooms.service.ts는 04-01(Wave 0 스캐폴드) 단계에서 이미 완전 구현되어 있었음. 이 플랜에서는 `packages/shared/src/types/room.ts`에 `title?/locked?` 추가 후 shared 재빌드, 테스트 todos 활성화, 라우트 파일 신규 생성만 수행.

## Known Stubs

None.

## Self-Check: PASSED
