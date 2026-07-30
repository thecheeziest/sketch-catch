---
phase: 07-polish
plan: 06
subsystem: server
tags: [socket-io, mode2, offline-handling, vitest]

# Dependency graph
requires: ["endGame(game, code, reason?) exported from apps/server/src/socket/handlers/game.ts (07-02)"]
provides:
  - "handleMode2PlayerLeft(game, code, userId) exported from apps/server/src/socket/handlers/mode2.ts"
  - "isMode2Active(status) exported from apps/server/src/socket/handlers/mode2.ts"
  - "isGameInProgressStatus(status) shared predicate in apps/server/src/socket/handlers/room.ts"
  - "ALREADY_LEFT rejoin-rejection guard in handleRoomJoin"
affects: [07-08-award-banner]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/server/src/socket/handlers/mode2.ts
    - apps/server/src/socket/handlers/room.ts
    - apps/server/src/__tests__/mode2.test.ts
    - apps/server/src/__tests__/socket-room.test.ts

key-decisions:
  - "isGameInProgressStatus() extracted as a module-level helper in room.ts shared by handleRoomJoin (rejoin guard) and handleRoomLeave (dispatch) — single source of truth for the six in-progress RoomStatus values (D-08)"
  - "MODE2_REVIEW included in isGameInProgressStatus but NOT in mode2.ts's isMode2Active — a REVIEW leave is routed to handleMode2PlayerLeft, which marks the player left but skips the sheet force-submit loop entirely (isMode2Active gate), per planner decision (Pitfall 4, option c)"

patterns-established: []

requirements-completed: [OFFL-01, OFFL-02, OFFL-03, OFFL-05]

# Metrics
duration: ~35min (includes worktree environment bootstrap: pnpm install, prisma generate, shared package build, .env copy)
completed: 2026-07-30
---

# Phase 07 Plan 06: Mode2 Leave Handler + Room-Level Mode Dispatch + Rejoin-Left Guard Summary

**New `handleMode2PlayerLeft` marks a departing mode2 player `left`, force-empty-submits any sheet they were the current-step assignee for, ends the game on `<3` active players via the shared `endGame(..., 'INSUFFICIENT_PLAYERS')`, and `room.ts` now dispatches leave events by `state.mode` across all six in-progress statuses (including `MODE2_REVIEW`) while rejecting rejoin attempts from already-left players mid-game.**

## Performance

- **Duration:** ~35 min (includes one-time worktree bootstrap: `pnpm install`, `prisma generate`, `packages/shared` build, `.env` copy — none of this touched tracked files)
- **Tasks:** 3 (all `type="auto" tdd="true"`)
- **Files modified:** 4

## Accomplishments

- `mode2.ts`: added exported `handleMode2PlayerLeft(game, code, userId)` — idempotent guard (`if (!player || player.left) return`), `<3` threshold check invoking the exported `endGame(game, code, 'INSUFFICIENT_PLAYERS')` from `game.ts` (07-02), and — when `isMode2Active(state.status)` is true — force-empty-submits the departed player's current-step sheet via `emptyContent`/`currentAssignee` then calls `checkAllSubmitted` to advance if all sheets are now submitted
- `mode2.ts`: `isMode2Active` (was local) is now exported so `room.ts` can gate the dispatch call
- `room.ts`: extracted `isGameInProgressStatus(status)` — a single predicate covering `MODE1_ROUND_START`, `MODE1_ROUND_END`, `MODE2_PROMPT_PHASE`, `MODE2_DRAW_PHASE`, `MODE2_ANSWER_PHASE`, and `MODE2_REVIEW` — shared by both `handleRoomJoin` (rejoin guard) and `handleRoomLeave` (dispatch)
- `room.ts`: `handleRoomLeave` now dispatches `if (state.mode === 2) await handleMode2PlayerLeft(...); else await handlePlayerLeft(...);` inside the in-progress branch; mode1's `handlePlayerLeft` (OFFL-04) is untouched (D-06), confirming the two leave handlers stay separate (D-08)
- `room.ts`: `handleRoomJoin`'s `existingPlayer` branch now rejects rejoin with `{ code: 'ALREADY_LEFT', message: '이미 게임에서 퇴장한 방입니다.' }` when `existingPlayer.left === true` AND the room is currently in-progress, without setting `connected = true`; rejoin after the room reaches `LOBBY`/`AWARD` (new game) still works normally
- New tests: `mode2.test.ts` (+4 tests, 11 total) covering force-empty-submit + advance, `<3` → `endGame(INSUFFICIENT_PLAYERS)` with sheet processing skipped, `MODE2_REVIEW` leave marking `left` only, and idempotent double-call; `socket-room.test.ts` (+4 tests, 15 total) covering MODE2→`handleMode2PlayerLeft`/MODE1→`handlePlayerLeft` dispatch exclusivity and `ALREADY_LEFT` rejection vs. normal LOBBY rejoin
- Full server suite: 16/16 files, 122/122 tests passing; `apps/server` typecheck (`tsc --noEmit`) clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add handleMode2PlayerLeft + export isMode2Active** - `0df5b48` (feat)
2. **Task 2: Widen isGameInProgress + mode dispatch + rejoin-left guard in room.ts** - `b09c155` (feat)
3. **Task 3: Tests for handleMode2PlayerLeft, dispatch, and rejoin guard** - `0c42efe` (test)

## Files Created/Modified

