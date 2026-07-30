---
phase: 07-polish
plan: 04
subsystem: mobile
tags: [expo-notifications, push, zustand, tanstack-query, expo-router, fsd]

# Dependency graph
requires: ["expo-notifications@~0.28.19 installed in apps/mobile (07-01)"]
provides:
  - "registerForPushNotificationsAsync (permission request + Expo push token retrieval, SDK51-safe)"
  - "useRegisterPushToken (POST /me/push-token mutation)"
  - "usePushStore (pendingInviteRoomCode for D-11 gate)"
  - "useNotificationListeners (foreground Toast + tap deep-link routing hook)"
  - "NotificationGate (D-11 room-switch confirm Dialog component)"
affects: [07-08-award-banner]

# Tech tracking
tech-stack:
  added: []
  patterns: ["features/push/ FSD slice (lib/api/model/ui)"]

key-files:
  created:
    - apps/mobile/src/features/push/lib/registerForPushNotificationsAsync.ts
    - apps/mobile/src/features/push/api/useRegisterPushToken.ts
    - apps/mobile/src/features/push/model/usePushStore.ts
    - apps/mobile/src/features/push/lib/useNotificationListeners.ts
    - apps/mobile/src/features/push/ui/NotificationGate/index.tsx
  modified: []

key-decisions:
  - "setNotificationHandler uses shouldShowAlert (not shouldShowBanner/shouldShowList) — installed expo-notifications@0.28.19's NotificationBehavior type requires the older single-flag shape (RESEARCH A4 fallback confirmed, not the split flags)"
  - "Toast message = concatenated `${title} ${body}`.trim() — Toast store type NOT extended (RESEARCH Open Question 2 resolution)"
  - "Room join/leave via raw socket.emit(CLIENT_EVENT.ROOM_JOIN/ROOM_LEAVE) — no store action exists, mirrors room/[code]/index.tsx pattern exactly"

patterns-established: []

requirements-completed: [PUSH-01, PUSH-02, PUSH-03]

# Metrics
duration: ~20min
completed: 2026-07-30
---

# Phase 07 Plan 04: Mobile Push Runtime (features/push/) Summary

**Built the `features/push/` FSD slice: SDK51-safe permission/token registration, a TanStack mutation to POST the token, notification listeners showing a foreground Toast (D-10) and routing taps (Pattern 3, with cold-start handling), a pending-invite Zustand store, and a `NotificationGate` component rendering the D-11 room-switch confirm Dialog.**

## Performance

- **Duration:** ~20 min active work
- **Tasks:** 3 (all `type="auto"`)
- **Files created:** 5

## Accomplishments

- `registerForPushNotificationsAsync.ts`: Android notification channel created before permission request (Pitfall 2), `getPermissionsAsync`/conditional `requestPermissionsAsync`, `getExpoPushTokenAsync({ projectId })` reading `Constants.expoConfig?.extra?.eas?.projectId`; module-scope `setNotificationHandler` suppresses the OS banner while foregrounded (D-10)
- `useRegisterPushToken.ts`: TanStack `useMutation` POSTing `{ token }` to `/me/push-token`, shaped identically to `useUpdateMe.ts`
- `usePushStore.ts`: zustand+immer store holding `pendingInviteRoomCode: string | null` for the D-11 gate
- `useNotificationListeners.ts`: registers `addNotificationReceivedListener` (foreground → `useToastStore.getState().show(...)`) and `addNotificationResponseReceivedListener` (tap → route), plus a one-time `getLastNotificationResponseAsync()` call for cold-start taps (Pitfall 3); tap handler routes to `/(tabs)/friends` when no `roomCode`, joins directly via raw `socket.emit(CLIENT_EVENT.ROOM_JOIN, ...)` when not already in a room, or defers to `usePushStore.setPendingInvite(...)` when already in another room
- `NotificationGate/index.tsx`: renders `Dialog` gated on `pendingInviteRoomCode`, with verbatim UI-SPEC copy ("방을 이동할까요?" / "현재 방에서 나가고 초대된 방으로 이동할까요?" / "취소" / "이동하기"); confirm handler raw-emits `ROOM_LEAVE` then `ROOM_JOIN` on the room socket, navigates, and clears pending
- Mobile typecheck (`pnpm --filter @sketch-catch/mobile exec tsc --noEmit`) exits 0 after each task

## Task Commits

Each task was committed atomically:

1. **Task 1: registerForPushNotificationsAsync + useRegisterPushToken + foreground handler** - `7ffc9b5` (feat)
2. **Task 2: usePushStore + useNotificationListeners** - `7e99c4c` (feat)
3. **Task 3: NotificationGate (D-11 room-switch confirm Dialog)** - `2ea7b6e` (feat)

