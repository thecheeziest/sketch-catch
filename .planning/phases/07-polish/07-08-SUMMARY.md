---
phase: 07-polish
plan: 08
subsystem: mobile
tags: [expo-notifications, expo-router, expo-linking, zustand, tanstack-query, fsd]

# Dependency graph
requires:
  - phase: 07-polish (07-01)
    provides: "GameResult.endReason optional field"
  - phase: 07-polish (07-04)
    provides: "features/push/ FSD slice (registerForPushNotificationsAsync, useNotificationListeners, useRegisterPushToken, NotificationGate)"
provides:
  - "Push permission request + token registration mounted app-wide, gated on isAuthenticated && !needsOnboarding (D-13)"
  - "Notification listeners + NotificationGate (D-11) active app-wide via root _layout"
  - "AWARD screen forced-end reason banner for INSUFFICIENT_PLAYERS (D-05, OFFL-03)"
  - "Settings screen (current My Page equivalent) permission-denied recovery hint"
affects: [07-09-device-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/mobile/app/_layout.tsx
    - apps/mobile/app/room/[code]/award.tsx
    - apps/mobile/app/settings.tsx

key-decisions:
  - "apps/mobile/app/(tabs)/mypage.tsx no longer exists — renamed to apps/mobile/app/settings.tsx in commit a184b66 (2026-07-09, pre-dating this plan's authoring). Applied the permission-denied hint to settings.tsx, the screen users actually reach via ProfileHeader's gear icon."
  - "Used `Linking` from `react-native` (not `expo-linking`) for openSettings() — matches existing precedent in apps/mobile/app/room/[code]/mode2-end.tsx rather than introducing a second import source for the same API."
  - "AWARD banner uses plain colors.GRAY text (no WARNING_300 accent dot) — kept consistent with the screen's existing plain-text tone; plan listed the accent as optional."

patterns-established: []

requirements-completed: [PUSH-01, PUSH-02, PUSH-03, OFFL-03]

# Metrics
duration: ~25min
completed: 2026-07-30
---

# Phase 07 Plan 08: Push Runtime Wiring + AWARD/Settings Polish Summary

**Mounted the 07-04 push feature slice (permission request, listeners, NotificationGate) into the root `_layout.tsx`, added the insufficient-players AWARD banner, and added a persistent notification-permission recovery hint to the settings screen (My Page's current form).**

## Performance

- **Duration:** ~25 min active work
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 3

## Accomplishments

- `_layout.tsx`: new `useEffect` gated on `isAuthenticated && !needsOnboarding` calls `registerForPushNotificationsAsync()` and registers the resolved token via `useRegisterPushToken().mutate({ token })` — fires once, right after onboarding completes (D-13)
- `useNotificationListeners()` invoked at layout scope — foreground Toast + tap deep-link routing (including cold-start) now active app-wide
- `<NotificationGate />` rendered at layout scope so the D-11 room-switch confirm Dialog can appear over any screen
- Existing presence connect/disconnect effect left untouched
- `award.tsx`: conditional banner "인원이 부족해 조기 종료되었어요" rendered between the title and podium when `result?.endReason === 'INSUFFICIENT_PLAYERS'`; confirmed `useGameStore`'s `game:end` handler already assigns the full `GameResult` payload, so no store change was needed
- `settings.tsx`: on-mount `Notifications.getPermissionsAsync()` check; when not `granted`, a persistent inline row renders "알림이 꺼져 있어요. 설정에서 알림을 허용해주세요" + a `Button label="설정 열기" color="secondary" height={36}` calling `Linking.openSettings()`
- Mobile typecheck (`pnpm --filter @sketch-catch/mobile exec tsc --noEmit`) exits 0 after every task

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount permission request, listeners, and NotificationGate in _layout** - `c1cbae8` (feat)
2. **Task 2: Forced-end reason banner on the AWARD screen (D-05)** - `7e95113` (feat)
3. **Task 3: Permission-denied recovery hint on settings screen (My Page equivalent)** - `bd073ef` (feat)

## Files Created/Modified

- `apps/mobile/app/_layout.tsx` - D-13 push permission/token registration effect, `useNotificationListeners()`, `<NotificationGate />` mount
- `apps/mobile/app/room/[code]/award.tsx` - forced-end reason banner (D-05/OFFL-03)
- `apps/mobile/app/settings.tsx` - permission-denied recovery hint (Claude's Discretion item, applied to the screen that replaced My Page)

## Decisions Made

- `apps/mobile/app/(tabs)/mypage.tsx` (the plan's target file) does not exist in this codebase — it was renamed to `apps/mobile/app/settings.tsx` and moved out of the `(tabs)` group in commit `a184b66` ("화면(app/) Dripsy 마이그레이션 + settings 화면 추가", 2026-07-09), before this plan was authored (2026-07-28). Users now reach this screen via the gear icon in `ProfileHeader` (rendered on the home tab), not via a bottom-tab route. Applied the permission-denied hint to `settings.tsx` since that is the functional continuation of "My Page" today — this satisfies the plan's intent (offer a persistent path to re-enable notifications) even though the literal file path changed.
- Used `Linking` from `react-native` instead of `expo-linking` for `openSettings()` — `apps/mobile/app/room/[code]/mode2-end.tsx` already calls `Linking.openSettings()` via the `react-native` import for an identical purpose (GIF-save permission recovery); reusing that import source avoids a second, redundant way to call the same OS API.
- Skipped the plan's optional `colors.WARNING_300` accent dot on the AWARD banner — kept it as plain `colors.GRAY` body text to match the screen's existing unaccented tone (podium/ranking text uses no accent markers either).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `apps/mobile/app/(tabs)/mypage.tsx` does not exist — retargeted Task 3 to `apps/mobile/app/settings.tsx`**
- **Found during:** Task 3 (read_first step)
- **Issue:** The plan's `files_modified` and Task 3 both target `apps/mobile/app/(tabs)/mypage.tsx`, but this file was deleted and its content moved to `apps/mobile/app/settings.tsx` (outside the tabs group) in commit `a184b66`, well before the plan was written. The literal path referenced by the plan does not exist on this worktree's base commit.
- **Fix:** Implemented the identical acceptance criteria (persistent hint, "설정 열기" button, `Linking.openSettings()`, shown only when permission is not granted) on `apps/mobile/app/settings.tsx` instead — the screen that is now reached via `ProfileHeader`'s gear icon and serves the same "account settings" role `mypage.tsx` used to.
- **Files modified:** `apps/mobile/app/settings.tsx`
- **Verification:** `grep -q "openSettings" apps/mobile/app/settings.tsx` passes; `pnpm --filter @sketch-catch/mobile exec tsc --noEmit` exits 0.
- **Committed in:** `bd073ef`

**2. [Rule 3 - Blocking] Ran `pnpm install --frozen-lockfile` + rebuilt `packages/shared`**
- **Found during:** Task 1 (before first typecheck)
- **Issue:** Fresh worktree checkout had no `node_modules` and `packages/shared/dist` was absent (gitignored, not restored from git) — matches the known Wave 2 gotcha documented in the parallel-execution context.
- **Fix:** Ran `pnpm install --frozen-lockfile` at the workspace root, then `pnpm --filter @sketch-catch/shared run build`.
- **Files modified:** None (frozen-lockfile install, no `pnpm-lock.yaml` diff; `dist/` is gitignored).
- **Verification:** Subsequent `pnpm --filter @sketch-catch/mobile exec tsc --noEmit` ran successfully.
- **Committed in:** N/A (no tracked file changes from this step)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 stale-path retarget, 1 Rule 3 environment setup)
**Impact on plan:** No scope creep. The mypage→settings retarget preserves the plan's exact intent and acceptance criteria against the file that actually serves that role today; the environment setup step was a known, documented prerequisite.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — this plan only wires already-built client-side push infrastructure into the app and adds UI copy. No external service configuration required. End-to-end push delivery/tap/permission behavior verification on a physical device is explicitly deferred to 07-09 per this plan's `<verification>` section.

## Next Phase Readiness

- Push runtime (permission request, listeners, NotificationGate) is fully mounted app-wide; ready for 07-09 device-level verification.
- AWARD screen and settings screen polish items for this wave are complete.
- Flag for orchestrator/future plans: `apps/mobile/app/(tabs)/mypage.tsx` is stale in any remaining phase documentation — the current file is `apps/mobile/app/settings.tsx` (outside the tabs group, reached via `ProfileHeader`'s gear icon). No other 07-polish plan references this path.

---
*Phase: 07-polish*
*Completed: 2026-07-30*
