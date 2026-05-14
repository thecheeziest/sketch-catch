---
phase: 01-foundation
plan: 02
subsystem: infra
tags: [typescript, zod, socket.io, shared, types, schemas, events, constants]

requires:
  - phase: 01-foundation/01-01
    provides: "pnpm workspace, @sketch-catch/shared 빈 스캐폴딩, tsconfig.base.json, zod 의존성"

provides:
  - "Stroke, Point, StrokeEvent 타입 (DEVELOPER.md §8.1)"
  - "Player, RoomState, RoomConfig, RoomStatus, Category 타입"
  - "RoundStart, RoundEnd, GameResult, ChatMessage, Mode2Step, Mode2Review 타입"
  - "UserPublic, UserPrivate, Provider, Friend, FriendStatus 타입"
  - "ClientEvents, ServerEvents Socket.io 타입 (DEVELOPER.md §6.2)"
  - "CLIENT_EVENT, SERVER_EVENT 상수 + SOCKET_NAMESPACE"
  - "nicknameSchema, friendCodeSchema, onboardingSchema (Zod)"
  - "kakaoLoginSchema, appleLoginSchema, refreshSchema (Zod)"
  - "roomCodeSchema, chatMessageSchema, createRoomSchema (Zod)"
  - "STROKE_FLUSH_INTERVAL_MS, CHAT_MAX_LENGTH 등 매직 넘버 상수"
  - "dist/index.d.ts: types/events/schemas/constants 전체 re-export"

affects:
  - 01-03 (apps/server 설정 — ClientEvents, ServerEvents import)
  - 01-04 (apps/mobile 설정 — ClientEvents, nicknameSchema import)
  - Phase 2 (인증 — kakaoLoginSchema, appleLoginSchema 사용)
  - Phase 4 (방/로비 — roomCodeSchema, RoomState, Player 사용)
  - Phase 5 (게임 — Stroke, StrokeEvent, ChatMessage, CLIENT_EVENT 사용)

tech-stack:
  added: []
  patterns:
    - "ESM re-export barrel 패턴: types/events/schemas/constants 각 서브디렉터리에 index.ts barrel"
    - "as const satisfies Record<string, keyof T>: 이벤트 상수에 타입 안전 강제"
    - "Zod transform: friendCodeInputSchema에서 소문자 입력을 대문자로 정규화"

key-files:
  created:
    - packages/shared/src/types/stroke.ts
    - packages/shared/src/types/user.ts
    - packages/shared/src/types/room.ts
    - packages/shared/src/types/game.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/events/socket-events.ts
    - packages/shared/src/events/index.ts
    - packages/shared/src/schemas/auth.ts
    - packages/shared/src/schemas/user.ts
    - packages/shared/src/schemas/room.ts
    - packages/shared/src/schemas/index.ts
    - packages/shared/src/constants/game.ts
    - packages/shared/src/constants/index.ts
  modified:
    - packages/shared/src/index.ts

key-decisions:
  - "game.ts에서 UserPublic import 제거: 실제로 사용하지 않는 import는 unused 오류 유발 가능 — 플랜 명세에 있었으나 strict 모드 준수를 위해 제거"
  - "dist/index.d.ts는 re-export 체인 방식: tsc ESM 빌드는 각 파일별 .d.ts 생성 후 re-export로 연결 — bundler가 최종 해석"

patterns-established:
  - "shared 패키지 서브디렉터리 구조: src/types/, src/events/, src/schemas/, src/constants/ 각각 barrel index.ts 보유"
  - "이벤트 상수: as const satisfies Record<string, keyof ClientEvents/ServerEvents>로 키 오타 방지"
  - "Zod 스키마: 검증 에러 메시지를 한국어로 작성"

requirements-completed: []

duration: 2min
completed: 2026-05-14
---

# Phase 01 Plan 02: 공유 패키지 타입/이벤트/스키마/상수 Summary

**Stroke/Room/Game 도메인 타입 + Socket.io ClientEvents/ServerEvents + Zod 검증 스키마 + 매직 넘버 상수를 @sketch-catch/shared에 구현 — typecheck + build 통과, apps/server·mobile이 단일 import로 공유 가능**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-14T00:25:26Z
- **Completed:** 2026-05-14T00:27:30Z
- **Tasks:** 2
- **Files created/modified:** 14

## Accomplishments

