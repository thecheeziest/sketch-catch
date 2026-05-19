---
phase: 04-room-lobby
plan: 07
subsystem: ui
tags: [react-native, zustand, expo-router, matching, countdown]

requires:
  - phase: 04-05
    provides: useStartMatch, useCancelMatch, useRoomStore(isMatchmaking/matchingSeconds/setMatchmaking/setMatchingSeconds)
  - phase: 04-06
    provides: app/room/_layout.tsx — match.tsx를 포함하는 Stack 레이아웃

provides:
  - MatchingButton 컴포넌트 (경과 시간 MM:SS 카운트업, destructive 색상 텍스트)
  - RandomMatchScreen (app/room/match.tsx) — 인원 선택 + 매칭 진입/취소 흐름
  - (tabs)/_layout.tsx 매칭 중 친구 탭 tabPress preventDefault 비활성화

affects:
  - phase: 04-08 (홈 화면 매칭 진입 버튼 연결 시 useRoomStore 구독 참조)

tech-stack:
  added: []
  patterns:
    - "매칭 타이머: useEffect + setInterval + Zustand matchingSeconds, 언마운트 cleanup"
    - "탭 비활성화: Tabs.Screen listeners.tabPress e.preventDefault() — tabStyle 변경 없이 네비게이션만 차단"
    - "destructive 버튼: PixelButton 미지원 variant → Pressable 직접 + StyleSheet (DeleteFriendModal 패턴 계속)"

key-files:
  created:
    - apps/mobile/src/features/room/ui/MatchingButton/index.tsx
    - apps/mobile/app/room/match.tsx
  modified:
    - apps/mobile/app/(tabs)/_layout.tsx

key-decisions:
  - "D-10 준수: 타이머는 순수 카운트업만, 30초 타임아웃/연장 모달 절대 미포함"
  - "MatchingButton destructive 텍스트: 배경 colors.surface, 텍스트만 colors.destructive (#C0524A) — UI-SPEC Color 계약 준수"
  - "탭 비활성화: tabBarStyle 변경 없이 listeners.tabPress preventDefault — 매칭 종료 후 복원 깜빡임 방지"

patterns-established:
  - "매칭 타이머 패턴: useEffect(isMatchmaking) → setInterval 1초, useRoomStore.getState() 직접 접근, clearInterval cleanup"

requirements-completed: [ROOM-03, ROOM-04]

duration: 3min
completed: 2026-05-19
---

# Phase 04 Plan 07: 랜덤 매칭 화면 + MatchingButton + 탭 비활성화 Summary

**6/8/10명 인원 선택 → 매칭 진입 → 카운트업 버튼 + 매칭 중 친구 탭 탭 차단으로 ROOM-03/ROOM-04 완성, D-10 무기한 대기 정책 준수**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-18T23:57:00Z
- **Completed:** 2026-05-19T00:00:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- MatchingButton 컴포넌트: `formatMMSS(sec)` padStart 포맷 + destructive 텍스트 색상 + Pressable 직접 사용 (PixelButton 미지원 variant 대안)
- RandomMatchScreen: 인원 선택(6/8/10명 단일 선택) → useStartMatch.mutate(selected) → 카운트업 → useCancelMatch, setInterval cleanup 포함
- (tabs)/_layout.tsx: useRoomStore.isMatchmaking 구독 → friends tabPress preventDefault 차단, 기존 requestBadge/tabBarIcon 전부 보존

## Task Commits

1. **Task 1: MatchingButton 컴포넌트 + RandomMatchScreen** - `dc2d114` (feat)
2. **Task 2: (tabs)/_layout.tsx 탭 비활성화** - `f5070da` (feat)

## Files Created/Modified

- `apps/mobile/src/features/room/ui/MatchingButton/index.tsx` - 매칭 대기 중 카운트업 취소 버튼 (padStart MM:SS, destructive 텍스트)
- `apps/mobile/app/room/match.tsx` - RandomMatchScreen: 인원 선택 + 매칭 진입/취소 + 자동 대기실 이동
- `apps/mobile/app/(tabs)/_layout.tsx` - useRoomStore 구독 + 매칭 중 친구 탭 차단 추가

## Decisions Made

- D-10 타임아웃 없음: setInterval 카운트업만, `=== 30` 분기 절대 미포함
- MatchingButton 배경 `colors.surface`, 텍스트만 `colors.destructive` — UI-SPEC "매칭 취소 버튼 텍스트 색상" 계약 준수
- tabPress preventDefault 방식: tabBarStyle/tabBarVisible 변경 없이 네비게이션만 차단 → 매칭 종료 후 복원 시 깜빡임 없음

## Deviations from Plan

None — 플랜 그대로 실행. 기존 typecheck 에러(styled-components 삭제 파일, app/room/[code]/index.tsx SafeAreaView)는 이 플랜 변경 이전부터 존재하는 out-of-scope 에러.

## Issues Encountered

- typecheck 전체 실행 시 에러 발생 → git stash로 확인한 결과 이 플랜 변경과 무관한 기존 에러 (styled-components 마이그레이션 진행 중 상태). 이 플랜이 생성/수정한 3개 파일에는 타입 에러 없음.

## User Setup Required

None — 외부 서비스 설정 불필요.

## Next Phase Readiness

- ROOM-03/ROOM-04 완료: 매칭 큐 진입/즉시 취소 UI 흐름 완성
- 홈 화면에서 "랜덤 매칭" 버튼 → `router.push('/room/match')` 연결 (Phase 04-08)
- roomState.code 소켓 통지 수신 시 자동 대기실 이동 준비 완료

---
*Phase: 04-room-lobby*
*Completed: 2026-05-19*
