---
phase: 06-leaderboards-real-time
plan: "02"
subsystem: ui
tags: [react, socket.io-client, zustand, websockets, leaderboard, real-time]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Socket.IO server with leaderboard:update broadcast and balance:update push at all 11 game settlements"
  - phase: 02-auth-accounts
    provides: "AuthContext, getAccessToken() from api/client"
  - phase: 03-wallet-currency
    provides: "useBalanceStore with setBalance() used for balance:update handler"
provides:
  - "socket.ts — singleton socket.io-client instance with autoConnect:false and auth callback using getAccessToken()"
  - "leaderboardStore.ts — Zustand v5 store for snapshot, ownRanks, activeTab"
  - "useLeaderboard hook — guest-safe socket connection, leaderboard:update listener with cleanup and conditional disconnect"
  - "LeaderboardPage at /leaderboard — public page with three tabs, top-25 table, own-rank highlight/pin, skeleton loading"
  - "AuthContext socket lifecycle — connect on accessToken present, disconnect on sign-out/session-expired, balance:update handler"
  - "Header Leaderboard nav link visible on all pages using the Header component"
affects:
  - phase: 07-avatars-history (will use socket singleton; Header already wired)

# Tech tracking
tech-stack:
  added: [socket.io-client@4.x]
  patterns:
    - "Socket singleton exported from socket.ts — imported by useLeaderboard hook and AuthContext"
    - "Guest-safe socket connect in useLeaderboard: connect if !socket.connected on mount; disconnect only if !getAccessToken() on cleanup"
    - "AuthContext owns socket lifecycle for authenticated users: connect on accessToken truthy, disconnect on null"
    - "balance:update registered once in AuthContext (not in each game page) to avoid duplicate listeners"
    - "Explicit Socket type annotation on export to satisfy pnpm isolation TS2742 portability error"

key-files:
  created:
    - apps/frontend/src/socket.ts
    - apps/frontend/src/stores/leaderboardStore.ts
    - apps/frontend/src/hooks/useLeaderboard.ts
    - apps/frontend/src/pages/LeaderboardPage.tsx
  modified:
    - apps/frontend/src/contexts/AuthContext.tsx
    - apps/frontend/src/components/Header.tsx
    - apps/frontend/src/App.tsx
    - apps/frontend/package.json

key-decisions:
  - "Explicit Socket type annotation (: Socket) required on socket.ts export — pnpm dependency isolation causes TS2742 portability error without it"
  - "Guest socket connect in useLeaderboard hook — AuthContext only connects when accessToken is truthy; guests visiting /leaderboard would never receive live broadcasts without this guard"
  - "balance:update listener registered in AuthContext (not game pages) — single registration point avoids duplicate listeners across game pages"
  - "apiClient used for GET /leaderboard even for guests — apiClient sends no Authorization header when accessToken is null, and the backend handles unauthenticated requests gracefully returning null ownRanks"

patterns-established:
  - "socket.ts singleton pattern: import socket from '../socket'; call socket.connect()/disconnect() from auth lifecycle and hook guards"
  - "Guest connect pattern in hooks: if (!socket.connected) socket.connect() on mount; disconnect only if getAccessToken() === null on cleanup"

requirements-completed: [LDR-01, LDR-02, LDR-03, LDR-04, LDR-05]

# Metrics
duration: ~4min
completed: 2026-03-04
---

# Phase 6 Plan 02: LeaderboardPage frontend with socket singleton, Zustand store, live-update hook, and AuthContext socket wiring

**React leaderboard frontend with socket.io-client singleton, three-tab LeaderboardPage at /leaderboard (public), real-time live updates for guests and authenticated users via WebSocket, own-rank highlight/pin, and balance:update pushing immediately to Header after game settlement**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-04T03:47:17Z
- **Completed:** 2026-03-04T03:51:00Z
- **Tasks:** 2 auto tasks complete (Task 3 is checkpoint:human-verify — awaiting user verification)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- Socket singleton (socket.ts) with autoConnect:false and auth callback using getAccessToken() for fresh token pickup on reconnect
- Zustand v5 leaderboard store with snapshot, ownRanks, activeTab state
- useLeaderboard hook with guest-safe socket.connect() guard and conditional cleanup disconnect
- LeaderboardPage at /leaderboard — public route with three tabs (Balance / Total Wagered / Profit), skeleton loading, own-rank highlight (inside top 25) and pinned row with divider (outside top 25), logged-out users see no own-rank row
- AuthContext wired with socket lifecycle effect (connect on accessToken, disconnect on null) and balance:update listener for immediate header balance updates after game rounds

