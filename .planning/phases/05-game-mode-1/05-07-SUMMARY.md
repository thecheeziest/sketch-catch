---
phase: 05-game-mode-1
plan: 07
subsystem: ui
tags: [react-native, reanimated, dripsy, socket.io, game-chat, animation]

requires:
  - phase: 05-game-mode-1/05-06
    provides: PlayerCell, PlayerGrid, GameHeader, DrawingCanvas, useGameStore (chatMessages, roundResult, correct)
  - phase: 05-game-mode-1/05-05
    provides: chat:send / answer:accept 서버 핸들러

provides:
  - ChatBubble: 2.5초 TTL + 200ms Reanimated fade-out, 정답/일반 색상 분기
  - ChatInputBar: 30자 제한 + 출제자 비활성 + accessibilityLabel 전송 버튼
  - WordBanner: PRIMARY_400 PixelFrame 제시어 배너 (출제자 전용)
  - RoundResultOverlay: 3초 카운트다운 전체화면 오버레이 + 점수 목록
  - ScoreFeedback: translateY/opacity Reanimated 800ms 점수 float 애니메이션
  - AnswerApprovalButton: Dialog 기반 수동 정답 인정 플로우
  - useChatSender: chat:send / answer:accept emit 훅
  - game.tsx: 채팅/피드백 UI 전체 조립 완성
affects: [05-game-mode-1/05-08, 05-game-mode-1/05-09]

tech-stack:
  added: []
  patterns:
    - "ChatBubble은 PlayerCell 내부에서 absolute 포지션으로 렌더링, onExpire 콜백으로 부모에 만료 신호 전달"
    - "activeBubbles: Record<userId, ChatMessage | null> 로컬 상태로 PlayerGrid에 전파"
    - "RoundResultOverlay — opacity를 컴포넌트 자체가 아닌 backgroundColor rgba로 처리 (자식 opacity 오염 방지)"
    - "answer:accept { messageId } 전송 시 chatMessages 역방향 탐색으로 선택 플레이어의 마지막 messageId 추출"

key-files:
  created:
    - apps/mobile/src/features/game/ui/ChatBubble/index.tsx
    - apps/mobile/src/features/game/ui/ChatInputBar/index.tsx
    - apps/mobile/src/features/game/ui/WordBanner/index.tsx
    - apps/mobile/src/features/game/ui/RoundResultOverlay/index.tsx
    - apps/mobile/src/features/game/ui/ScoreFeedback/index.tsx
    - apps/mobile/src/features/game/ui/AnswerApprovalButton/index.tsx
    - apps/mobile/src/features/game/api/useChatSender.ts
  modified:
    - apps/mobile/src/features/game/ui/index.ts
    - apps/mobile/src/features/game/ui/PlayerCell/index.tsx
    - apps/mobile/src/features/game/ui/PlayerGrid/index.tsx
    - apps/mobile/app/room/[code]/game.tsx

key-decisions:
  - "RoundResultOverlay opacity는 StyleSheet backgroundColor에 rgba로 처리 — StyleSheet.absoluteFillObject + opacity 속성은 자식 Text/View 투명도도 같이 낮춤"
  - "useChatSender를 Plan 05에서 생성됐어야 했으나 누락 — Rule 3(blocking) 적용, Task 4에서 생성"
  - "AnswerApprovalButton.onApprove(userId) 수신 후 chatMessages 역탐색으로 messageId 추출 — socket 이벤트 스펙(answer:accept { messageId }) 준수"

patterns-established:
  - "말풍선 컴포넌트: useEffect 내 setTimeout → withTiming → runOnJS(onExpire) 패턴"
  - "출제자/관전자 분기: isDrawer boolean prop으로 조건부 렌더링"

requirements-completed: [GAME-01, GAME-02, MD1-03]

duration: 18min
completed: 2026-05-27
---

# Phase 05 Plan 07: 게임 채팅 UI 요약

**Reanimated 기반 ChatBubble(2.5초 TTL) + ChatInputBar + WordBanner + RoundResultOverlay + ScoreFeedback + AnswerApprovalButton 6개 컴포넌트 구현 및 game.tsx 조립 완성**

## Performance

- **Duration:** 18min
- **Started:** 2026-05-27T00:00:00Z
- **Completed:** 2026-05-27T00:18:00Z
- **Tasks:** 4
- **Files modified:** 11

## Accomplishments

