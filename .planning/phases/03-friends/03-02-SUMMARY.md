---
phase: 03-friends
plan: 02
subsystem: ui
tags: [react-native, styled-components, animated, presence, friendship]

requires:
  - phase: 02-auth-profile
    provides: "colors/typography/fontFamily theme exports, PixelButton Pressable 패턴"

provides:
  - PresenceDot: ONLINE/OFFLINE/IN_GAME 3종 상태 색상 dot (10×10)
  - FriendItem: 64px 행 컴포넌트 (캐릭터 아이콘 + PresenceDot + 닉네임/코드 + onLongPress)
  - RequestItem: 64px 행 컴포넌트 (캐릭터 아이콘 + 닉네임/코드 + 수락/거절 버튼)
  - SegmentedTab: 슬라이딩 언더라인 인디케이터 탭 바 (Animated 150ms, badgeIndex)

affects:
  - 03-03 (API 훅 플랜 — FriendItem/RequestItem/SegmentedTab 사용처)
  - 03-04 이후 (FriendsScreen 조합)

tech-stack:
  added: []
  patterns:
    - "RN 직접 StyleSheet.create + 테마 exports 참조 (dripsy ThemeProvider 미사용, PixelButton 패턴 계속)"
    - "Animated.Value ref + useEffect 감시 → timing 애니메이션 (useNativeDriver: true)"
    - "position: absolute dot 오버레이 패턴 (presence dot 우하단)"

key-files:
  created:
    - apps/mobile/src/shared/ui/PresenceDot/index.tsx
    - apps/mobile/src/shared/ui/FriendItem/index.tsx
    - apps/mobile/src/shared/ui/RequestItem/index.tsx
    - apps/mobile/src/shared/ui/SegmentedTab/index.tsx
  modified: []

key-decisions:
  - "캐릭터 아이콘은 실 PNG 미존재로 accentSecondary 단색 블록 placeholder — 실 에셋 추가 시 Image 교체"
  - "SegmentedTab indicator translateX는 Dimensions.get 고정 tabWidth 기반 — Phase 3 가로 모드 미지원으로 충분"

patterns-established:
  - "shared/ui 신규 컴포넌트: Barrel Pattern(폴더/index.tsx), colors/typography/fontFamily 직접 import"

requirements-completed:
  - FRND-03

duration: 2min
completed: 2026-05-15
---

# Phase 03 Plan 02: 친구 공용 UI 컴포넌트 Summary

**PresenceDot/FriendItem/RequestItem/SegmentedTab 4개 shared/ui 컴포넌트 — UI-SPEC 치수·색상·애니메이션 계약 충족**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-15T11:11:59Z
- **Completed:** 2026-05-15T11:13:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- PresenceDot: 3종 상태 색상(#4CAF50/#9E9E9E/#C8A84B) 10×10 원형 dot
- FriendItem: 64px 행, 40×40 캐릭터 플레이스홀더 + PresenceDot 우하단 absolute, onLongPress 500ms delayLongPress
- RequestItem: 64px 행, 수락(accentSecondary)/거절(destructive) 인라인 버튼 36px height, isLoading disabled 처리
- SegmentedTab: Animated.timing 150ms + useNativeDriver:true 슬라이딩 언더라인, badgeIndex dot 배지

## Task Commits

1. **Task 1: PresenceDot + FriendItem + RequestItem** - `ef8c29b` (feat)
2. **Task 2: SegmentedTab** - `601dcc8` (feat)

## Files Created/Modified

- `apps/mobile/src/shared/ui/PresenceDot/index.tsx` — 3종 presence 상태 색상 dot 인디케이터
- `apps/mobile/src/shared/ui/FriendItem/index.tsx` — 친구 목록 행 컴포넌트 (PresenceDot 오버레이 포함)
- `apps/mobile/src/shared/ui/RequestItem/index.tsx` — 친구 요청 행 컴포넌트 (수락/거절 버튼)
- `apps/mobile/src/shared/ui/SegmentedTab/index.tsx` — 슬라이딩 언더라인 세그먼트 탭 바

## Decisions Made

- 캐릭터 아이콘은 실 PNG 미존재로 accentSecondary 단색 블록 placeholder 사용 — 실 에셋 추가 시 Image 컴포넌트로 교체
- SegmentedTab indicator는 Dimensions.get 고정 tabWidth 기반 translateX — 가로 모드 미지원(Phase 3 범위) 내에서 충분

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `apps/mobile/src/shared/ui/FriendItem/index.tsx` — 캐릭터 아이콘 40×40이 accentSecondary 단색 블록 (실 PNG 없음). UI는 정상 동작하나 실제 캐릭터 이미지는 에셋 준비 후 교체 필요.
- `apps/mobile/src/shared/ui/RequestItem/index.tsx` — 동일 캐릭터 아이콘 placeholder.

이 두 스텁은 친구 목록 렌더링 목표를 막지 않으며, 에셋 페이즈에서 해결 예정.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 4개 공용 컴포넌트 완성 — 03-03(API 훅), 03-04(FriendsScreen) 에서 바로 import 가능
- typecheck exit 0 확인

---
*Phase: 03-friends*
*Completed: 2026-05-15*
