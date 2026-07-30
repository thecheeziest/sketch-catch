---
phase: 07-polish
plan: 02
subsystem: server
tags: [socket-io, mode1, offline-handling, vitest]

# Dependency graph
requires: ["GameResult.endReason optional field from 07-01"]
provides:
  - "endGame(game, code, reason?) exported from apps/server/src/socket/handlers/game.ts"
  - "mode1 handlePlayerLeft <3 threshold (D-03) with endReason: 'INSUFFICIENT_PLAYERS' emission"
affects: [07-06-mode2-leave-handler, 07-08-award-banner]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/server/src/socket/handlers/game.ts
    - apps/server/src/__tests__/game.test.ts

key-decisions:
  - "endGame's third param typed as literal 'INSUFFICIENT_PLAYERS' (not a general string) to match GameResult.endReason's narrow union and prevent typos at call sites"
  - "Round-invalidation/turn-reassignment logic (D-06) left untouched — only the threshold comparison and endGame signature changed"

patterns-established: []

requirements-completed: [OFFL-03]

# Metrics
duration: ~15min (active work; interrupted once by an API session-limit error mid Task 2, resumed via coordinator handoff)
completed: 2026-07-30
---

# Phase 07 Plan 02: Mode1 Insufficient-Players Threshold + endGame Reason Summary

**Mode1 `handlePlayerLeft` now ends the game immediately when active players drop below 3 (was ≤1), and the shared `endGame` function is exported with an optional `reason` parameter so `game:end` carries `endReason: 'INSUFFICIENT_PLAYERS'` on forced ends and `undefined` on normal round-exhaustion ends.**

## Performance

- **Duration:** ~15 min active work across 2 tasks
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 2

## Accomplishments

- `handlePlayerLeft`'s insufficient-players threshold changed from `activePlayers.length <= 1` to `activePlayers.length < 3` (D-03)
- `endGame` is now `export`ed with an optional third parameter `reason?: 'INSUFFICIENT_PLAYERS'`, and the `game:end` emit payload includes `endReason: reason` (satisfies `GameResult.endReason` from 07-01)
- Eviction-triggered call site (`handlePlayerLeft`) now calls `endGame(game, code, 'INSUFFICIENT_PLAYERS')`; normal round-exhaustion call site (`endRound`) still calls `endGame(game, code)` with no third arg, so `endReason` is `undefined` for normal ends
- Round-invalidation/turn-reassignment logic (lines untouched) and the idempotent-leave guard (`if (!player || player.left) return;`) preserved exactly as-is per D-06
- Three new unit tests added covering: (A) 3→2 players triggers `game:end` with `endReason: 'INSUFFICIENT_PLAYERS'`, (B) 4→3 players does NOT emit `game:end` (round-invalidation path taken instead), (C) idempotent guard — calling `handlePlayerLeft` twice for an already-left player does not double-process or double-emit
- `apps/server` typecheck (`tsc --noEmit`) clean
- `game.test.ts` full file: 18/18 passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Change threshold to <3, thread reason through endGame, export endGame** - `bddeb5d` (feat)
2. **Task 2: Unit tests for <3 threshold and endReason** - `aacb680` (test)

## Files Created/Modified

- `apps/server/src/socket/handlers/game.ts` - Threshold `<=1` → `<3`; `endGame` exported with optional `reason` param; `endReason` added to `game:end` payload
- `apps/server/src/__tests__/game.test.ts` - New `describe('handlePlayerLeft 인원부족 종료 (OFFL-03)')` block with 3 tests; imported `handlePlayerLeft`; `mockGetRoomState.mockReset()` added to that describe's `beforeEach`

## Decisions Made

