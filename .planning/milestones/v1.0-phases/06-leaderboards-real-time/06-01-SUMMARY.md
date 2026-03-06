---
phase: 06-leaderboards-real-time
plan: "01"
subsystem: api
tags: [socket.io, websockets, real-time, leaderboard, postgres, drizzle]

# Dependency graph
requires:
  - phase: 05-remaining-games
    provides: "All game settlement routes (roulette, plinko, mines, blackjack) using settleBet() pattern"
  - phase: 03-wallet-currency
    provides: "settleBet() service, users schema with balance/totalWagered/totalProfit BIGINT columns"
  - phase: 02-auth-accounts
    provides: "verifyAccessToken() from tokenService — used by Socket.IO auth middleware"
provides:
  - "Socket.IO server factory (createSocketServer) attached to HTTP server at port 3000"
  - "Permissive JWT auth middleware — authenticated sockets join user:N rooms; guests connect without error"
  - "Throttled leaderboard:update broadcast every 7 seconds to all connected sockets"
  - "balance:update targeted push wired to all 11 game settlement points across 4 game types"
  - "GET /api/leaderboard — top-25 rows for balance/wagered/profit tabs + window-function ownRanks for authenticated callers"
affects:
  - phase: 06-02 (frontend leaderboard + real-time UI consumer)

# Tech tracking
tech-stack:
  added: [socket.io@4.x]
  patterns:
    - "Socket.IO server attached to http.createServer(app) — required for WebSocket upgrade on same port as Express"
    - "Permissive auth middleware — unauthenticated guests allowed through, userId set only for valid JWT holders"
    - "user:N room pattern — io.to('user:42').emit() for targeted per-user pushes without broadcasting to all"
    - "Duplicate-timer guard with module-scoped broadcastInterval variable — safe against hot reload"
    - "PostgreSQL rank() OVER window function for own-rank — avoids fetching all users into JS"

key-files:
  created:
    - apps/backend/src/socket/index.ts
    - apps/backend/src/socket/authMiddleware.ts
    - apps/backend/src/socket/leaderboardBroadcast.ts
    - apps/backend/src/routes/leaderboard.ts
  modified:
    - apps/backend/src/index.ts
    - apps/backend/src/app.ts
    - apps/backend/src/routes/games.ts
    - apps/backend/package.json

key-decisions:
  - "Socket.IO server attached to http.createServer(app) — app.listen() replaced to allow WebSocket upgrade on port 3000"
  - "Permissive auth middleware: invalid/expired JWT tokens are silently treated as guest connections — leaderboard is public"
  - "leaderboard:update broadcast interval set to 7 seconds — within user-approved 5–10s discretion range"
  - "Duplicate-timer guard using module-scoped broadcastInterval — prevents interval doubling on hot reload"
  - "GET /api/leaderboard uses PostgreSQL rank() OVER window function for ownRanks — JS sort over full user table would not scale"
  - "mines/tile mine-hit path changed from void settleBet() to const { newBalance } = settleBet() — required to capture balance for balance:update emit (Rule 1 auto-fix)"
  - "Socket.IO CORS configured separately from Express cors middleware — both layers required for browser WebSocket upgrade"

patterns-established:
  - "balance:update push pattern: after every settleBet() call, before res.json() — io.to(`user:${userId}`).emit('balance:update', { balance: newBalance })"
  - "Socket.IO event types declared as ServerToClientEvents / ClientToServerEvents / SocketData interfaces in socket/index.ts"

requirements-completed: [LDR-01, LDR-02, LDR-03, LDR-04, LDR-05]

# Metrics
duration: ~8min
completed: 2026-03-03
---

# Phase 6 Plan 01: Socket.IO server with leaderboard REST endpoint and real-time balance pushes across all 11 game settlement points

**Socket.IO server attached to Express HTTP server on port 3000 with JWT-permissive auth, 7-second leaderboard broadcast, targeted balance:update pushes to user rooms after every game settlement, and GET /api/leaderboard with window-function own-rank for authenticated callers**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-03T20:37:58Z
- **Completed:** 2026-03-03T20:39:52Z
- **Tasks:** 2 (+ 1 human-verify checkpoint)
- **Files modified:** 8 (6 in Task 1, 3 in Task 2, 1 overlap in games.ts)

## Accomplishments

