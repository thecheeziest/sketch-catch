# Deferred Items — Phase 07 Polish

## 07-02: Pre-existing worktree env gap (out of scope)

- **Found during:** 07-02 Task 2 verification (`pnpm --filter @sketch-catch/server test` full run)
- **Issue:** `apps/server/.env` is absent in this worktree (only `.env.example` present), causing `src/lib/env.ts` Zod validation to `process.exit(1)` for any test file that imports `src/db/prisma.ts` or `src/auth/kakao.ts` transitively (`task1.test.ts`, `mode2.test.ts`, and 5 other files — 7 test files / 4 assertions fail).
- **Scope:** Unrelated to `apps/server/src/socket/handlers/game.ts` or `apps/server/src/__tests__/game.test.ts` (this plan's files). The main repo checkout has `.env` present; only this worktree lacks it (worktree creation does not copy gitignored `.env`).
- **Action taken:** None — out of scope per executor scope-boundary rule. `game.test.ts` (this plan's verification target) passes cleanly (18/18) in isolation and as part of the full run.
- **Recommendation:** Orchestrator/environment setup should copy or symlink `apps/server/.env` into new worktrees, or document that `.env`-dependent test files are expected to fail in isolated worktree contexts until merged back.
