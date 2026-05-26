---
phase: 05-game-mode-1
plan: "04"
subsystem: server-socket
tags: [stroke, auth, broadcast, security, tdd]
dependency_graph:
  requires: [05-01, 05-03]
  provides: [stroke-handlers, stroke-namespace-registration]
  affects: [05-06-mobile-canvas]
tech_stack:
  added: []
  patterns: [assertDrawer-helper, except-sender-broadcast, server-authorId-override]
key_files:
  created:
    - apps/server/src/socket/handlers/stroke.ts
  modified:
    - apps/server/src/__tests__/game.test.ts
    - apps/server/src/socket/game.namespace.ts
decisions:
  - "assertDrawer 헬퍼: MODE1_ROUND_START + drawerId 일치 조건을 단일 함수로 캡슐화 — 5개 핸들러 중복 제거"
  - "authorId 서버 강제 설정: 클라이언트 페이로드 authorId는 완전 무시, socket.data.userId로 덮어씀 (보안 원칙)"
  - "__undo__/__clear__ 마커: strokeId 마커 방식으로 undo/clear 신호 전달 — 클라이언트가 마커 값으로 동작 분기"
metrics:
  duration: "123s"
  completed_date: "2026-05-27"
  tasks_completed: 2
  files_changed: 3
requirements: [DRAW-03]
---

# Phase 05 Plan 04: stroke 핸들러 5종 구현 (DRAW-03) Summary

서버 stroke 권한 검증 + except-sender broadcast — `assertDrawer` 헬퍼로 출제자 여부를 검증하고, 비출제자 이벤트는 조용히 거부, 출제자 stroke는 `socket.to(roomName).emit(stroke:remote)` 로 발신자 제외 전체 broadcast.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (TDD RED) | stroke auth 실패 테스트 | e733c89 | game.test.ts |
| 1 (TDD GREEN) | stroke.ts 5개 핸들러 구현 | 622d9b0 | stroke.ts, game.test.ts |
| 2 | namespace stroke 이벤트 5종 등록 | ee5c136 | game.namespace.ts |

## What Was Built

`apps/server/src/socket/handlers/stroke.ts` — 5개 핸들러:

- `handleStrokeStart`: color/width 포함 stroke 시작 broadcast
- `handleStrokeAppend`: points 배열 broadcast
- `handleStrokeEnd`: ended:true 마커 broadcast
- `handleStrokeUndo`: strokeId='\_\_undo\_\_' 마커로 마지막 stroke 제거 신호
- `handleStrokeClear`: strokeId='\_\_clear\_\_' 마커로 캔버스 초기화 신호

모든 핸들러는 `assertDrawer` 헬퍼를 통해 `MODE1_ROUND_START` 상태이고 `current.drawerId === socket.data.userId` 인 경우만 통과. `authorId`는 항상 `socket.data.userId`로 서버가 직접 설정 (클라이언트 입력 무시).

## Deviations from Plan

None — 플랜 그대로 실행됨.

## Known Stubs

None.

## Self-Check: PASSED

- `apps/server/src/socket/handlers/stroke.ts` — FOUND
- `apps/server/src/__tests__/game.test.ts` — FOUND (stroke auth 3 tests)
- `apps/server/src/socket/game.namespace.ts` — FOUND (stroke:start/append/end/undo/clear registered)
- commit e733c89 — FOUND
- commit 622d9b0 — FOUND
- commit ee5c136 — FOUND
