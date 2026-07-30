---
phase: 07-polish
plan: 01
subsystem: infra
tags: [expo-notifications, expo-server-sdk, typescript, pnpm-workspace, push-notifications]

# Dependency graph
requires: []
provides:
  - "GameResult.endReason optional field ('NORMAL' | 'INSUFFICIENT_PLAYERS') for forced-end paths"
  - "expo-notifications@~0.28.19 installed in apps/mobile (SDK51-compatible)"
  - "expo-server-sdk@^6.1.0 installed in apps/server"
affects: [07-02-game-ts, 07-03-push-service, 07-04-mobile-push-runtime, 07-08-award-banner]

# Tech tracking
tech-stack:
  added: [expo-notifications@~0.28.19, expo-server-sdk@^6.1.0]
  patterns: []

key-files:
  created: []
  modified:
    - packages/shared/src/types/game.ts
    - apps/mobile/package.json
    - apps/server/package.json
    - pnpm-lock.yaml

key-decisions:
  - "GameResult.endReason kept optional to preserve backward compatibility with existing game:end emit call sites"
  - "expo-notifications installed via `npx expo install` (not `pnpm add`) to resolve SDK51-aligned 0.28.x line instead of npm-latest 57.x"

patterns-established: []

requirements-completed: [OFFL-03, PUSH-01, PUSH-02, PUSH-03]

# Metrics
duration: ~15min (active work; excludes blocking-human checkpoint wait time)
completed: 2026-07-30
---

# Phase 07 Plan 01: Shared Foundation (endReason + Push Dependencies) Summary

**GameResult extended with optional endReason field; expo-notifications (0.28.19, SDK51-aligned) and expo-server-sdk (6.1.0) installed and typechecked clean across mobile/server workspaces.**

## Performance

- **Duration:** ~15 min active work (task 1 + task 3), separated by a blocking-human package-legitimacy checkpoint
- **Tasks:** 3 (1 auto, 1 checkpoint:human-verify, 1 auto)
- **Files modified:** 4

## Accomplishments
- `GameResult` now carries an optional `endReason?: 'NORMAL' | 'INSUFFICIENT_PLAYERS'` field, following the existing optional-field convention in the same file (`RoundStart.needsCustomPrompt?`)
- Shared package rebuilt (`pnpm --filter @sketch-catch/shared build`); `packages/shared/dist/types/game.d.ts` confirmed to contain `endReason` (dist is gitignored, not committed — rebuilt by downstream consumers/CI)
- Package legitimacy verified by human at the blocking-human checkpoint (both `expo-notifications` and `expo-server-sdk` confirmed first-party Expo packages on npmjs.com)
- `expo-notifications@~0.28.19` installed in `apps/mobile` via `npx expo install` (SDK51-compatible line, not the npm-latest `57.x` line — Pitfall 1 avoided)
- `expo-server-sdk@^6.1.0` installed in `apps/server` via `pnpm add`
- Both workspaces typecheck clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GameResult with optional endReason and rebuild shared** - `e991d9b` (feat)
2. **Task 2: Package legitimacy verification** - checkpoint only, no code change, human approved via chat ("approved — proceed with Task 3")
3. **Task 3: Install expo-notifications (mobile) and expo-server-sdk (server)** - `adc484e` (feat)

## Files Created/Modified
- `packages/shared/src/types/game.ts` - Added `endReason?: 'NORMAL' | 'INSUFFICIENT_PLAYERS'` to `GameResult`
- `apps/mobile/package.json` - Added `expo-notifications: ~0.28.19`
- `apps/server/package.json` - Added `expo-server-sdk: ^6.1.0`
- `pnpm-lock.yaml` - Lockfile updated for both new dependencies

## Decisions Made
- `endReason` kept optional (not required) so existing `game:end` emit call sites across the codebase remain valid without modification — matches the additive-field convention already used for `RoundStart.needsCustomPrompt?`.
- Used `npx expo install expo-notifications` rather than `pnpm add expo-notifications` specifically to let Expo's dependency resolver pin the SDK51-compatible `~0.28.19` version instead of npm's "latest" `57.x` line (per 07-RESEARCH.md Pitfall 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `prisma generate` before server typecheck**
- **Found during:** Task 3 (server typecheck verification step)
- **Issue:** Fresh worktree checkout had `node_modules` freshly installed via `pnpm install --frozen-lockfile` but the Prisma client had never been generated (`node_modules/.prisma/client` did not exist), causing `tsc --noEmit` to fail with `Module '"@prisma/client"' has no exported member 'PrismaClient'` and similar errors across `prisma.ts`, `me.service.ts`, `replay.service.ts`, `user.service.ts`, `match.service.ts`. This was unrelated to the `expo-server-sdk` install itself — it was a missing generated artifact blocking verification of Task 3's acceptance criteria.
- **Fix:** Ran `pnpm prisma:generate` in `apps/server` (standard, idempotent, no schema changes).
- **Files modified:** None tracked by git (generated client lives in `node_modules`, not committed).
- **Verification:** `pnpm --filter @sketch-catch/server exec tsc -p tsconfig.json --noEmit` exits clean after generation.
- **Committed in:** N/A (generated artifact, not a source change; no commit needed)

**2. [Rule 3 - Blocking] Ran `pnpm install --frozen-lockfile` at plan start**
- **Found during:** Task 1 (shared package build verification step)
- **Issue:** The worktree checkout had no `node_modules` at all (`pnpm --filter @sketch-catch/shared build` failed with `tsc: command not found`).
- **Fix:** Ran `pnpm install --frozen-lockfile` at the workspace root to materialize `node_modules` from the existing lockfile (no lockfile changes at this step).
- **Files modified:** None (frozen-lockfile install, no `pnpm-lock.yaml` diff).
- **Verification:** Subsequent `pnpm --filter @sketch-catch/shared build` succeeded.
- **Committed in:** N/A (no tracked file changes from this step)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, both pre-existing worktree setup gaps unrelated to plan content)
**Impact on plan:** Both auto-fixes were prerequisite environment setup steps (dependency install, Prisma client generation) required to run the plan's own verification commands. No scope creep — no source files touched beyond what the plan specified.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required for this plan. (Push notification credentials/Expo project setup, if needed, will be addressed in downstream plans that actually send notifications, e.g. 07-03/07-04.)

## Next Phase Readiness

- `GameResult.endReason` is available for 07-02 (game.ts forced-end logic) and 07-08 (AWARD screen banner) to consume.
- `expo-notifications` is ready for 07-04 (mobile push runtime) to build permission requests, token registration, and notification handlers on top of.
- `expo-server-sdk` is ready for 07-03 (push.service.ts) to build server-side push dispatch on top of.
- No blockers identified for downstream plans in this wave.

---
*Phase: 07-polish*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: packages/shared/src/types/game.ts (contains `endReason`)
- FOUND: packages/shared/dist/types/game.d.ts (contains `endReason`, gitignored, rebuilt)
- FOUND: apps/mobile/package.json dependencies['expo-notifications'] = ~0.28.19
- FOUND: apps/server/package.json dependencies['expo-server-sdk'] = ^6.1.0
- FOUND: commit e991d9b (Task 1)
- FOUND: commit adc484e (Task 3)
- FOUND: commit 5af6bb1 (SUMMARY.md)
