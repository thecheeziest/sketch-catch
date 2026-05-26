---
phase: 05-game-mode-1
plan: "06"
subsystem: mobile-game-canvas
tags: [skia, canvas, drawing, zustand, gesture, game-screen]
dependency_graph:
  requires: [05-01, 05-04]
  provides: [useGameStore, useStrokeSender, DrawingCanvas, ColorPicker, ToolbarRow, PlayerGrid, PlayerCell, GameHeader, GameScreen]
  affects: [05-07]
tech_stack:
  added: ["@shopify/react-native-skia", "react-native-gesture-handler (GestureDetector+Gesture.Pan)"]
  patterns: ["Zustand+immer 게임 스토어", "50ms setInterval flush batch", "strokeId별 SkPath Map 누적 (Pitfall 4 회피)", "GestureDetector wrap 패턴 (Skia 1.5.3 useTouchHandler 미지원)"]
key_files:
  created:
    - apps/mobile/src/features/game/model/useGameStore.ts
    - apps/mobile/src/features/game/api/useStrokeSender.ts
    - apps/mobile/src/features/game/ui/DrawingCanvas/index.tsx
    - apps/mobile/src/features/game/ui/ColorPicker/index.tsx
    - apps/mobile/src/features/game/ui/ToolbarRow/index.tsx
    - apps/mobile/src/features/game/ui/PlayerCell/index.tsx
    - apps/mobile/src/features/game/ui/PlayerGrid/index.tsx
    - apps/mobile/src/features/game/ui/GameHeader/index.tsx
    - apps/mobile/src/features/game/ui/index.ts
    - apps/mobile/app/room/[code]/game.tsx
  modified:
    - apps/mobile/app/room/[code]/index.tsx
decisions:
  - "Skia 1.5.3 useTouchHandler 미지원 → GestureDetector(react-native-gesture-handler) + Gesture.Pan() 패턴 사용"
  - "uuid 대신 Date.now().toString(36)+random 기반 strokeId 생성 — react-native-get-random-values 미설치 환경 대응"
  - "remotePathCache Map으로 strokeId별 SkPath 누적 — 매 렌더 재생성 방지 (RESEARCH Pitfall 4)"
  - "ToolbarRow는 useGameStore/useStrokeSender 직접 구독 — prop drilling 없이 독립 동작"
  - "DrawingCanvas의 clearLocalStrokes는 내부 상태만 관리 — store.clearRemote()로 관전자 캐시 연동"
metrics:
  duration: "~15min"
  completed: "2026-05-27"
  tasks: 3
  files: 11
---

# Phase 05 Plan 06: Skia 캔버스 + GameScreen 조립 Summary

**One-liner:** Zustand 게임 스토어 + 50ms throttle stroke 전송 + Skia GestureDetector 캔버스 + 출제자/관전자 분기 GameScreen

## What Was Built

### Task 1: useGameStore + useStrokeSender
- `useGameStore`: Zustand+immer 게임 전용 스토어. round/remoteStrokes/chatMessages/correct/result 상태 + 도구 상태(color/width/eraser)
- `registerGameListeners()`: useRoomStore.socket에 game:round:start|end, game:end, stroke:remote, chat:message, chat:correct 이벤트 리터럴 직접 등록
- `applyRemoteStroke()`: `__clear__`(전체 초기화), `__undo__`(마지막 pop), 일반(strokeId별 points concat) 처리
- `useStrokeSender()`: 50ms FLUSH_INTERVAL setInterval로 points batch flush, stroke:start/append/end/undo/clear emit, isDrawer=false 시 전부 no-op

### Task 2: DrawingCanvas + ColorPicker + ToolbarRow
- `DrawingCanvas`: Skia Canvas + GestureDetector(Gesture.Pan) 조합. 출제자 — onBegin/onUpdate/onEnd로 로컬 SkPath 실시간 렌더 + sender로 전송. 관전자 — remoteStroke를 strokeId별 Map에 SkPath 누적하여 렌더 (매 프레임 재생성 금지)
- `ColorPicker`: 6색 팔레트 도트(32px). 선택 색상에 PRIMARY_400 PixelFrame 링 표시. accessibilityLabel="색상 선택: {이름}"
- `ToolbarRow`: 56px 고정 높이. ColorPicker + 굵기 3단계 도트(8/14/22px) + 지우개 토글 + 전체지우기 + 되돌리기. 출제자 전용

