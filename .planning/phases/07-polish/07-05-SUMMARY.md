---
phase: 07-polish
plan: 05
subsystem: ui
tags: [react-native, expo, dripsy, tanstack-query, invite, push-03]

# Dependency graph
requires:
  - phase: 07-polish (07-01)
    provides: shared FA_ICONS/Icon component conventions and room screen structure this plan extends
provides:
  - INVITE FontAwesome icon entry (`paper-plane`) in `@/shared/ui/Icon`
  - `useInvite(code)` TanStack mutation hook POSTing `/rooms/:code/invite` with `{ target: userId }`
  - `InviteModal` friend-picker Dialog (inline row copying `FriendItem` visual tokens, per-row send, stays open for multiple invites)
  - LOBBY-gated invite trigger wired into the Lobby header (`room/[code]/index.tsx`)
affects: [07-07 (server invite route — must match `{ target: userId }` contract and 403 GAME_IN_PROGRESS response), 07-08 (device checkpoint for end-to-end invite verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side D-12 defense-in-depth gate: hide the invite trigger entirely (not disable) when `roomState?.status !== 'LOBBY'`; authoritative check lives server-side in 07-07"
    - "Invite body contract: `target = friend.userId` (raw userId, no `닉네임#코드` parsing client-side)"

key-files:
  created:
    - apps/mobile/src/features/room/api/useInvite.ts
    - apps/mobile/src/features/room/ui/InviteModal/index.tsx
  modified:
    - apps/mobile/src/shared/ui/Icon/index.tsx
    - apps/mobile/app/room/[code]/index.tsx
    - apps/mobile/src/features/room/api/index.ts
    - apps/mobile/src/features/room/ui/index.ts

key-decisions:
  - "FA_ICONS.INVITE = 'paper-plane' (confirmed present in the installed @expo/vector-icons FontAwesome glyphmap before committing, per CLAUDE.md 'API 시그니처는 실제 타입으로 확인')"
  - "InviteModal builds its own row inline instead of reusing FriendItem (FriendItem hardcodes its trailing action to onJoin/'같이하기' with no prop to swap it) — matches plan's explicit 'do not touch adjacent code' instruction"
  - "Single useInvite(code) mutation instance shared across all rows in InviteModal (not per-row hooks), since target varies per mutate() call rather than per hook instance — avoids violating rules-of-hooks inside renderItem"
  - "Invite icon wrapped in a dedicated Pressable with hitSlop={12} instead of Icon's built-in onPress (which hardcodes hitSlop={8}) to reach the 44px touch target per UI-SPEC"

patterns-established:
  - "LOBBY-only UI gate pattern: `{roomState?.status === 'LOBBY' && <Pressable .../>}`  — reusable for any future host-lobby-only action"

requirements-completed: [PUSH-03]

# Metrics
duration: multi-session (session interrupted by API limit between Task 1 and Task 2, resumed from committed state)
completed: 2026-07-30
---

# Phase 07 Plan 05: Invite Send UI Summary

**LOBBY-gated invite icon in the room header opens a friend-picker Dialog whose rows send `POST /rooms/:code/invite` with `{ target: friend.userId }` and stay open for repeated sends.**

## Performance

- **Duration:** multi-session (interrupted mid-plan by an API session-limit error after Task 1's commit; resumed and completed Tasks 2-3 in a follow-up session)
- **Started:** 2026-07-30T16:17:34+09:00 (Task 1 commit)
- **Completed:** 2026-07-30T17:55:34+09:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 6 (2 created, 4 modified/extended)

## Accomplishments
- `FA_ICONS.INVITE` glyph entry + `useInvite(code)` mutation hook, both typechecked clean
- `InviteModal` friend-picker Dialog: inline rows (presence dot, avatar, nickname, presence label) + per-row "초대" `Button` calling `useInvite(code).mutate({ target: friend.userId })`, success/error Toasts, empty-state copy, dialog stays open across multiple sends
- Lobby header now renders the invite trigger only while `roomState?.status === 'LOBBY'` (D-12 client-side defense-in-depth), wrapped in `Pressable hitSlop={12}` for the 44px touch target, opening `InviteModal` with the current room `code`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add INVITE icon + useInvite mutation hook** - `4dad0bf` (feat)
2. **Task 2: InviteModal friend-picker Dialog** - `b502a54` (feat)
3. **Task 3: Wire LOBBY-gated invite icon into the Lobby header** - `25e2eb1` (feat)

_No TDD tasks in this plan — all three are `type="auto"` without `tdd="true"`._

## Files Created/Modified
- `apps/mobile/src/shared/ui/Icon/index.tsx` - Added `INVITE: 'paper-plane'` to `FA_ICONS`
- `apps/mobile/src/features/room/api/useInvite.ts` - `useMutation<{ ok: true }, ApiError, { target: string }>` POSTing `/rooms/${code}/invite`
- `apps/mobile/src/features/room/ui/InviteModal/index.tsx` - Friend-picker `Dialog` with inline `FlatList` rows + per-row invite send
- `apps/mobile/app/room/[code]/index.tsx` - LOBBY-gated invite icon trigger + `InviteModal` render wired to local `inviteOpen` state
- `apps/mobile/src/features/room/api/index.ts` - Barrel export for `useInvite`
- `apps/mobile/src/features/room/ui/index.ts` - Barrel export for `InviteModal`

## Decisions Made
- Confirmed `paper-plane` exists in the installed `@expo/vector-icons` FontAwesome glyphmap (checked `FontAwesome.json` directly) rather than assuming from memory, per CLAUDE.md's API-signature-verification rule.
- Did not reuse `FriendItem` for picker rows (it hardcodes its trailing action to `onJoin`/"같이하기" with no swap prop); built a minimal inline row in `InviteModal` copying its visual tokens instead, keeping `FriendItem` untouched per plan interfaces.
- Instantiated `useInvite(code)` once at the `InviteModal` component level (not per-row) since the mutation's `target` varies per `mutate()` call — avoids calling hooks conditionally/in a loop inside `renderItem`.

## Deviations from Plan

None - plan executed exactly as written. One infrastructure adjustment was required to run automated verification (see Issues Encountered) but did not change any plan-scoped code.

## Issues Encountered
- The git worktree used for this parallel executor had no `node_modules` installed (fresh worktree checkout, `pnpm-lock.yaml` identical to the main checkout). Symlinked `node_modules` (root, `apps/mobile`, `apps/server`, `packages/shared`) to the main repo's installed `node_modules` to run `tsc --noEmit` for verification. `node_modules` is gitignored, so these symlinks are not tracked and do not appear in any commit.
- Execution was interrupted mid-plan by an API session-limit error after Task 1's commit (`4dad0bf`) landed cleanly. Resumed in a follow-up session; verified the prior commit and worktree HEAD state before continuing with Tasks 2-3, per the coordinator's resume instructions.

## User Setup Required

None - no external service configuration required. (The server-side invite route enforcing D-12 and consuming this contract is 07-07, not yet executed as of this plan.)

## Next Phase Readiness
- Client invite-send UX is complete and typechecks cleanly against the pinned `{ target: friend.userId }` contract.
- 07-07 (server invite route) must implement `POST /rooms/:code/invite` accepting `{ target: string }` (a raw `userId`), re-validate `LOBBY` status server-side (403 `GAME_IN_PROGRESS` on race), and resolve the push token from that `userId`.
- End-to-end invite send/receive verification is deferred to 07-08's device checkpoint, as scoped by this plan's `<verification>` section.

---
*Phase: 07-polish*
*Completed: 2026-07-30*
