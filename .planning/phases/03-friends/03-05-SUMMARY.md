---
phase: 03-friends
plan: "05"
subsystem: mobile/features/friends/ui
tags: [modal, friends, mutation, toast, validation]
dependency_graph:
  requires: ["03-02", "03-03"]
  provides: ["AddFriendModal", "DeleteFriendModal"]
  affects: ["FriendsScreen (consumer)"]
tech_stack:
  added: []
  patterns: ["PixelModal + PixelButton 모달 패턴 (Phase 2 계속)", "useToastStore.getState().show() 직접 호출", "Pressable destructive 버튼 (DeleteAccountModal 패턴 계속)"]
key_files:
  created:
    - apps/mobile/src/features/friends/ui/AddFriendModal.tsx
    - apps/mobile/src/features/friends/ui/DeleteFriendModal.tsx
  modified: []
decisions:
  - "AddFriendModal 에러 분기: ApiError instanceof 체크 후 code 기반 분기 — useSendFriendRequest mutationFn이 ApiError를 throw하므로 타입 안전"
  - "DeleteFriendModal '삭제하기' 버튼: PixelButton 대신 Pressable 직접 사용 — destructive 배경 + background색 텍스트 조합이 PixelButton variant로 지원 불가"
metrics:
  duration: "70s"
  completed_date: "2026-05-15"
  tasks: 2
  files: 2
---

# Phase 3 Plan 5: 친구 추가/삭제 확인 모달 Summary

친구 추가(닉네임#코드 입력 + 서버 에러 코드 4종 분기)와 친구 삭제 확인 모달 2개를 Phase 2 패턴 기반으로 구현.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | AddFriendModal | b05f1d4 | apps/mobile/src/features/friends/ui/AddFriendModal.tsx |
| 2 | DeleteFriendModal | dddeb17 | apps/mobile/src/features/friends/ui/DeleteFriendModal.tsx |

## Decisions Made

- `AddFriendModal` 에러 핸들러에서 `err instanceof ApiError` 체크 후 `.code` 분기 — mutation 에러가 반드시 ApiError이지만 TypeScript에서 `unknown` 타입으로 추론되므로 타입 안전을 위해 instanceof 가드 추가.
- `DeleteFriendModal` "삭제하기" 버튼은 `PixelButton` 대신 `Pressable` + `StyleSheet` 직접 구현 — `PixelButton`은 `primary/secondary/outline` 3종 variant만 지원하며 destructive(빨간 배경 + 흰 텍스트) 조합이 없어 `DeleteAccountModal` 동일 패턴 채택.

## Deviations from Plan

None — 플랜 그대로 실행.

## Requirements Satisfied

- FRND-01: AddFriendModal로 친구 요청 발송 UI 완성
- FRND-04: DeleteFriendModal로 친구 삭제 UI 완성

## Self-Check: PASSED