### Task 3: PlayerGrid + PlayerCell + GameHeader + GameScreen + 대기실 전환
- `PlayerCell`: PixelFrame(출제자=PRIMARY_400, 기타=DARK_100) + 캐릭터 이미지 + 닉네임. ME! 좌상단 칩(LIGHT_100), 출제자 우상단 칩(PRIMARY_400)
- `PlayerGrid`: 2행×6열 고정. 첫 칸=본인, 나머지=입장순. null spacer로 빈 슬롯 유지
- `GameHeader`: 48px. BACK 아이콘 + "라운드 N/M" + 타이머 플레이스홀더(Plan 07)
- `game.tsx(GameScreen)`: SafeAreaView → GameHeader → PlayerGrid → DrawingCanvas(flex:1) → (출제자) ToolbarRow. registerGameListeners 1회, AWARD 상태 감지
- `index.tsx(LobbyScreen)`: `roomState?.status === 'MODE1_ROUND_START'` useEffect → `router.replace('/room/{code}/game')` 추가

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Skia 1.5.3 useTouchHandler 미존재**
- **Found during:** Task 2
- **Issue:** 플랜에서 언급된 `useTouchHandler` API가 @shopify/react-native-skia 1.5.3에 없음 (타입 정의 확인). 최신 버전 API로 기존 문서 참조 오류
- **Fix:** `react-native-gesture-handler`의 `GestureDetector` + `Gesture.Pan()`을 Canvas 외부에 wrap하는 패턴으로 대체
- **Files modified:** apps/mobile/src/features/game/ui/DrawingCanvas/index.tsx

**2. [Rule 3 - Blocking] uuid/react-native-get-random-values 미설치**
- **Found during:** Task 2
- **Issue:** `uuid` v4는 `react-native-get-random-values` polyfill 필요. 해당 패키지 미설치
- **Fix:** `Date.now().toString(36) + Math.random().toString(36)` 기반 간단한 strokeId 생성 함수로 대체 (서버가 authorId 덮어쓰므로 충돌 무관)
- **Files modified:** apps/mobile/src/features/game/ui/DrawingCanvas/index.tsx

## Known Stubs

- `GameHeader` 타이머 슬롯: 빈 `View`로 placeholder 처리 — Plan 07에서 `useGameTimer` 연결 예정
- `GameScreen` WordBanner: 주석 placeholder — Plan 07에서 컴포넌트 추가 예정
- `GameScreen` ChatRow: 주석 placeholder — Plan 07에서 컴포넌트 추가 예정

위 stub들은 Plan 06 목표(캔버스+그리드+도구+화면전환)를 달성하는데 지장 없음. Plan 07 스코프에 명시적으로 분리.

## Self-Check: PASSED

파일 존재 확인:
- apps/mobile/src/features/game/model/useGameStore.ts — FOUND
- apps/mobile/src/features/game/api/useStrokeSender.ts — FOUND
- apps/mobile/src/features/game/ui/DrawingCanvas/index.tsx — FOUND
- apps/mobile/src/features/game/ui/ColorPicker/index.tsx — FOUND
- apps/mobile/src/features/game/ui/ToolbarRow/index.tsx — FOUND
- apps/mobile/src/features/game/ui/PlayerCell/index.tsx — FOUND
- apps/mobile/src/features/game/ui/PlayerGrid/index.tsx — FOUND
- apps/mobile/src/features/game/ui/GameHeader/index.tsx — FOUND
- apps/mobile/app/room/[code]/game.tsx — FOUND

커밋 확인:
- fdc25fa: feat(05-06): useGameStore + useStrokeSender
- c8b2a91: feat(05-06): DrawingCanvas + ColorPicker + ToolbarRow
- 2575cbc: feat(05-06): PlayerGrid + PlayerCell + GameHeader + GameScreen + 대기실 전환