## Task Commits

Each task was committed atomically:

1. **Task 1: Socket singleton, Zustand store, useLeaderboard hook, and AuthContext wiring** - `3dfd0e5` (feat)
2. **Task 2: LeaderboardPage, Header nav link, App.tsx route registration** - `edba841` (feat)
3. **Task 3: Checkpoint — human verification** - Awaiting user verification

## Files Created/Modified

- `apps/frontend/src/socket.ts` - Singleton socket.io-client with autoConnect:false, auth callback using getAccessToken(); explicit Socket type annotation to resolve pnpm TS2742
- `apps/frontend/src/stores/leaderboardStore.ts` - Zustand v5 store for leaderboard snapshot (updated by WebSocket), ownRanks (from REST), and activeTab
- `apps/frontend/src/hooks/useLeaderboard.ts` - Guest-safe socket connect guard, leaderboard:update listener registration with cleanup and conditional disconnect
- `apps/frontend/src/pages/LeaderboardPage.tsx` - Three-tab leaderboard page: skeleton loading, top-25 table, own-rank highlight inside top 25, pinned own-rank row with divider outside top 25, logged-out visitors show no own-rank row
- `apps/frontend/src/contexts/AuthContext.tsx` - Added socket connect/disconnect lifecycle effect and balance:update listener effect
- `apps/frontend/src/components/Header.tsx` - Leaderboard nav link added between BalanceDisplay and Sign Out button
- `apps/frontend/src/App.tsx` - Public Route path="/leaderboard" added (not behind ProtectedRoute)
- `apps/frontend/package.json` - socket.io-client dependency added

## Decisions Made

- Explicit `Socket` type annotation on socket.ts export required — pnpm's dependency isolation causes TypeScript TS2742 "inferred type cannot be named" error without an explicit annotation
- Guest socket connect added in useLeaderboard hook because AuthContext only calls socket.connect() when accessToken is truthy; without the hook guard, guests visiting /leaderboard would have a disconnected socket and never receive live leaderboard:update events
- balance:update listener registered once in AuthContext to prevent duplicate listener registration across multiple game pages
- apiClient used for the initial GET /leaderboard fetch even for guests — apiClient sends no Authorization header when accessToken is null, backend returns null ownRanks for unauthenticated requests gracefully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added explicit Socket type annotation to resolve pnpm TS2742 portability error**
- **Found during:** Task 1 (TypeScript check after creating socket.ts)
- **Issue:** `export const socket = io(...)` inferred an internal type referencing `.pnpm/@socket.io+component-emitter@3.1.2/node_modules/@socket.io/component-emitter` — a pnpm-isolated path. TypeScript reports TS2742 "inferred type cannot be named without a reference to [internal path]. A type annotation is necessary."
- **Fix:** Changed to `export const socket: Socket = io(...)` with `import { io, type Socket } from 'socket.io-client'`
- **Files modified:** apps/frontend/src/socket.ts
- **Verification:** pnpm --filter frontend typecheck passes with no errors
- **Committed in:** 3dfd0e5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking TypeScript error)
**Impact on plan:** Required for TypeScript compilation; no scope creep or behavioral change.

## Issues Encountered

None — TypeScript error was caught by verification step and auto-fixed before commit.

## User Setup Required

None — socket.io-client connects to the same backend server (localhost:3000) already running. No additional configuration required.

## Next Phase Readiness

- LeaderboardPage is live at /leaderboard (public, no auth required)
- Socket singleton is established and ready for Phase 7 hooks if needed
- Header Leaderboard nav link present on all pages using Header
- balance:update registered in AuthContext — no per-game-page registration needed
- Awaiting human checkpoint verification before Phase 6 can be marked complete

---
*Phase: 06-leaderboards-real-time*
*Completed: 2026-03-04*
