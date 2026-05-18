---
phase: 04-room-lobby
plan: 05
subsystem: mobile-client
tags: [socket.io, zustand, tanstack-query, room, matchmaking]
dependency_graph:
  requires: [04-02, 04-03, 04-04]
  provides: [useRoomStore, useCreateRoom, useJoinRoom, useStartMatch, useCancelMatch]
  affects: [04-06, 04-07, 04-08]
tech_stack:
  added: [socket.io-client@4.8.3 (already installed)]
  patterns: [Zustand+immer store with socket instance, TanStack Query v5 useMutation]
key_files:
  created:
    - apps/mobile/src/shared/model/room.ts
    - apps/mobile/src/features/room/api/useCreateRoom.ts
    - apps/mobile/src/features/room/api/useJoinRoom.ts
    - apps/mobile/src/features/room/api/useStartMatch.ts
    - apps/mobile/src/features/room/api/useCancelMatch.ts
  modified: []
decisions:
  - "이벤트명 리터럴 직접 사용: SERVER_EVENT 상수를 통한 타입 추론이 socket.on 오버로드와 불일치 (04-04 결정 계속)"
  - "useCancelMatch onSettled: 성공/실패 모두 setMatchmaking(false) — 네트워크 오류 시 UI 상태 정합성 보장"
  - "useJoinRoom 에러 처리 호출부 위임: ROOM_NOT_FOUND/ROOM_FULL/ROOM_LOCKED → 화면에서 ApiError.code 분기"
metrics:
  duration: 109s
  completed_date: "2026-05-19"
  tasks_completed: 2
  files_modified: 5
---

# Phase 04 Plan 05: 모바일 소켓 인프라 + 방 REST 훅 Summary

**One-liner:** Zustand + socket.io-client useRoomStore(/game 네임스페이스 websocket 연결)와 방 생성/입장/매칭/취소 TanStack Query mutation 훅 4개 구현 — 다운스트림 화면 플랜(06/07/08)의 클라이언트 데이터 레이어 완성.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useRoomStore (Zustand + socket.io-client) | 22774f7 | apps/mobile/src/shared/model/room.ts |
| 2 | 방 REST 훅 4개 (create/join/startMatch/cancelMatch) | 4dcb130 | apps/mobile/src/features/room/api/*.ts ×4 |

## What Was Built

### Task 1: useRoomStore

`apps/mobile/src/shared/model/room.ts` — auth.ts/toast.ts와 동일한 Zustand+immer 패턴으로 구현.

- `connect()`: `transports: ['websocket']` + `auth: { token }` 으로 `/game` 네임스페이스 연결 (RESEARCH Pitfall 1 준수)
- `room:state` 수신 → setRoomState (서버가 진실의 출처, 클라이언트 단독 계산 금지)
- `room:player:join` 수신 → 중복 방지 가드 포함 players push
- `room:player:leave` 수신 → userId로 filter
- `disconnect()`: socket 해제 + roomState 초기화
- `isMatchmaking` + `matchingSeconds`: 랜덤 매칭 대기 상태 관리

### Task 2: REST 훅 4개

모두 TanStack Query v5 `useMutation`, FSD `features/room/api/` 레이어 (shared import만, 역방향 금지).

- **useCreateRoom**: `POST /rooms` → `onSuccess({ code })` 대기실 라우팅
- **useJoinRoom**: `GET /rooms/:code` → `onSuccess(_, code)` 대기실 라우팅, 에러는 호출부 위임
- **useStartMatch**: `POST /match` → 즉시 매칭(matched+code) 시 라우팅 / 대기 시 setMatchmaking(true)
- **useCancelMatch**: `DELETE /match` → `onSettled` setMatchmaking(false) (성공/실패 모두)

## Deviations from Plan

None — plan executed exactly as written.

## Requirements Satisfied

- ROOM-01: 방 생성 클라이언트 훅 (useCreateRoom) ✓
- ROOM-02: 방 코드 입장 클라이언트 훅 (useJoinRoom) ✓
- ROOM-03: 랜덤 매칭 큐 진입 클라이언트 훅 (useStartMatch) ✓
- ROOM-04: 매칭 취소 클라이언트 훅 (useCancelMatch) ✓
- LBBY-01: 실시간 방 상태 동기화 기반 (useRoomStore room:state/player:join/leave) ✓

## Known Stubs

None — 모든 훅은 실제 API 엔드포인트를 호출하며 스텁 없음.

## Self-Check: PASSED

- [x] apps/mobile/src/shared/model/room.ts — FOUND
- [x] apps/mobile/src/features/room/api/useCreateRoom.ts — FOUND
- [x] apps/mobile/src/features/room/api/useJoinRoom.ts — FOUND
- [x] apps/mobile/src/features/room/api/useStartMatch.ts — FOUND
- [x] apps/mobile/src/features/room/api/useCancelMatch.ts — FOUND
- [x] commit 22774f7 — FOUND
- [x] commit 4dcb130 — FOUND