- `packages/shared/src/types/` 4개 파일 생성 — Point/Stroke, User, Room, Game 도메인 타입 전체 정의
- `packages/shared/src/events/socket-events.ts` — DEVELOPER.md §6.2 ClientEvents/ServerEvents 정확 매칭, CLIENT_EVENT/SERVER_EVENT 상수 타입 안전 선언
- `packages/shared/src/schemas/` 3개 파일 — 닉네임(2~10자), 친구코드(5자리), 방코드(6자리), 채팅(30자) Zod 스키마
- `packages/shared/src/constants/game.ts` — STROKE_FLUSH_INTERVAL_MS=50, CHAT_MAX_LENGTH=30 등 매직 넘버 단일 출처화
- `pnpm --filter @sketch-catch/shared typecheck && build` 모두 에러 없이 통과

## Task Commits

1. **Task 1: 게임 도메인 타입 정의** - `8a9ccd1` (feat)
2. **Task 2: Socket.io 이벤트/Zod 스키마/상수 + 루트 barrel** - `76f0f7b` (feat)

**Plan metadata:** (이후 final commit)

## Files Created/Modified

- `packages/shared/src/types/stroke.ts` - Point, Stroke, StrokeEvent 타입
- `packages/shared/src/types/user.ts` - Provider, UserPublic, UserPrivate, Friend, FriendStatus
- `packages/shared/src/types/room.ts` - GameMode, Category, RoomStatus, Player, RoomConfig, RoomState
- `packages/shared/src/types/game.ts` - RoundStart, RoundEnd, GameResult, ChatMessage, Mode2Step, Mode2Review
- `packages/shared/src/types/index.ts` - 4개 타입 파일 barrel
- `packages/shared/src/events/socket-events.ts` - ClientEvents, ServerEvents, CLIENT_EVENT, SERVER_EVENT, SOCKET_NAMESPACE
- `packages/shared/src/events/index.ts` - events barrel
- `packages/shared/src/schemas/auth.ts` - kakaoLoginSchema, appleLoginSchema, refreshSchema
- `packages/shared/src/schemas/user.ts` - nicknameSchema, friendCodeSchema, onboardingSchema
- `packages/shared/src/schemas/room.ts` - roomCodeSchema, chatMessageSchema, createRoomSchema
- `packages/shared/src/schemas/index.ts` - schemas barrel
- `packages/shared/src/constants/game.ts` - 게임 관련 매직 넘버 상수 전체
- `packages/shared/src/constants/index.ts` - constants barrel
- `packages/shared/src/index.ts` - 루트 barrel (types/events/schemas/constants re-export)

## Decisions Made

- **game.ts에서 UserPublic import 제거**: 플랜 명세에는 `import type { UserPublic }` 포함되어 있었으나, game.ts 내 타입들이 UserPublic을 실제로 사용하지 않음. strict 모드에서 unused import 오류 가능성이 있어 제거.
- **dist/index.d.ts re-export 방식 확인**: tsc ESM 빌드는 `export *`를 그대로 유지하고 각 파일별 .d.ts를 생성. `dist/index.d.ts`에 ClientEvents가 직접 포함되지 않고 re-export 체인으로 연결되는 것이 정상. bundler가 최종 해석.

## Deviations from Plan

None - 플랜에 명시된 구조를 그대로 구현. game.ts의 UserPublic import 제거는 코드 정확성을 위한 자연스러운 조정.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- `apps/server`와 `apps/mobile`이 `import { Stroke, ClientEvents, nicknameSchema, STROKE_FLUSH_INTERVAL_MS } from '@sketch-catch/shared'`로 동일 타입/검증/상수 공유 가능
- 후속 플랜 01-03(apps/server), 01-04(apps/mobile) 설정 시 @sketch-catch/shared workspace:* 참조 즉시 사용 가능

## Self-Check: PASSED

- 14개 파일 모두 존재 확인
- 커밋 `8a9ccd1` (Task 1), `76f0f7b` (Task 2) 모두 존재 확인
- `pnpm --filter @sketch-catch/shared typecheck` 에러 없음
- `pnpm --filter @sketch-catch/shared build` 에러 없음
- `dist/events/socket-events.d.ts`에 ClientEvents 포함 확인
- `dist/schemas/user.d.ts`에 nicknameSchema 포함 확인

---
*Phase: 01-foundation*
*Completed: 2026-05-14*
