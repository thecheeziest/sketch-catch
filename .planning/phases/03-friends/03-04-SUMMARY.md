---
phase: 03-friends
plan: "04"
subsystem: server-tests
tags: [vitest, unit-test, friends-service, mocking]
dependency_graph:
  requires: ["03-01"]
  provides: ["friends-service-test-coverage"]
  affects: ["server-test-suite"]
tech_stack:
  added: []
  patterns: ["vi.mock 모듈 격리", "top-level await import (ESM)", "prisma mock 패턴"]
key_files:
  created:
    - apps/server/src/__tests__/friends.test.ts
  modified: []
decisions:
  - "getPresence mock을 vi.fn().mockResolvedValue('OFFLINE')으로 기본값 설정 — getFriends presenceStatus 테스트에서 개별 오버라이드"
  - "me.test.ts 기존 4개 실패는 이 플랜과 무관한 pre-existing 이슈 — 범위 밖으로 미수정"
metrics:
  duration: "1min"
  completed_date: "2026-05-15"
  tasks_completed: 1
  files_changed: 1
---

# Phase 03 Plan 04: friends.service.ts 단위 테스트 Summary

friends.service.ts의 핵심 에러 분기 4개 함수를 Vitest + vi.mock으로 총 18개 케이스 커버.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | friends.service.ts 단위 테스트 | 6e2a542 | apps/server/src/__tests__/friends.test.ts |

## What Was Built

`friends.test.ts` — Prisma/Redis를 vi.mock으로 격리한 순수 단위 테스트:

- **sendFriendRequest (6개):** parseTarget null → SelfRequestError, 코드 길이 오류, 사용자 미존재 → UserNotFoundError, 자기 자신 → SelfRequestError, 이미 친구 → AlreadyFriendsError, 정상 create 호출, 중복 요청(create throw) → DuplicateRequestError
- **respondToRequest (5개):** 미존재 request → RequestNotFoundError, PENDING 아님 → RequestNotFoundError, receiverId 불일치 → ForbiddenError, ACCEPT → $transaction(update+create), REJECT → update only
- **deleteFriend (2개):** Friendship 없음 → RequestNotFoundError, 정상 삭제 → friendship.delete
- **getFriends (4개):** 빈 목록, userAId===userId 시 userB 반환, userBId===userId 시 userA 반환, presenceStatus getPresence 결과 주입

## Deviations from Plan

### Pre-existing Issues (범위 밖, 미수정)

`me.test.ts` 4개 테스트가 이 플랜 실행 전부터 500 에러로 실패 중. 현재 플랜의 변경으로 발생한 게 아니므로 수정하지 않음. `deferred-items.md`에 기록 대상.

## Test Results

- friends.test.ts: 18/18 통과
- 기존 서버 테스트 (smoke, task1, auth): 모두 통과
- me.test.ts: pre-existing 4개 실패 (이 플랜 무관)

## Known Stubs

없음.

## Self-Check: PASSED

- [x] `apps/server/src/__tests__/friends.test.ts` 존재 확인
- [x] commit `6e2a542` 존재 확인 (`git log --oneline` 확인)
- [x] 18개 테스트 통과 확인
