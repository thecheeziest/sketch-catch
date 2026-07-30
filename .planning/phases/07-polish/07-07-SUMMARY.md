---
phase: 07-polish
plan: 07
subsystem: server
tags: [fastify, expo-server-sdk, push-notifications, invites, redis-dedupe]

# Dependency graph
requires: ["07-03: sendPush/shouldSend from apps/server/src/services/push.service.ts"]
provides:
  - "POST /rooms/:code/invite — server-authoritative D-12 LOBBY enforcement + game-invite push send"
affects: ["07-04-mobile-push-runtime (tap deep-link consumes data.roomCode)", "07-05-mobile-invite-ui (calls this route with { target: userId })"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "push:dedupe SETNX guard (shouldSend) applied to a new push-trigger route, reusing 07-03's dedupe primitive with a route-scoped notificationId (game-invite:{inviterId}:{targetId}:{roomCode})"
    - "Server re-validates client-trusted state (room LOBBY status) before any side effect — client button gate (07-05) is UX-only, not a security boundary"

key-files:
  created:
    - apps/server/src/routes/invites.ts
    - apps/server/src/__tests__/invites.test.ts
  modified:
    - apps/server/src/main.ts

key-decisions:
  - "target is the invited friend's raw User.id (PINNED contract from the plan) — resolved via prisma.user.findUnique({ where: { id: target } }), no 닉네임#코드 parsing, matching what the mobile InviteModal already holds in memory from 07-05"
  - "Added an explicit shouldSend(notificationId) dedupe gate before sendPush (Rule 2 — the plan's own T-07-07-DOS threat-model mitigation names 'push dedupe from 07-03' as the DOS mitigation for this route, but the task <action> text didn't spell out the call site)"

patterns-established: []

requirements-completed: [PUSH-03]

# Metrics
duration: ~25min
completed: 2026-07-30
---

# Phase 07 Plan 07: Server-Side Invite Route (D-12 LOBBY enforcement + push send) Summary

**Built `POST /rooms/:code/invite` — validates the room code and body, re-checks `state.status === 'LOBBY'` server-side (403 `GAME_IN_PROGRESS` otherwise, checked before any push send), resolves the target friend's push token by `userId`, and sends a deep-linkable `game-invite` push with `data.roomCode` gated by the existing Redis dedupe guard.**

## Performance

- **Duration:** ~25 min (mostly fresh-worktree environment bootstrap: `pnpm install`, `prisma generate`, `packages/shared` build, local `.env`)
- **Tasks:** 2 (`type="auto"`, Task 1 `tdd="true"`)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `invites.ts` exports `invitesRoutes: FastifyPluginAsync` with `POST /rooms/:code/invite` under the `authenticate` preHandler. Follows `rooms.ts`'s Zod-parse → `getRoomState` → status-check shape.
- D-12 server-side enforcement: `state.status !== 'LOBBY'` → 403 `{ error: 'GAME_IN_PROGRESS' }`, checked strictly before any `sendPush` call (verified by an explicit test asserting `sendPush` was not called on the 403 path).
- Target resolution uses the PINNED contract: `target` is a raw `userId` (not `닉네임#코드`), resolved via `prisma.user.findUnique({ where: { id: target }, select: { pushToken: true } })`. Missing user → 404 `USER_NOT_FOUND`; user with `pushToken: null` → `{ ok: true }` with no send attempt.
- Push payload: `title='게임 초대'`, `body='{닉네임}님이 게임에 초대했어요.'` (per UI-SPEC's confirmed default against DEVELOPER.md §10.3, which only contractually requires `data.roomCode`), `data: { roomCode: state.code }` — this is what 07-04's tap-routing listener consumes.
- `push:dedupe:{notificationId}` guard (`shouldSend`, TTL 1h, from 07-03) gates the send using `game-invite:{inviterId}:{targetUserId}:{roomCode}` as the key — a repeat invite to the same friend for the same room within the TTL window is silently deduped (still replies `{ ok: true }`).
- Registered in `main.ts` next to `roomsRoutes`, same `await app.register(...)` line style.
- `invites.test.ts`: 9 tests covering LOBBY send, non-LOBBY 403 (asserts `sendPush` not called), invalid code, missing room, unknown target, null-pushToken skip, missing-body 400, dedupe-false skip, and missing-auth 401.
- Full server suite: 123/123 tests pass across 17 files (was 114/114 before this plan — friends/push/etc. unaffected). Server `tsc --noEmit` exits clean.

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the full RED → GREEN cycle:
- **RED:** `a2fbc48` — `invites.test.ts` written first, importing the not-yet-existing `../routes/invites.js`; run confirmed failure (module resolution error, all 9 tests failed to load).
- **GREEN:** `7669fba` — `invites.ts` implemented; re-run confirmed 9/9 pass.

Note: the plan's frontmatter assigns Task 1 `<files>apps/server/src/routes/invites.ts</files>` only (test file formally listed under Task 2), but Task 1's own `<verify>` command already targets `invites.test.ts`. To resolve this without leaving Task 1's verify command unsatisfiable, the full test suite (matching Task 2's `<action>` spec for `invites.test.ts` coverage) was written during Task 1's RED step rather than deferred to Task 2. Task 2 then only performed its remaining scope: registering `invitesRoutes` in `main.ts`.

## Task Commits

1. **Task 1 — RED: failing invites.test.ts** - `a2fbc48` (test)
2. **Task 1 — GREEN: invites.ts implementation** - `7669fba` (feat)
3. **Task 2: Register invitesRoutes in main.ts** - `e250940` (feat)

## Files Created/Modified

- `apps/server/src/routes/invites.ts` (new) — `invitesRoutes` with `POST /rooms/:code/invite`
- `apps/server/src/__tests__/invites.test.ts` (new) — 9 tests, D-12 + push-send + error-path coverage
- `apps/server/src/routes/../main.ts` → `apps/server/src/main.ts` — registered `invitesRoutes`

## Decisions Made

- `target` is treated strictly as a `userId` (PINNED in the plan's interfaces section), never parsed as `닉네임#코드` — keeps this route independent of the mobile 07-05 plan's internal state shape while agreeing on the wire contract.
- Dedupe `notificationId` scoped to `(inviter, target, roomCode)` rather than just `(inviter, target)` — an invite to a different room from the same inviter to the same friend is not deduped, only a resend for the *same* room within the TTL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree checkout had no `node_modules`, generated Prisma client, built `packages/shared`, or `apps/server/.env`**
- **Found during:** Task 1, first `pnpm --filter @sketch-catch/server test` attempt
- **Issue:** Same class of gap 07-01/07-03 hit in their own fresh worktrees — none of these generated/gitignored artifacts are restored from git.
- **Fix:** `CI=true pnpm install --frozen-lockfile`, `pnpm --filter @sketch-catch/server run prisma:generate`, `pnpm --filter @sketch-catch/shared run build`, and copied the main checkout's non-secret local-dev `apps/server/.env` (gitignored, never staged).
- **Files modified:** None tracked by git.
- **Committed in:** N/A

**2. [Rule 2 - Missing critical functionality] Explicit `shouldSend()` dedupe gate before `sendPush()`**
- **Found during:** Task 1
- **Issue:** The plan's own `T-07-07-DOS` threat-model entry names "push dedupe from 07-03" as the mitigation for invite-spam DOS, but the task's `<action>` prose doesn't spell out calling `shouldSend`. Without it, the dedupe primitive built in 07-03 goes unused for this new push trigger.
- **Fix:** `shouldSend(notificationId)` gates the `sendPush` call in `invites.ts`, mirroring the pattern already used in `friends.ts`.
- **Files modified:** `apps/server/src/routes/invites.ts`
- **Committed in:** `7669fba` (Task 1 GREEN)

### Noted, Not Fixed

**T-07-07-DOS's other named mitigation — `@fastify/rate-limit` (60/min) — is not actually registered anywhere in the codebase.** The package is listed in `apps/server/package.json` but no route (including the pre-existing `friends.ts`/`rooms.ts`) registers the plugin. Adding a global rate-limit plugin to `main.ts` would affect every route, not just this one, and is an architectural decision (Rule 4) outside this plan's declared `files_modified` scope. Left as-is, consistent with every other route in the codebase; the `push:dedupe` guard (added above) still bounds duplicate-trigger spam for the specific threat the register describes.

---

**Total deviations:** 2 auto-fixed (1 Rule 3 — environment setup, non-source; 1 Rule 2 — threat-model-required dedupe call), 1 noted-but-not-fixed pre-existing gap (rate-limit plugin never registered project-wide).
**Impact on plan:** No scope creep beyond the plan's own threat-model requirements. No architectural changes, no new tables/columns, no new dependencies.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None. No external service configuration needed — reuses 07-03's already-configured `expo-server-sdk` and Redis dedupe infrastructure.

## Next Phase Readiness

- `POST /rooms/:code/invite` is live and ready for 07-05 (mobile invite UI) to call with `{ target: userId }`.
- The `data.roomCode` payload shape is ready for 07-04 (mobile push runtime tap-routing listener) to consume.
- No blockers identified for downstream plans in this wave.

---
*Phase: 07-polish*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: apps/server/src/routes/invites.ts
- FOUND: apps/server/src/__tests__/invites.test.ts
- FOUND: apps/server/src/main.ts (contains `invitesRoutes`)
- FOUND: commit a2fbc48 (Task 1 RED)
- FOUND: commit 7669fba (Task 1 GREEN)
- FOUND: commit e250940 (Task 2)