- ChatBubble: 2.5초 후 200ms fade-out (Reanimated withTiming + runOnJS), 정답자 ACCENT_100/ACCENT_300, 일반 LIGHT_100/DARK_200 시각 분기
- ChatInputBar: 30자 maxLength + 출제자 비활성(editable=false + placeholder 교체) + "전송" accessibilityLabel
- WordBanner/RoundResultOverlay/ScoreFeedback/AnswerApprovalButton 4개 컴포넌트 + useChatSender 훅
- game.tsx: 채팅 메시지 → activeBubbles 맵 업데이트 → PlayerGrid/PlayerCell ChatBubble 렌더링, 출제자 PlayerCell 탭 선택 → AnswerApprovalButton 활성 → Dialog → answer:accept 전체 플로우 연결

## Task Commits

1. **Task 1: ChatBubble 컴포넌트** - `46ffcc4` (feat)
2. **Task 2: ChatInputBar 컴포넌트** - `824535c` (feat)
3. **Task 3: WordBanner/RoundResultOverlay/ScoreFeedback/AnswerApprovalButton** - `827bb00` (feat)
4. **Task 4: game.tsx 조립 + barrel export + useChatSender** - `bb076eb` (feat)

## Files Created/Modified

- `apps/mobile/src/features/game/ui/ChatBubble/index.tsx` - 2.5초 TTL 말풍선, Reanimated fade-out, 정답/일반 분기
- `apps/mobile/src/features/game/ui/ChatInputBar/index.tsx` - 채팅 입력창, 30자 제한, 출제자 비활성
- `apps/mobile/src/features/game/ui/WordBanner/index.tsx` - 제시어 배너, PRIMARY_400 PixelFrame
- `apps/mobile/src/features/game/ui/RoundResultOverlay/index.tsx` - 라운드 결과 오버레이, 3초 카운트다운
- `apps/mobile/src/features/game/ui/ScoreFeedback/index.tsx` - 점수 float 애니메이션, 800ms translateY + opacity
- `apps/mobile/src/features/game/ui/AnswerApprovalButton/index.tsx` - 수동 정답 인정 버튼, Dialog 연동
- `apps/mobile/src/features/game/api/useChatSender.ts` - chat:send / answer:accept emit 훅 (신규 생성)
- `apps/mobile/src/features/game/ui/index.ts` - 6개 컴포넌트 barrel export 추가
- `apps/mobile/src/features/game/ui/PlayerCell/index.tsx` - activeBubble prop 추가, ChatBubble 렌더링
- `apps/mobile/src/features/game/ui/PlayerGrid/index.tsx` - 출제자 선택 플로우, activeBubbles 전달
- `apps/mobile/app/room/[code]/game.tsx` - 전체 채팅/피드백 UI 조립 완성

## Decisions Made

- RoundResultOverlay의 반투명 배경은 StyleSheet의 `backgroundColor: rgba(...)` 처리 — opacity 속성 사용 시 자식 컴포넌트 Text/View 투명도도 함께 낮아져 텍스트가 보이지 않는 문제 방지
- AnswerApprovalButton의 onApprove(userId) 수신 후 chatMessages 배열을 역방향 탐색해 해당 플레이어의 마지막 messageId를 추출 → answer:accept { messageId } 전송 — 서버 스펙 준수

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] useChatSender 훅 누락**
- **Found during:** Task 4 (game.tsx 조립)
- **Issue:** plan이 `features/game/api/useChatSender.ts`를 Plan 05 산출물로 참조했으나 실제로 생성되지 않음
- **Fix:** `useChatSender` 훅 신규 생성 — chat:send emit(sendChat), answer:accept emit(acceptAnswer) 제공
- **Files modified:** apps/mobile/src/features/game/api/useChatSender.ts (신규)
- **Verification:** game.tsx에서 import 후 TypeScript 오류 없음
- **Committed in:** bb076eb (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing dependency)
**Impact on plan:** game.tsx 조립에 필수. 스코프 추가 없음.

## Issues Encountered

- `dripsy.d.ts` 에서 TypeScript 오류 발생 — 플랜 실행 이전부터 존재하는 pre-existing 이슈. 내 변경과 무관, 별도 추적 필요.

## Known Stubs

없음. 모든 컴포넌트 데이터 소스가 useGameStore / useRoomStore에 연결되어 있음.

## Next Phase Readiness

- GAME-02(채팅 말풍선), GAME-01(채팅 UI), MD1-03(수동 정답 인정) 충족
- Plan 08(시상식 AwardScreen) 진입 가능
- `pnpm --filter @sketch-catch/mobile typecheck` — dripsy.d.ts pre-existing 오류 제외 시 GREEN

---
*Phase: 05-game-mode-1*
*Completed: 2026-05-27*
