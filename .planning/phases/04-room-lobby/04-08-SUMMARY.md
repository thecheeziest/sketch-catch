---
phase: 04-room-lobby
plan: "08"
subsystem: ui
tags: [react-native, socket.io, zustand, expo-router, flatlist]

# Dependency graph
requires:
  - phase: 04-room-lobby-05
    provides: useRoomStore (connect/disconnect/socket/roomState)
  - phase: 04-room-lobby-06
    provides: app/room/_layout.tsx (Stack, headerShown:false)
provides:
  - SlotCard 컴포넌트 (빈/대기/준비/본인/방장 상태별 렌더링)
  - LobbyScreen (app/room/[code]/index.tsx) — 소켓 연결+join, 슬롯 그리드, 준비/시작 버튼, 코드 복사, 방장 승계 Toast
affects:
  - Phase 05 인게임 — LobbyScreen에서 게임 시작 시 화면 전환 진입점

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useLocalSearchParams로 Expo Router 동적 세그먼트([code]) 읽기 (Pitfall 3 회피)"
    - "SafeAreaView는 react-native-safe-area-context에서 import (edges prop 지원)"
    - "allReady 서버 권위 — 클라이언트 단독 계산 금지, roomState.allReady만 참조"
    - "방장 승계 감지: wasHostRef + useEffect(roomState.hostId) 패턴"

key-files:
  created:
    - apps/mobile/src/features/room/ui/SlotCard/index.tsx
    - apps/mobile/app/room/[code]/index.tsx
  modified: []

key-decisions:
  - "SafeAreaView를 react-native-safe-area-context에서 import — edges prop은 standard RN SafeAreaView에 없음"
  - "wasHostRef로 방장 승계 첫 감지 시에만 Toast 표시 — 리렌더마다 중복 Toast 방지"
  - "SlotCard borderStyle dashed 유지 — 빈 슬롯 UI-SPEC 준수, 일부 RN 환경 solid fallback은 런타임 결정"

patterns-established:
  - "슬롯 그리드: getNumColumns(maxPlayers) → FlatList numColumns, key prop으로 numColumns 변경 시 재생성"
  - "캐릭터 placeholder: accentSecondary 단색 블록 (Phase 2-3 패턴 계속)"

requirements-completed: [LBBY-01, LBBY-02, LBBY-03]

# Metrics
duration: 6min
completed: "2026-05-19"
---

# Phase 04 Plan 08: LobbyScreen + SlotCard Summary

**소켓 연결+room:join, 슬롯 그리드(getNumColumns), 서버 allReady 권위 기반 준비/시작, 코드 복사, 방장 승계 Toast를 갖춘 대기실 화면 구현**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-18T23:54:00Z
- **Completed:** 2026-05-18T23:59:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- SlotCard 컴포넌트 — `player: Player | null`과 `isMe: boolean`으로 빈/대기/준비완료/본인/방장 5가지 상태를 UI-SPEC 색상(#FAFAF0/#EDE8D8/#C8A84B/3px border/ribbon icon)에 맞게 렌더
- LobbyScreen — `useLocalSearchParams`로 code 읽기, connect/disconnect 라이프사이클, `room:join` emit, `FlatList numColumns` 슬롯 그리드, 방장/일반 분기 액션 버튼
- 서버 권위 `allReady` 필드만 참조해 게임 시작 버튼 활성화 — 클라이언트 단독 계산 없음

## Task Commits

1. **Task 1: SlotCard 컴포넌트** - `c95011b` (feat)
2. **Task 2: LobbyScreen** - `f46f874` (feat)

## Files Created/Modified

- `apps/mobile/src/features/room/ui/SlotCard/index.tsx` - 슬롯 1개 UI (빈/대기/준비/본인/방장 상태별 색상 + 캐릭터 placeholder + 닉네임 + 준비 상태 텍스트)
- `apps/mobile/app/room/[code]/index.tsx` - 대기실 화면 (소켓 라이프사이클 + 슬롯 그리드 + 준비/시작 버튼 + 코드 복사 + 방장 승계 Toast)

## Decisions Made

- `SafeAreaView`를 `react-native-safe-area-context`에서 import: standard RN `SafeAreaView`는 `edges` prop 미지원, typecheck 에러 수정
- `wasHostRef` 패턴으로 방장 승계 Toast 중복 방지: 첫 감지 시에만 Toast 표시, 이후 리렌더에서는 ref 갱신만
- `Ionicons name="ribbon"` 사용: `crown` 아이콘 미존재, UI-SPEC 대체 지침(`star`/`ribbon`) 따름

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SafeAreaView import 수정 — edges prop 타입 에러**
- **Found during:** Task 2 (LobbyScreen typecheck)
- **Issue:** `react-native`의 `SafeAreaView`는 `edges` prop을 지원하지 않아 TypeScript 에러 발생
- **Fix:** `react-native-safe-area-context`에서 `SafeAreaView` import로 변경
- **Files modified:** apps/mobile/app/room/[code]/index.tsx
- **Verification:** 해당 파일에서 typecheck 에러 0건
- **Committed in:** f46f874 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** edges prop 타입 수정만, 기능 및 UI 동작 변경 없음.

## Issues Encountered

- 기존 `styled-components/native` 마이그레이션 관련 pre-existing typecheck 에러 다수 존재 (MEMORY.md 확인됨). 이번 플랜 작업 파일에서는 에러 0건.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LobbyScreen + SlotCard 완성. LBBY-01/02/03 요구사항 충족.
- Phase 04 room-lobby 전체 완료 조건 달성.
- Phase 05 인게임 — `room:start` 수신 후 게임 화면 전환 구현 시 LobbyScreen의 `ROOM_START` emit이 진입점.

---
*Phase: 04-room-lobby*
*Completed: 2026-05-19*