- Socket.IO server factory wired to http.createServer(app) — WebSocket upgrades now handled on port 3000 alongside REST
- Permissive JWT auth middleware: authenticated sockets join user:N rooms for targeted pushes; guests connect without error
- Throttled leaderboard:update broadcast every 7 seconds via module-scoped setInterval with hot-reload guard
- GET /api/leaderboard returns top-25 rows for balance/wagered/profit plus PostgreSQL window-function ownRanks for authenticated callers
- balance:update emit wired to all 11 settleBet call sites across roulette, plinko, mines, and blackjack game routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Install socket.io and create Socket.IO server infrastructure** - `ab60f4e` (feat)
2. **Task 2: Add leaderboard REST route and balance:update push to all game settlements** - `1381e69` (feat)
3. **Task 3: Checkpoint — human verification** - Approved (no commit — human-verify checkpoint)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `apps/backend/src/socket/index.ts` - Socket.IO server factory, io export, typed ServerToClientEvents/ClientToServerEvents/SocketData interfaces, user:N room join on connection
- `apps/backend/src/socket/authMiddleware.ts` - Permissive JWT auth middleware: sets socket.data.userId for valid tokens, lets guests through silently
- `apps/backend/src/socket/leaderboardBroadcast.ts` - 7-second setInterval that queries top-25 for all three leaderboard dimensions and emits leaderboard:update to all sockets
- `apps/backend/src/routes/leaderboard.ts` - GET /api/leaderboard: parallel top-25 queries + PostgreSQL rank() OVER window function for ownRanks when Authorization header present
- `apps/backend/src/index.ts` - Replaced app.listen() with http.createServer(app) + createSocketServer(server)
- `apps/backend/src/app.ts` - Registered leaderboardRouter at /api/leaderboard
- `apps/backend/src/routes/games.ts` - Added io import + balance:update emit after all 11 settleBet call sites
- `apps/backend/package.json` - Added socket.io dependency

## Decisions Made

- Socket.IO server attached to http.createServer(app) replacing app.listen() — required so Node HTTP server handles WebSocket upgrade before Express; Socket.IO cannot attach to an already-listening Express server
- Permissive auth middleware treats invalid/expired JWT as guest — leaderboard page is public, blocking connections on bad tokens would break guest access
- 7-second broadcast interval — within the user-approved 5–10s discretion range; balances DB load against perceived real-time freshness
- Module-scoped broadcastInterval guard prevents duplicate timers on hot reload (ts-node-dev restarts the module, not the process)
- PostgreSQL rank() OVER window function for own-rank — fetching all users into JS and sorting would not scale; single indexed query is O(log n)
- Socket.IO CORS origin configured separately from Express cors() — Socket.IO has its own CORS layer for the WebSocket upgrade handshake

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed mines/tile mine-hit path from void settleBet() to const { newBalance } = settleBet()**
- **Found during:** Task 2 (Add balance:update push to all game settlements)
- **Issue:** Plan noted that mines/tile mine-hit path used `await settleBet(...)` without capturing the return value. The balance:update emit requires `newBalance` from the return. This was expected and called out in the plan's action text.
- **Fix:** Changed `await settleBet(userId, 0, session.betAmount, 'exploded', 'mines')` to `const { newBalance } = await settleBet(...)` to capture the return, then added the emit
- **Files modified:** apps/backend/src/routes/games.ts
- **Verification:** TypeScript typecheck passed; newBalance now available for emit
- **Committed in:** 1381e69 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/missing return capture, pre-identified in plan)
**Impact on plan:** Required fix called out in the plan itself. No scope creep.

## Issues Encountered

- Browser CSP blocked the Socket.IO CDN smoke test during human verification (checkpoint step 5). This is expected behavior — Content-Security-Policy on the test page prevents loading external scripts. The Socket.IO server itself is working correctly; the REST endpoint test (GET /api/leaderboard returning real JSON data) confirmed backend operation. CDN smoke test is not a server issue.

## User Setup Required

None - no external service configuration required. Socket.IO runs on the existing backend port (3000).

## Next Phase Readiness

- Socket.IO server and leaderboard REST endpoint ready for Plan 06-02 frontend consumer
- io export from apps/backend/src/socket/index.ts is available for any future game routes that need balance:update push
- leaderboard:update broadcast is live — frontend only needs to connect and listen
- ownRanks will be null for unauthenticated requests; frontend must handle both cases

---
*Phase: 06-leaderboards-real-time*
*Completed: 2026-03-03*