- `reason` parameter typed as the literal `'INSUFFICIENT_PLAYERS'` rather than a broader string, matching `GameResult.endReason`'s narrow union (`'NORMAL' | 'INSUFFICIENT_PLAYERS'`) and giving compile-time protection against typos at future call sites (e.g., the 07-06 mode2 leave handler).
- Kept D-06's round-invalidation/turn-reassignment block completely untouched — only the `if` condition and the two `endGame` call sites were edited, as specified by the plan's `<action>`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing test-order-dependent mock leak in `game.test.ts`**
- **Found during:** Task 2 (running the full `game.test.ts` file after adding the new `describe` block — new tests failed only when run as part of the full suite, not in isolation)
- **Issue:** The existing `'round timer: drawTimer초 후 자동으로 MODE1_ROUND_END 전이'` test (pre-existing, not part of this plan) queues `mockGetRoomState.mockResolvedValueOnce(null)` intended to guard against an assumed `endGame` call, but the code path actually taken (round 0 of 9 total turns) schedules the *next* round via `setTimeout` instead of calling `endGame` — so that queued `null` value is never consumed within that test. Because `vi.clearAllMocks()` (used in every `beforeEach` in this file) clears call-history but does **not** clear queued `mockResolvedValueOnce` implementations, that orphaned `null` sat at the front of the mock's queue and was silently consumed by the first `getRoomState()` call in my new tests (once the new `describe` block was appended and actually executed as part of the full file run), shifting later calls and producing test-order-dependent false failures.
- **Fix:** Added `mockGetRoomState.mockReset();` to my new describe block's `beforeEach`, purging any leaked queued values from earlier tests before each of my tests runs. Scoped to my own describe block only — the pre-existing `'round timer'` test itself was not modified (out of scope, and it passes on its own; the dangling queued value is harmless to itself, only to whatever consumes it later).
- **Files modified:** `apps/server/src/__tests__/game.test.ts` (already in this task's file scope)
- **Verification:** `pnpm --filter @sketch-catch/server test -- game.test.ts` → 18/18 passing (previously 17/18 with the new "3 remain → no game:end" test failing due to the leaked value)
- **Committed in:** `aacb680` (same commit as the new tests, since the fix is inseparable from making the new tests reliable)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug, pre-existing test isolation issue exposed by adding new tests, fixed within the already-in-scope test file)
**Impact on plan:** No scope creep — the fix lives entirely in `game.test.ts`, which was already this plan's target file. No production code beyond what the plan specified was touched.

## Deferred Issues (out of scope, logged to deferred-items.md)

- `apps/server/.env` is absent in this worktree (only `.env.example` present), causing 7 unrelated test files (`task1.test.ts`, `mode2.test.ts`, etc.) to fail via `process.exit(1)` in `src/lib/env.ts`'s Zod validation when the full `pnpm --filter @sketch-catch/server test` (no filter) is run. This is a pre-existing worktree environment gap unrelated to `game.ts`/`game.test.ts` — not fixed, logged to `.planning/phases/07-polish/deferred-items.md` per the scope-boundary rule. This plan's own verification target (`game.test.ts`) is unaffected and passes 18/18 both in isolation and as part of the full run.

## Issues Encountered

- Execution was interrupted mid-Task-2 by an API session-limit error (infrastructure issue, not a task failure). Recovered per coordinator instruction: Task 1's commit (`bddeb5d`) was already in place; resumed from the uncommitted `game.test.ts` changes, diagnosed and fixed the test failure (see Deviations above), verified 18/18 green, then committed Task 2 (`aacb680`).

## User Setup Required

None.

## Next Phase Readiness

- `endGame(game, code, reason?)` is now exported and ready for 07-06's `handleMode2PlayerLeft` (mode2 leave handler, D-08) to import and reuse for its own insufficient-players forced-end path.
- `GameResult.endReason` is populated end-to-end from mode1's forced-end path, ready for 07-08's AWARD screen banner (D-05: "인원이 부족해 조기 종료되었어요") to consume via `useGameStore result.endReason`.
- No blockers identified for downstream plans in this wave.

---
*Phase: 07-polish*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: apps/server/src/socket/handlers/game.ts contains `export async function endGame`
- FOUND: apps/server/src/socket/handlers/game.ts contains `if (activePlayers.length < 3)`
- FOUND: apps/server/src/socket/handlers/game.ts does NOT contain `activePlayers.length <= 1`
- FOUND: apps/server/src/__tests__/game.test.ts contains `INSUFFICIENT_PLAYERS`
- FOUND: commit bddeb5d (Task 1)
- FOUND: commit aacb680 (Task 2)
