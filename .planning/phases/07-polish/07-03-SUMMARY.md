---
phase: 07-polish
plan: 03
subsystem: server
tags: [expo-server-sdk, push-notifications, friends, redis-dedupe, fastify]

# Dependency graph
requires: ["07-01: expo-server-sdk installed in apps/server"]
provides:
  - "apps/server/src/services/push.service.ts: sendPush(tokens, notif) + shouldSend(notificationId) dedupe guard"
  - "POST /me/push-token — persists Expo push token to existing User.pushToken column"
  - "sendFriendRequest()/respondToRequest() now return the resolved recipient/requester { id, pushToken }"
  - "Friend request + accept success paths fire push notifications (PUSH-01/PUSH-02), fire-and-forget"
affects: ["07-04-mobile-push-runtime (consumes POST /me/push-token)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redis push:dedupe:{notificationId} SETNX guard (1h TTL) called explicitly before sendPush, not baked into sendPush itself"
    - "Fire-and-forget async IIFE + .catch(logger.error) pattern for side effects that must not block the REST response"

key-files:
  created:
    - apps/server/src/services/push.service.ts
    - apps/server/src/__tests__/push.test.ts
  modified:
    - apps/server/src/services/friends.service.ts
    - apps/server/src/routes/friends.ts
    - apps/server/src/routes/me.ts
    - apps/server/src/__tests__/friends.test.ts

key-decisions:
  - "notificationId built from stable actor/target id pairs (friend-request:{senderId}:{receiverId}, friend-accept:{accepterId}:{requesterId}) rather than a stored request id — keeps dedupe scoped to the service's actual return contract (no extra field added to the plan's specified { id, pushToken } shape)"
  - "Sender/accepter nickname for the DEVELOPER.md §10.3 notification body is fetched inline inside the fire-and-forget push IIFE (not returned by the friends service) — keeps the DB read off the response's critical path"

patterns-established: []

requirements-completed: [PUSH-01, PUSH-02]

# Metrics
duration: ~35min (across two sessions, split by an API session-limit interruption after Task 1's files were written but before commit)
completed: 2026-07-30
---

# Phase 07 Plan 03: Server-Side Push Pipeline (push.service.ts + /me/push-token + friend request/accept triggers) Summary

**Built `sendPush()` (Expo token filter + chunk + send) with a Redis `push:dedupe` guard, a `POST /me/push-token` route writing to the existing `User.pushToken` column, and fire-and-forget push triggers on friend-request send/accept driven by the friends service's widened `{ id, pushToken }` return contract.**

## Performance

- **Duration:** ~35 min active work (split across two sessions by an API session-limit interruption — Task 1's files were already written to disk but uncommitted when the interruption occurred; resumed cleanly from that point)
- **Tasks:** 3 (all `type="auto"`, Task 1 `tdd="true"`)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `push.service.ts` implements `sendPush(tokens, notif)` verbatim per DEVELOPER.md §10.2 (`Expo.isExpoPushToken` filter → `chunkPushNotifications` → `sendPushNotificationsAsync`, `sound: 'default'`), plus `shouldSend(notificationId)` — a `push:dedupe:{notificationId}` Redis `SETNX` guard with a 1h TTL, matching §10.4.
- `push.test.ts` mocks `expo-server-sdk` (via `vi.hoisted` to share spy references between the mocked `Expo` class and the assertions) and `../db/redis.js`; covers token filtering (valid token reaches `sendPushNotificationsAsync`, invalid does not; zero valid tokens → no send attempted) and dedupe first-call-true/repeat-call-false behavior.
- `POST /me/push-token` added to `me.ts` following the existing `PATCH /me` shape: `authenticate` preHandler, local `z.object({ token: z.string().min(1) })` validation (400 `INVALID_INPUT` on failure), `prisma.user.update({ pushToken })`, `{ ok: true }` reply, try/catch → 500 `INTERNAL`.
- `prisma migrate status` run against the local dev Postgres confirms the schema is already up to date — `pushToken` was applied in `20260514005838_init`, no new migration generated.
- `friends.service.ts`: `sendFriendRequest` now returns `{ id: receiver.id, pushToken: receiver.pushToken }` (from the `receiver` row it already fetched — no extra query); `respondToRequest` now returns `{ id, pushToken }` of the original requester on `ACCEPT` (resolved via `prisma.user.findUnique({ where: { id: req.senderId }, select: { id: true, pushToken: true } })` after the transaction) and `null` on `REJECT`. `parseTarget` remains unexported.
- `friends.ts`: after `sendFriendRequest` succeeds, fires a `push:dedupe`-gated `sendPush` to the receiver (title `'친구 요청'`, body `'{보낸사람 닉네임}님이 친구 요청을 보냈어요.'`) as an un-awaited async IIFE with `.catch(logger.error)`. After `respondToRequest`, the same pattern fires only when `action === 'ACCEPT' && requester?.pushToken` (title `'친구 요청 수락'`, body `'{수락한사람 닉네임}님이 친구 요청을 수락했어요.'`). Neither call blocks or can fail the REST response.
- `friends.test.ts` updated: the three assertions that assumed an `undefined`/no-return contract (send-request success, ACCEPT, REJECT) now assert the real `{ id, pushToken }` / `{ id, pushToken }` / `null` shapes; ACCEPT test adds an explicit `prisma.user.findUnique` mock for the new requester lookup. All 19 pre-existing tests remain green.
- Full server suite: 111/111 tests pass across 16 files. Server `tsc --noEmit` exits clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create push.service.ts (sendPush + dedupe) with tests** - `aa64383` (feat)
2. **Task 2: Add POST /me/push-token route + verify pushToken column is live** - `1662548` (feat)
3. **Task 3: Return recipient/requester from friends.service + fire-and-forget sendPush, update friends.test.ts** - `ade99df` (feat)

## Files Created/Modified

- `apps/server/src/services/push.service.ts` (new) - `sendPush()` + `shouldSend()` dedupe guard
- `apps/server/src/__tests__/push.test.ts` (new) - token-filter + dedupe coverage, mocked `expo-server-sdk` and Redis
- `apps/server/src/routes/me.ts` - added `POST /me/push-token`
- `apps/server/src/services/friends.service.ts` - `sendFriendRequest`/`respondToRequest` now return resolved recipient/requester `{ id, pushToken }`
- `apps/server/src/routes/friends.ts` - fire-and-forget `sendPush` calls on friend-request send (PUSH-01) and accept (PUSH-02)
- `apps/server/src/__tests__/friends.test.ts` - 3 assertions updated to the new return contract; 19 tests still green

## Decisions Made

- Dedupe `notificationId` is derived from stable actor/target id pairs (`friend-request:{senderId}:{receiverId}`, `friend-accept:{accepterId}:{requesterId}`) rather than a persisted request id, to avoid widening the friends-service return contract beyond the plan's specified `{ id, pushToken }` shape. This means a rejected-then-resent friend request between the same two users within the same 1h window will be deduped on the push side — acceptable per the T-07-03-DOS threat mitigation intent (guard against duplicate logical trigger spam), and the underlying `DuplicateRequestError`/re-request flow is unaffected (only the push notification is deduped, not the friend request itself).
- The actor's nickname (needed to fill the DEVELOPER.md §10.3 body template) is fetched via `prisma.user.findUnique({ select: { nickname: true } })` inline inside the fire-and-forget IIFE, not returned by the friends service — keeps this DB read off the REST response's critical path and avoids widening the service return type for a route-local formatting concern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Materialized `node_modules`, generated Prisma client, and built `packages/shared` in the fresh worktree checkout**
- **Found during:** Task 1 (running `push.test.ts` for the first time)
- **Issue:** Fresh worktree had no `node_modules` and no generated Prisma client (mirrors the same gap 07-01 hit in its own worktree), and `packages/shared/dist` was missing so `@sketch-catch/shared` type imports in `friends.service.ts` would not resolve.
- **Fix:** `CI=true pnpm install --frozen-lockfile` at the workspace root, `pnpm --filter @sketch-catch/server run prisma:generate`, `pnpm --filter @sketch-catch/shared build`.
- **Files modified:** None tracked by git (generated artifacts live in `node_modules`/`dist`, both gitignored).
- **Committed in:** N/A (no source change)

**2. [Rule 3 - Blocking] Created a local, gitignored `apps/server/.env` for test execution**
- **Found during:** Task 1 (`push.test.ts` failed at import time — `src/lib/env.ts` calls `process.exit(1)` when `DATABASE_URL`/`REDIS_URL` are missing, and no `.env` existed in this fresh worktree checkout)
- **Issue:** `.env` is gitignored and therefore absent from a fresh worktree; every test file that transitively imports `logger.ts` → `env.ts` fails at module load without it.
- **Fix:** Wrote `apps/server/.env` with the same non-secret local-dev values already used in the main checkout's `.env` (local Postgres/Redis URLs, dev JWT secret, Kakao REST key) — this file is git-ignored and was never staged or committed.
- **Files modified:** None tracked by git (`.env` is in `.gitignore`).
- **Committed in:** N/A (gitignored, confirmed via `git status --ignored`)

**3. [Rule 2 - Missing critical functionality] Added inline actor-nickname lookup for the push notification body**
- **Found during:** Task 3 (writing the `friends.ts` push triggers)
- **Issue:** The plan's acceptance criteria require using the exact DEVELOPER.md §10.3 copy (`'{닉네임}님이 친구 요청을 보냈어요.'` / accept equivalent), which needs the *acting* user's nickname — a value neither `sendFriendRequest` nor `respondToRequest` returns (they return the counterpart's `{ id, pushToken }`). Without it, the notification body would be a placeholder, violating "do not invent copy."
- **Fix:** Added a `prisma.user.findUnique({ where: { id: <actorId> }, select: { nickname: true } })` lookup inside the fire-and-forget IIFE, executed after the REST response has already been queued — does not block or risk failing the response.
- **Files modified:** `apps/server/src/routes/friends.ts`
- **Committed in:** `ade99df` (Task 3)

**4. [Rule 2 - Missing critical functionality] Explicit `shouldSend()` dedupe gate before every `sendPush()` call**
- **Found during:** Task 3
- **Issue:** The plan instructs "pass a stable notificationId into the dedupe guard where the service supports it" but does not specify the exact call site; without an explicit gate, `push.service.ts`'s dedupe helper (built in Task 1) would go unused, leaving the T-07-03-DOS threat mitigation (Redis `push:dedupe` guard against duplicate-trigger push spam) undelivered.
- **Fix:** Both push sites in `friends.ts` call `shouldSend(notificationId)` and only proceed to `sendPush` when it resolves `true`.
- **Files modified:** `apps/server/src/routes/friends.ts`
- **Committed in:** `ade99df` (Task 3)

---

**Total deviations:** 4 (2 Rule 3 — environment setup gaps in a fresh worktree, both non-source; 2 Rule 2 — functionality required by the plan's own acceptance criteria/threat model that had no fully-specified call site)
**Impact on plan:** No scope creep beyond what Task 3's acceptance criteria and the plan's `T-07-03-DOS` threat-model mitigation already required. No architectural changes, no new tables/columns, no new dependencies.

## Issues Encountered

None beyond the deviations documented above. The task was interrupted once mid-Task-1 by an API session-limit error; `push.service.ts` and `push.test.ts` were already written to disk (untracked) at that point and were verified + committed on resume without redoing any work.

## User Setup Required

None. No external service configuration needed — `EXPO_ACCESS_TOKEN` remains optional per `env.ts` and is not required for `sendPush` to function against Expo's public push endpoint.

## Next Phase Readiness

- `POST /me/push-token` is live and ready for 07-04 (mobile push runtime) to POST the Expo push token to after `getExpoPushTokenAsync()`.
- `sendPush`/`shouldSend` are exported from `push.service.ts` and can be reused by any future push trigger (e.g. game-invite pushes, mentioned in DEVELOPER.md §10.3 but out of this plan's scope).
- No blockers identified for downstream plans in this wave.

---
*Phase: 07-polish*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: apps/server/src/services/push.service.ts
- FOUND: apps/server/src/__tests__/push.test.ts
- FOUND: apps/server/src/routes/me.ts (contains `push-token`)
- FOUND: apps/server/src/routes/friends.ts (contains `sendPush(`, count=2)
- FOUND: apps/server/src/services/friends.service.ts (contains `pushToken`)
- FOUND: apps/server/src/__tests__/friends.test.ts (contains `pushToken`)
- FOUND: commit aa64383 (Task 1)
- FOUND: commit 1662548 (Task 2)
- FOUND: commit ade99df (Task 3)
