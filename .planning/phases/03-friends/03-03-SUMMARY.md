---
phase: 03-friends
plan: 03
subsystem: api
tags: [tanstack-query, react-query, friends, presence, polling]

# Dependency graph
requires:
  - phase: 03-friends
    provides: shared/api/client.ts (apiGet/apiPost/apiPatch/apiDelete) + queryClient
provides:
  - useFriends: GET /friends with 30초 polling (refetchInterval: 30_000)
  - useFriendRequests: GET /friends/requests
  - useSendFriendRequest: POST /friends/requests mutation
  - useRespondRequest: PATCH /friends/requests/:id mutation (수락/거절)
  - useDeleteFriend: DELETE /friends/:userId mutation
affects:
  - 03-friends (FriendsScreen, 친구 모달 UI 계획)
  - 04-rooms (방 생성 시 친구 초대 플로우)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "features/friends/api/ 하위 TanStack Query 훅 패턴 (features/auth/api/ 와 동일 구조)"
    - "30초 polling: refetchInterval: 30_000 (D-06 REST presence)"
    - "mutation onSuccess: void queryClient.invalidateQueries() 로 관련 쿼리 무효화"

key-files:
  created:
    - apps/mobile/src/features/friends/api/useFriends.ts
    - apps/mobile/src/features/friends/api/useFriendRequests.ts
    - apps/mobile/src/features/friends/api/useSendFriendRequest.ts
    - apps/mobile/src/features/friends/api/useRespondRequest.ts
    - apps/mobile/src/features/friends/api/useDeleteFriend.ts
  modified: []

key-decisions:
  - "PresenceStatus, Friend, FriendRequest 타입을 각 파일에 inline 정의 — 현재 단일 사용처, 별도 types 파일 추출 불필요"
  - "D-04 준수: useSendFriendRequest.target은 '닉네임#코드' 조합 문자열 — friendCode 단독 전달 불가"

patterns-established:
  - "features/{domain}/api/ 하위 TanStack Query 훅 배치 패턴"
  - "mutation onSuccess에서 void queryClient.invalidateQueries() 호출 패턴"

requirements-completed: [FRND-01, FRND-02, FRND-03, FRND-04]

# Metrics
duration: 5min
completed: 2026-05-15
---

# Phase 03 Plan 03: 친구 API 훅 Summary

**TanStack Query 기반 친구 기능 훅 5개 — 30초 REST polling presence, mutation 후 자동 쿼리 무효화**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-15T11:15:00Z
- **Completed:** 2026-05-15T11:20:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- `useFriends` — GET /friends, `refetchInterval: 30_000`으로 D-06 REST presence polling 구현
- `useFriendRequests` — GET /friends/requests, 수락 대기 목록 조회
- `useSendFriendRequest` — POST /friends/requests, D-04 `닉네임#코드` 전체 조합 전달, 성공 시 requests 무효화
- `useRespondRequest` — PATCH /friends/requests/:id, 수락/거절 action 전달, 성공 시 requests + friends 모두 무효화
- `useDeleteFriend` — DELETE /friends/:userId, 성공 시 friends 무효화

## Task Commits

1. **Task 1: 5개 친구 API 훅** - `e490aff` (feat)

**Plan metadata:** (아래 final commit에서 추가)

## Files Created/Modified

- `apps/mobile/src/features/friends/api/useFriends.ts` — GET /friends + 30초 polling, PresenceStatus/Friend 타입
- `apps/mobile/src/features/friends/api/useFriendRequests.ts` — GET /friends/requests, FriendRequest 타입
- `apps/mobile/src/features/friends/api/useSendFriendRequest.ts` — POST /friends/requests mutation
- `apps/mobile/src/features/friends/api/useRespondRequest.ts` — PATCH /friends/requests/:id mutation
- `apps/mobile/src/features/friends/api/useDeleteFriend.ts` — DELETE /friends/:userId mutation

## Decisions Made

- `PresenceStatus`, `Friend`, `FriendRequest` 타입을 각 파일에 inline 정의 — 현재 단일 사용처이므로 별도 추출 불필요. UI 구현 시 공유 필요하면 그때 분리.
- `useSendFriendRequest`의 `target` 파라미터는 `"닉네임#코드"` 전체 조합 문자열 — D-04, Phase 2 D-01(friendCode @unique 제거) 반영.

## Deviations from Plan

없음 — 플랜 그대로 실행.

## Issues Encountered

없음.

## User Setup Required

없음 — 외부 서비스 설정 불필요.

## Next Phase Readiness

- 친구 기능 5개 훅 완성, FriendsScreen과 친구 추가/수락/거절 모달에서 바로 사용 가능
- Phase 4 소켓 도입 시 `useFriends`의 `refetchInterval`을 소켓 기반 presence로 교체할 수 있는 구조

---
*Phase: 03-friends*
*Completed: 2026-05-15*
