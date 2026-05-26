---
phase: 05-game-mode-1
plan: "05"
subsystem: server/chat
tags: [chat, profanity-filter, answer-detection, game-logic]
dependency_graph:
  requires: [05-01, 05-03]
  provides: [profanity-filter, chat-handler, answer-detection, answer-accept]
  affects: [game.namespace, 05-07]
tech_stack:
  added: [badwords-ko, hangul-js]
  patterns: [TDD-RED-GREEN, module-level-recentMessages-map, ambient-type-declaration]
key_files:
  created:
    - apps/server/src/services/profanity.ts
    - apps/server/src/socket/handlers/chat.ts
    - apps/server/src/types/badwords-ko.d.ts
  modified:
    - apps/server/src/services/profanity/dict.txt
    - apps/server/src/socket/game.namespace.ts
    - apps/server/src/__tests__/profanity.test.ts
    - apps/server/src/__tests__/game.test.ts
decisions:
  - "badwords-ko Filter 클래스 options.list 직접 접근으로 단어 목록 추출 — API에 배열 export 없음"
  - "자모 분리 검사에서 2음절 미만 + disassemble 결과가 원본과 동일한 단어 제외 — ㅄ→ㅂㅅ 거짓 양성 방지"
  - "badwords-ko ambient 타입 선언(badwords-ko.d.ts) 추가 — @types/badwords-ko 미존재 (hangul-js.d.ts와 동일 패턴)"
  - "recentMessages Map을 모듈 레벨로 관리 — answer:accept가 messageId로 발신자 조회"
metrics:
  duration: "184s"
  completed_date: "2026-05-26"
  tasks_completed: 2
  files_changed: 7
---

# Phase 05 Plan 05: 채팅/정답 핸들러 Summary

**One-liner:** badwords-ko + hangul-js 자모정규화 비속어 필터 + 출제자 채단·30자·정답 자동/수동 판정 서버 핸들러

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | profanity.ts 비속어 필터 서비스 TDD | 12e9af3 | profanity.ts, dict.txt, profanity.test.ts |
| 2 | chat.ts 핸들러 + namespace 등록 TDD | ba5dc56 | chat.ts, game.namespace.ts, game.test.ts, profanity.test.ts, badwords-ko.d.ts |

## Requirements Satisfied

- **MD1-02**: text.trim() === prompt.trim() 자동 정답 판정 + endRound 호출
- **MD1-03**: 출제자가 answer:accept로 특정 messageId 수동 인정
- **MD1-04**: endRound → calcScore(elapsedMs) 경유 점수 계산 (guesser: max(100, 1000-sec*30), drawer: min(500, guesser*0.5))
- **GAME-01**: 비속어 마스킹 + 출제자 채팅 차단 + 30자 제한

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] badwords-ko ambient 타입 선언 추가**
- **Found during:** Task 2 typecheck
- **Issue:** `badwords-ko` 패키지에 타입 선언이 없어 typecheck 실패 (`TS7016`)
- **Fix:** `apps/server/src/types/badwords-ko.d.ts` 생성 — `hangul-js.d.ts`와 동일 패턴 (STATE.md 기록 있음)
- **Files modified:** apps/server/src/types/badwords-ko.d.ts
- **Commit:** ba5dc56

**2. [Rule 1 - Bug] 자모 분리 거짓 양성 필터링**
- **Found during:** Task 1 GREEN 단계
- **Issue:** badwords-ko 목록의 `ㅄ` 단어가 `Hangul.disassemble('안녕하세요 반갑습니다')`의 `ㅂㅅ` 시퀀스와 매칭되어 정상 텍스트도 비속어로 판정
- **Fix:** 2음절 미만이거나 disassemble 결과가 원본과 동일한 단어(자음/모음 단독)는 자모 분리 검사에서 제외
- **Files modified:** apps/server/src/services/profanity.ts
- **Commit:** 12e9af3

## Known Stubs

None — 서버 로직 전용 플랜, UI 없음.

## Notes

- `profanity/dict.txt`에 `테스트욕설` 단어 추가 (테스트 결정론적 검증용). 빌드 시 `dist/` 로 dict.txt 복사가 필요하다면 `tsconfig.json`의 `outDir` 복사 설정 또는 별도 빌드 스텝 추가 필요 (현재 개발 환경에서는 소스 경로 직접 사용).
- `recentMessages` Map이 메모리에 무한 누적되는 잠재적 이슈: 라운드 종료(endRound) 시점에 정리 로직 추가를 권장 (Phase 5 범위 외 — deferred).
- friends.test.ts의 기존 실패 2개(`sendFriendRequest > SelfRequestError` 관련)는 이 플랜과 무관한 기존 이슈.

## Self-Check: PASSED

- profanity.ts: FOUND
- chat.ts: FOUND
- badwords-ko.d.ts: FOUND
- SUMMARY.md: FOUND
- Task 1 commit 12e9af3: FOUND
- Task 2 commit ba5dc56: FOUND
