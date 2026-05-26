---
phase: 05-game-mode-1
plan: "08"
subsystem: mobile/game
tags: [award, podium, expo-av, animation, timer]
dependency_graph:
  requires: ["05-03 (game:end 서버 emit)", "05-07 (game:round:end, useGameStore)"]
  provides: ["AwardScreen", "PodiumSlot"]
  affects: ["app/room/[code]/game.tsx (AWARD 상태 감지 라우팅 이미 구현됨)"]
tech_stack:
  added: []
  patterns: ["expo-av Audio.Sound.createAsync graceful skip", "SlotCard isHost rainbow 재사용", "countdown setInterval 자동 종료"]
key_files:
  created:
    - apps/mobile/src/features/game/ui/PodiumSlot/index.tsx
    - apps/mobile/app/room/[code]/award.tsx
  modified:
    - apps/mobile/src/features/game/ui/index.ts
decisions:
  - "PodiumPlayer → Player 변환 시 friendCode='' + isHost=(rank===1) 패턴: SlotCard rainbow 재사용을 위한 최소 형변환"
  - "useWindowDimensions + baseCardWidth = width/4.5: 시상대 3개가 화면에 맞게 들어오는 비율 선택"
  - "game:end 라우팅은 game.tsx roomState?.status==='AWARD' 조건으로 이미 구현됨 — award.tsx는 useGameStore result를 직접 읽음"
metrics:
  duration: "112s"
  completed: "2026-05-27"
  tasks: 2
  files: 3
---

# Phase 05 Plan 08: AwardScreen 시상식 화면 Summary

**One-liner:** 시상식 화면 — PodiumSlot(1/2/3위 SlotCard 확대+rainbow), expo-av 빵빠레(graceful skip), 30초 자동 종료, 소감 채팅

## What Was Built

### Task 1: PodiumSlot 컴포넌트
- `apps/mobile/src/features/game/ui/PodiumSlot/index.tsx` 생성
- rank 1/2/3별 배율 1.4/1.1/0.9로 baseCardWidth 스케일
- 1위는 `isHost=true`를 SlotCard에 전달 → rainbow 테두리 애니메이션 재사용
- 순위 레이블 색상: 1위 PRIMARY_400, 2위 SECONDARY_300, 3위 SECONDARY_100
- `features/game/ui/index.ts`에 PodiumSlot export 추가

### Task 2: AwardScreen (award.tsx)
- `apps/mobile/app/room/[code]/award.tsx` 생성
- 레이아웃: 타이틀 → 시상대(flexDirection=row, alignItems=flex-end) → 4위 이하 FlatList → ChatInputBar → FooterRow
- expo-av `Audio.Sound.createAsync(require('@assets/sounds/fanfare.wav'))` — `.catch(() => {})` graceful skip
- 30초 setInterval 카운트다운 → `router.replace('/(tabs)')`
- game.tsx의 `roomState?.status === 'AWARD'` 라우팅 로직 활용 (이미 구현됨)
- 나가기 버튼: `Button color="light"` → 즉시 `router.replace('/(tabs)')` (Dialog 없음, UI-SPEC 준수)

## Deviations from Plan

### Auto-handled

**1. [Rule 2 - 기존 구현 확인] game.tsx AWARD 라우팅 이미 구현**
- game.tsx에 `roomState?.status === 'AWARD'`로 award 라우팅하는 코드가 Plan 07에서 이미 구현됨
- award.tsx에서 추가 구현 불필요 — useGameStore의 `result` 필드를 직접 읽는 방식 채택

**2. [Rule 2 - 타입 호환] PodiumPlayer → Player 형변환**
- SlotCard Props가 `Player | null`을 요구 — `friendCode=''`, `slot=rank`, `connected=true` 더미 필드로 변환
- isHost=true(1위)로 rainbow 테두리 재사용, isReady=false(배경색 DARK_100)

**3. [Pre-existing] dripsy.d.ts 타입 에러**
- `src/types/dripsy.d.ts` TS1109/TS1005 오류는 이 플랜 이전부터 존재하는 오류
- 범위 밖 — 수정하지 않음, typecheck 기준 오류로 취급하지 않음

## Success Criteria Check

- [x] AWRD-01: AwardScreen mount 시 expo-av fanfare 자동 재생 (파일 미존재 graceful skip)
- [x] AWRD-02: 1/2/3위 PodiumSlot 시상대 배치, 인원 부족 시 렌더링 생략(null 체크)
- [x] AWRD-03: ChatInputBar 소감 채팅 + 30초 카운트다운 자동 종료 → /(tabs) 이동

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: PodiumSlot | 002ba9c | PodiumSlot/index.tsx, features/game/ui/index.ts |
| Task 2: AwardScreen | 99eacc3 | app/room/[code]/award.tsx |

## Self-Check: PASSED
- `apps/mobile/src/features/game/ui/PodiumSlot/index.tsx` — FOUND
- `apps/mobile/app/room/[code]/award.tsx` — FOUND
- commit 002ba9c — FOUND
- commit 99eacc3 — FOUND
