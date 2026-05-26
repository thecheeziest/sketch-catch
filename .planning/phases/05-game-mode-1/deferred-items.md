# Deferred Items — Phase 05

## Out-of-Scope Bugs (pre-existing)

### friends.test.ts 2 failing tests (SCOPE BOUNDARY)
- File: `apps/server/src/__tests__/friends.test.ts`
- Tests: `sendFriendRequest > #이 없는 target → SelfRequestError`, `sendFriendRequest > 코드 길이가 5가 아니면 → SelfRequestError`
- Error: `expected Error { code: 'INVALID_FORMAT' } to be an instance of SelfRequestError`
- Status: Pre-existing before Plan 03. Not related to game state machine changes.
- Action: Fix in a separate session focused on friends service.