- `apps/server/src/socket/handlers/mode2.ts` - New exported `handleMode2PlayerLeft`; `isMode2Active` exported (was local); new `import { endGame } from './game.js'`
- `apps/server/src/socket/handlers/room.ts` - New module-level `isGameInProgressStatus()` helper; `handleRoomJoin` rejoin-left guard; `handleRoomLeave` mode-based dispatch; `RoomState` type import added; `handleMode2PlayerLeft` added to `./mode2.js` import
- `apps/server/src/__tests__/mode2.test.ts` - New `describe('handleMode2PlayerLeft (OFFL-05)')` block (4 tests); `game.js` mocked for `endGame` assertion; `handleMode2PlayerLeft` imported
- `apps/server/src/__tests__/socket-room.test.ts` - `mode2.js` mocked (`startMode2`, `handleMode2PlayerLeft`); new dispatch-exclusivity tests under `handleRoomLeave`; new `describe('handleRoomJoin — 재입장 거부 (left=true)')` block (2 tests)

## Decisions Made

- Extracted `isGameInProgressStatus()` rather than duplicating the six-status OR-chain in both `handleRoomJoin` and `handleRoomLeave` — keeps the rejoin guard and the leave-dispatch branch provably in sync as future statuses are added.
- Confirmed via test that `MODE2_REVIEW` is included in the *in-progress* predicate (both for rejoin-rejection and for routing leave events to `handleMode2PlayerLeft`) but excluded from `isMode2Active` — so a REVIEW-phase leave marks the player `left` and broadcasts `ROOM_STATE`, then returns immediately without touching `current.sheets`, preserving `mode2-review.ts`'s player-lookup invariants (Pitfall 4, planner's option c).
- Did not modify `handlePlayerLeft` (mode1) or its call sites at all — D-06 compliance verified via full-suite green run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `node_modules`, generated Prisma client, built `packages/shared` dist, and `apps/server/.env`**
- **Found during:** Pre-Task-1 verification dry run (`pnpm --filter @sketch-catch/shared run build` failed with `tsc: command not found`; `pnpm --filter @sketch-catch/server test` failed with `Cannot find module '.prisma/client/default'`)
- **Issue:** This is a fresh worktree checkout — `node_modules` (gitignored), `packages/shared/dist` (gitignored, per known Wave-2 gotcha), the generated Prisma client, and `apps/server/.env` (gitignored) are none of them restored by `git worktree add`.
- **Fix:** `pnpm install` (workspace root) → `pnpm --filter @sketch-catch/shared run build` → `pnpm --filter @sketch-catch/server run prisma:generate` → copied `apps/server/.env` from the main repo checkout (same file 07-02's SUMMARY already flagged as a deferred, out-of-scope gap for that plan; here it directly blocked this plan's own verification target, `mode2.test.ts`, so fixing it is in-scope per Rule 3). None of these are tracked files — no commit required or made for this fix.
- **Verification:** Full server suite (16 files / 122 tests) green; `apps/server` typecheck clean.

---

**Total deviations:** 1 auto-fixed (Rule 3 — environment bootstrap, no tracked-file changes)
**Impact on plan:** None on production code or test file scope — purely local worktree environment setup, not committed.

## TDD Gate Compliance

The plan defines this as three separate `tdd="true"` tasks: Task 1 (implement `mode2.ts`), Task 2 (implement `room.ts`), Task 3 (write tests for both). This ordering was followed literally as specified by the plan's task breakdown (Task 1/2's own `<verify>` steps only require pre-existing tests + typecheck to stay green, not new failing tests). Consequently the commit sequence is `feat` → `feat` → `test`, not a strict per-task RED-before-GREEN. No RED (failing-test) commit precedes the `feat` commits. This is a deviation from the canonical TDD gate sequence (test commit before feat commit) — flagged here per the TDD gate enforcement rule, but is a direct consequence of how the plan itself structured the three tasks, not an executor choice to skip RED.

## Issues Encountered

None beyond the environment bootstrap documented above.

## User Setup Required

None. (Worktree environment fixes are local-only, not committed, and will not be needed again once this worktree merges into the main checkout, which already has `node_modules`/dist/`.env`/Prisma client.)

## Next Phase Readiness

- Mode2's leave/rejoin/insufficient-players handling (OFFL-01/02/03/05) is complete and covered by tests.
- `handleMode2PlayerLeft`'s `endGame(game, code, 'INSUFFICIENT_PLAYERS')` call means mode2 forced-ends also populate `GameResult.endReason`, ready for 07-08's AWARD screen banner to consume identically for both modes.
- No blockers identified for downstream plans in this wave.

---
*Phase: 07-polish*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: apps/server/src/socket/handlers/mode2.ts contains `export async function handleMode2PlayerLeft`
- FOUND: apps/server/src/socket/handlers/mode2.ts contains `export function isMode2Active`
- FOUND: apps/server/src/socket/handlers/room.ts contains `isGameInProgressStatus`
- FOUND: apps/server/src/socket/handlers/room.ts contains `ALREADY_LEFT`
- FOUND: apps/server/src/__tests__/mode2.test.ts contains `handleMode2PlayerLeft (OFFL-05)`
- FOUND: apps/server/src/__tests__/socket-room.test.ts contains `재입장 거부 (left=true)`
- FOUND: commit 0df5b48 (Task 1)
- FOUND: commit b09c155 (Task 2)
- FOUND: commit 0c42efe (Task 3)