## Files Created/Modified

- `apps/mobile/src/features/push/lib/registerForPushNotificationsAsync.ts` - permission + token registration, module-scope foreground-banner suppression
- `apps/mobile/src/features/push/api/useRegisterPushToken.ts` - token-POST mutation
- `apps/mobile/src/features/push/model/usePushStore.ts` - pending-invite state
- `apps/mobile/src/features/push/lib/useNotificationListeners.ts` - foreground Toast + tap routing + cold-start handling
- `apps/mobile/src/features/push/ui/NotificationGate/index.tsx` - D-11 confirm Dialog

## Decisions Made

- Used `shouldShowAlert: false` (not the `shouldShowBanner`/`shouldShowList` split flags shown in RESEARCH Pattern 2) because the actually-installed `expo-notifications@0.28.19`'s `NotificationBehavior` type requires the older single-flag shape — `tsc` failed with `Property 'shouldShowAlert' is missing` when the split flags were used. This is exactly the RESEARCH A4 fallback the plan's `<interfaces>` section anticipated ("Fallback to `shouldShowAlert: false` if the installed 0.28.x minor lacks the split flags").
- Toast message composed as `${title} ${body}`.trim() per RESEARCH Open Question 2's resolution — Toast store's single-string `show(message)` API left untouched.
- Room join/leave implemented as raw `socket.emit(CLIENT_EVENT.ROOM_JOIN/ROOM_LEAVE, ...)` calls (no `useRoomStore` action exists for this) — mirrors the exact pattern already used in `app/room/[code]/index.tsx` (lines 44, 106).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `pnpm install --frozen-lockfile` at plan start**
- **Found during:** Task 1 (typecheck verification step)
- **Issue:** Fresh worktree checkout had no `node_modules` (`tsc: command not found`).
- **Fix:** Ran `pnpm install --frozen-lockfile` at the workspace root (no lockfile diff).
- **Files modified:** None (frozen-lockfile install).
- **Verification:** Subsequent `pnpm --filter @sketch-catch/mobile exec tsc --noEmit` ran successfully.
- **Committed in:** N/A (no tracked file changes from this step)

**2. [Rule 1 - Bug] `setNotificationHandler` shape corrected to match installed package's type**
- **Found during:** Task 1 typecheck
- **Issue:** The plan's `<interfaces>` primary example used `shouldShowBanner`/`shouldShowList` (RESEARCH Pattern 2), but the installed `expo-notifications@0.28.19`'s `NotificationBehavior` type only has `shouldShowAlert`/`shouldPlaySound`/`shouldSetBadge` — `tsc` failed with a missing-property error.
- **Fix:** Used `shouldShowAlert: false` instead, exactly matching the fallback the plan itself specified in `<interfaces>` ("RESEARCH A4").
- **Files modified:** `apps/mobile/src/features/push/lib/registerForPushNotificationsAsync.ts`
- **Verification:** `tsc --noEmit` exits 0.
- **Committed in:** `7ffc9b5`

---

**Total deviations:** 2 auto-fixed (1 Rule 3 environment setup, 1 Rule 1 type-shape correction already anticipated by the plan's own fallback note)
**Impact on plan:** No scope creep. Both fixes were either environment prerequisites or a pre-anticipated fallback path explicitly named in the plan.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — this plan only builds the client-side push feature slice; it is not yet mounted into `_layout.tsx` (that's 07-08). No runtime/device testing was performed or required at this stage.

## Next Phase Readiness

- `features/push/` (lib/api/model/ui) is complete and typechecks clean, ready for 07-08 to mount `useNotificationListeners()` + `<NotificationGate />` into the root layout and call `registerForPushNotificationsAsync()` + `useRegisterPushToken()` post-onboarding (D-13).
- No blockers identified for downstream plans.

---
*Phase: 07-polish*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: apps/mobile/src/features/push/lib/registerForPushNotificationsAsync.ts
- FOUND: apps/mobile/src/features/push/api/useRegisterPushToken.ts
- FOUND: apps/mobile/src/features/push/model/usePushStore.ts
- FOUND: apps/mobile/src/features/push/lib/useNotificationListeners.ts
- FOUND: apps/mobile/src/features/push/ui/NotificationGate/index.tsx
- FOUND: commit 7ffc9b5 (Task 1)
- FOUND: commit 7e99c4c (Task 2)
- FOUND: commit 2ea7b6e (Task 3)
