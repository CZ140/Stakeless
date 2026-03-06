# Phase 6: Leaderboards & Real-Time - Research

**Researched:** 2026-03-03
**Domain:** WebSocket real-time push, leaderboard queries, Socket.IO 4 with TypeScript
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Leaderboard page location**: Dedicated `/leaderboard` route — separate page, not a dashboard section or sidebar widget. Linked from main header nav. Public access — no login required.
- **Table structure**: Three tabs on the same page: Balance | Total Wagered | Profit. Top 25 rows per tab. Columns: Rank | Username | Value (label changes per tab).
- **Own-rank display (LDR-05)**:
  - Applies to all 3 tabs
  - User inside top 25 → row highlighted in main table (accent border or background tint) — no separate pinned row
  - User outside top 25 → pinned own-rank row below table, separated by a visual divider
  - Logged-out users see no own-rank row
- **Real-time update strategy**:
  - Own balance: instant targeted WebSocket push to the playing user after each game round settles — feeds into existing `balanceStore.setBalance()`
  - Leaderboard table: throttled broadcast to all connected clients, approximately every 5–10 seconds
  - Two separate push paths: targeted (balance) vs broadcast (leaderboard)

### Claude's Discretion

- Exact throttle interval (5s vs 10s vs adaptive)
- Socket.IO room strategy (global room vs per-leaderboard rooms)
- How the backend triggers balance push — either from game routes post-settle or from within WalletService.settleBet
- Visual style of own-rank highlight and separator
- Loading/skeleton state while leaderboard data first loads

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LDR-01 | Balance leaderboard displays top users ranked by current balance | Drizzle `ORDER BY balance DESC LIMIT 25` — no schema changes needed; `balance` column already exists |
| LDR-02 | Total Wagered leaderboard displays top users ranked by lifetime amount wagered | Drizzle `ORDER BY total_wagered DESC LIMIT 25` — `totalWagered` column already exists |
| LDR-03 | Profit leaderboard displays top users ranked by total profit | Drizzle `ORDER BY total_profit DESC LIMIT 25` — `totalProfit` column already exists |
| LDR-04 | All leaderboards update in real-time via WebSocket push | Socket.IO 4 server-side `setInterval` broadcast pattern; throttled emission to a global room every 5–10 s |
| LDR-05 | Each leaderboard shows the logged-in user's own rank even when not in top 25 | SQL `rank() OVER (ORDER BY col DESC)` window function via `sql` template to fetch user-specific rank in a second query |
</phase_requirements>

---

## Summary

Phase 6 adds WebSocket real-time infrastructure (Socket.IO 4) on top of the existing Express/Drizzle backend, enabling two distinct push paths: (1) a targeted per-user balance push fired immediately after game settlement, and (2) a throttled global broadcast of leaderboard snapshots every 5–10 seconds. The leaderboard data itself requires no schema changes — the `users` table already has `balance`, `totalWagered`, and `totalProfit` as BIGINT columns. The only DB-query work is writing three `ORDER BY … LIMIT 25` queries plus a window-function own-rank query per tab.

The largest structural change is to `apps/backend/src/index.ts`: the current `app.listen()` call must become `http.createServer(app)` so Socket.IO can attach to the same HTTP port. The Socket.IO server uses `io.use()` middleware to verify the JWT from `socket.handshake.auth.token` using the existing `verifyAccessToken` from `tokenService.ts`. A single global room (or `io.emit`) handles the broadcast path; targeted balance push uses `io.to(userRoom).emit`. On the frontend, a singleton `socket.ts` module is created outside React; a `useLeaderboard` hook manages listener registration with cleanup, and `balanceStore.setBalance()` is called directly on the `balance:update` event — no new Zustand store needed for balance.

**Primary recommendation:** Install `socket.io@4` on the backend and `socket.io-client@4` on the frontend. Attach Socket.IO to the extracted `http.Server`, reuse `verifyAccessToken` in the Socket.IO middleware, and run two timers server-side: one per-room interval that queries and broadcasts leaderboard data, and targeted per-user pushes emitted immediately after `settleBet` resolves in each game route.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | 4.8.3 (latest, Dec 2025) | WebSocket server (Node.js) | Industry standard; built-in TypeScript types; automatic fallback to long-polling; robust auth middleware |
| socket.io-client | 4.8.3 | WebSocket client (browser) | Same version family as server; first-class TypeScript support included |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:http (built-in) | — | Create HTTP server for Socket.IO to attach to | Required: Socket.IO needs a raw `http.Server`, not an Express `app` |
| jose (already installed) | ^6.1.3 | JWT verification in Socket.IO middleware | Already used in `tokenService.ts` — reuse `verifyAccessToken` directly |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO | native WebSocket (ws) | ws is lighter but no auth middleware, no rooms, no auto-reconnect — adds significant hand-rolling |
| Socket.IO | Ably / Pusher | Managed services — overkill for a local-dev project with a single server |
| setInterval broadcast | event-driven push only | Pure event-driven (push on every bet) is simpler but hammers DB; throttle is the correct pattern at scale |

**Installation:**

```bash
# Backend
pnpm --filter backend add socket.io

# Frontend
pnpm --filter frontend add socket.io-client
```

No `@types/*` packages needed — both packages ship their own TypeScript declarations.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/
├── index.ts              # CHANGED: extract http.Server, attach Socket.IO
├── socket/
│   ├── index.ts          # NEW: createSocketServer(server, app) factory
│   ├── authMiddleware.ts # NEW: io.use() JWT verification using verifyAccessToken
│   └── leaderboardBroadcast.ts # NEW: interval timer + io.emit leaderboard snapshots
├── routes/
│   ├── leaderboard.ts    # NEW: GET /api/leaderboard REST endpoint (initial page load)
│   └── games.ts          # CHANGED: after settleBet, emit balance:update to user room

apps/frontend/src/
├── socket.ts             # NEW: singleton io() instance with auth token callback
├── stores/
│   └── leaderboardStore.ts # NEW: Zustand store for leaderboard tab state + data
├── hooks/
│   └── useLeaderboard.ts   # NEW: registers socket listeners, manages cleanup
├── pages/
│   └── LeaderboardPage.tsx # NEW: tabs, table, own-rank row
```

### Pattern 1: Socket.IO Server Attachment to http.Server

The current `index.ts` uses `app.listen()` directly. Socket.IO requires an `http.Server`. The refactor is minimal:

```typescript
// apps/backend/src/index.ts (AFTER)
import './env.js';
import { createServer } from 'node:http';
import { env } from './env.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket/index.js';

const app = createApp();
const server = createServer(app);
createSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`[backend] Running at http://localhost:${env.PORT}`);
});
```

**Confidence:** HIGH — verified against Socket.IO v4 official docs.

### Pattern 2: Socket.IO Server with TypeScript Typing

```typescript
// apps/backend/src/socket/index.ts
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { attachAuthMiddleware } from './authMiddleware.js';
import { startLeaderboardBroadcast } from './leaderboardBroadcast.js';

// Event type interfaces
interface ServerToClientEvents {
  'leaderboard:update': (data: LeaderboardSnapshot) => void;
  'balance:update': (data: { balance: number }) => void;
}

interface ClientToServerEvents {
  // clients don't send custom events in phase 6
}

interface SocketData {
  userId: number; // set by auth middleware for authenticated sockets
}

export let io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function createSocketServer(server: HttpServer): void {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173'],
      credentials: true,
    },
  });

  attachAuthMiddleware(io);

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    if (userId) {
      void socket.join(`user:${userId}`); // targeted balance push room
    }
    // All sockets (auth or guest) receive leaderboard broadcasts via io.emit
  });

  startLeaderboardBroadcast(io);
}
```

**Confidence:** HIGH — verified against Socket.IO v4 TypeScript docs and official server options docs.

### Pattern 3: JWT Auth Middleware — Permissive (Guest-Allowed)

The leaderboard page is public. Sockets from logged-out users should connect but not get a `userId`. Auth middleware must allow unauthenticated connections through (not `next(new Error(...))`):

```typescript
// apps/backend/src/socket/authMiddleware.ts
import { verifyAccessToken } from '../services/tokenService.js';
import type { Server } from 'socket.io';

export function attachAuthMiddleware(io: Server): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      // Guest — no userId set; still allowed through for public leaderboard
      return next();
    }
    try {
      const payload = await verifyAccessToken(token);
      socket.data.userId = Number(payload.sub);
      next();
    } catch {
      // Invalid/expired token — treat as guest, don't block
      next();
    }
  });
}
```

**Confidence:** HIGH — confirmed with Socket.IO middleware docs. Calling `next()` without error allows the connection; `next(new Error(...))` rejects it.

### Pattern 4: Throttled Leaderboard Broadcast

```typescript
// apps/backend/src/socket/leaderboardBroadcast.ts
import type { Server } from 'socket.io';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { desc, asc } from 'drizzle-orm';

const BROADCAST_INTERVAL_MS = 7000; // 7 s — within the 5–10 s discretion range

async function fetchLeaderboardSnapshot() {
  const [byBalance, byWagered, byProfit] = await Promise.all([
    db.select({ id: users.id, username: users.username, value: users.balance })
       .from(users).orderBy(desc(users.balance), asc(users.id)).limit(25),
    db.select({ id: users.id, username: users.username, value: users.totalWagered })
       .from(users).orderBy(desc(users.totalWagered), asc(users.id)).limit(25),
    db.select({ id: users.id, username: users.username, value: users.totalProfit })
       .from(users).orderBy(desc(users.totalProfit), asc(users.id)).limit(25),
  ]);
  return { byBalance, byWagered, byProfit };
}

export function startLeaderboardBroadcast(io: Server): void {
  setInterval(async () => {
    try {
      const snapshot = await fetchLeaderboardSnapshot();
      io.emit('leaderboard:update', snapshot);
    } catch (err) {
      console.error('[leaderboard broadcast] query failed:', err);
    }
  }, BROADCAST_INTERVAL_MS);
}
```

**Confidence:** HIGH — `io.emit()` broadcasts to all connected clients; `setInterval` is the standard pattern for throttled leaderboard push per Socket.IO broadcasting docs.

### Pattern 5: Targeted Balance Push After Game Settlement

After each `settleBet()` call resolves in `games.ts`, emit directly to the user's room:

```typescript
// In each game route, after settleBet resolves:
import { io } from '../socket/index.js';

const { newBalance } = await settleBet(userId, profit, betAmount, outcome, 'blackjack');
io.to(`user:${userId}`).emit('balance:update', { balance: newBalance });
res.json({ outcome, profit, newBalance, ... });
```

**Consideration:** The CONTEXT.md leaves this as "Claude's discretion" — triggering from game routes post-settle vs from within `walletService.settleBet`. Triggering from **game routes** is recommended: `walletService.ts` has no knowledge of Socket.IO and should remain a pure data layer. Importing `io` in game routes keeps the dependency direction clean.

**Confidence:** HIGH — this mirrors the `newBalance` already returned in game route responses; the game routes are the natural integration point.

### Pattern 6: Own-Rank Query (SQL Window Function)

```typescript
// apps/backend/src/routes/leaderboard.ts
import { sql } from 'drizzle-orm';

// Example for balance tab
const [rankRow] = await db.select({
  rank: sql<number>`rank() over (order by ${users.balance} desc)`.mapWith(Number),
  value: users.balance,
}).from(users).where(eq(users.id, userId));

// returns { rank: 47, value: 1250 }
```

This runs a single query that computes the user's rank via a PostgreSQL window function — no subquery or full-table scan in JS.

**Confidence:** HIGH — verified against Drizzle ORM `sql` template and PostgreSQL `rank()` window function docs.

### Pattern 7: Frontend Socket Singleton

Socket.IO recommends creating the socket instance **outside React components** as a module-level singleton, then registering event listeners in `useEffect` with cleanup:

```typescript
// apps/frontend/src/socket.ts
import { io } from 'socket.io-client';
import { getAccessToken } from './api/client';

// Create with autoConnect: false — connect manually after auth is confirmed
export const socket = io('http://localhost:3000', {
  autoConnect: false,
  auth: (cb) => {
    // Callback form: called fresh on each reconnect attempt — picks up refreshed tokens
    cb({ token: getAccessToken() ?? '' });
  },
});
```

Using `auth` as a **callback** (not a static object) ensures that when the socket reconnects after a token refresh, it uses the latest access token from the module closure in `client.ts`.

**Confidence:** HIGH — callback form verified against Socket.IO client options docs and discussion #4936 on reconnect-with-new-JWT.

### Pattern 8: Frontend Leaderboard Hook

```typescript
// apps/frontend/src/hooks/useLeaderboard.ts
import { useEffect } from 'react';
import { socket } from '../socket';
import { useLeaderboardStore } from '../stores/leaderboardStore';
import { useBalanceStore } from '../stores/balanceStore';

export function useLeaderboard() {
  const setSnapshot = useLeaderboardStore((s) => s.setSnapshot);

  useEffect(() => {
    function onUpdate(data: LeaderboardSnapshot) {
      setSnapshot(data);
    }
    socket.on('leaderboard:update', onUpdate);
    return () => {
      socket.off('leaderboard:update', onUpdate);
    };
  }, [setSnapshot]);
}

// Balance push listener lives in AuthContext or a root-level component:
useEffect(() => {
  function onBalanceUpdate({ balance }: { balance: number }) {
    useBalanceStore.getState().setBalance(balance);
  }
  socket.on('balance:update', onBalanceUpdate);
  return () => socket.off('balance:update', onBalanceUpdate);
}, []);
```

### Pattern 9: Socket Connect/Disconnect tied to Auth State

The socket should connect when the user authenticates and disconnect on sign-out. This integrates with `AuthContext.tsx`:

```typescript
// Inside AuthProvider useEffect watching accessToken
useEffect(() => {
  if (state.accessToken) {
    socket.connect();
  } else {
    socket.disconnect();
  }
}, [state.accessToken]);
```

For the **public leaderboard page**, guests also need leaderboard updates. The socket should connect on LeaderboardPage mount (even without auth) but without a `user:${id}` room join. The `autoConnect: false` + auth callback pattern handles this: unauthenticated sockets get `auth.token = ''`, the server middleware lets them through as guests, and `io.emit('leaderboard:update')` reaches them.

**Confidence:** MEDIUM — pattern derived from official Socket.IO React docs and auth discussion. The exact connect/disconnect lifecycle across auth states requires care; recommended approach is to always connect the socket on page load, let the server decide what to emit.

### Anti-Patterns to Avoid

- **Creating socket per-component:** Causes multiple connections. Always use module-level singleton.
- **Closing over stale tokens:** Using `auth: { token: accessToken }` (static string) means reconnects use the old expired token. Use the callback form `auth: (cb) => cb({ token: getAccessToken() })`.
- **Importing `io` circularly:** `socket/index.ts` exports `io`; game routes import it. Keep this one-way. Do not import from `routes/` back into `socket/`.
- **Running broadcast timer before Socket.IO is ready:** Call `startLeaderboardBroadcast(io)` inside `createSocketServer()` after the server is initialized.
- **Using `setInterval` inside `io.on('connection')`:** This would create a new interval per connection. The interval must be server-global, not per-socket.
- **Skipping CORS `credentials: true` on Socket.IO:** The Socket.IO CORS config is separate from Express's cors middleware. Both must allow the Vite origin and credentials.
- **Using `origin: '*'` with `credentials: true`:** This violates CORS spec. Must use explicit origin array.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection management | Custom WebSocket server with reconnect logic | `socket.io` | Socket.IO handles fallback transports, automatic reconnect, heartbeats, and rooms |
| Event acknowledgements / delivery | Manual request-response over raw WS | Socket.IO acknowledgements | Built-in, typed, with timeout support |
| Room-based targeting | Custom user→socket mapping dictionary | Socket.IO rooms (`socket.join`, `io.to`) | Rooms are managed by Socket.IO; handles multiple tabs/devices per user automatically |
| Own-rank computation in JS | Fetch all users, sort in JS, find index | SQL `rank() OVER` window function | Window functions run in the DB; fetching all users to sort in Node.js is an O(n) memory problem at scale |

**Key insight:** The complexity in real-time systems is in connection lifecycle management (reconnects, stale tokens, duplicate listeners, memory leaks). Socket.IO handles all of this; the project should focus on the application-layer logic (what to emit, when, to whom).

---

## Common Pitfalls

### Pitfall 1: CORS Misconfiguration (Two Separate CORS Configs)

**What goes wrong:** Developer configures Express CORS but forgets to also configure Socket.IO CORS. Browser blocks the Socket.IO handshake.

**Why it happens:** Socket.IO's HTTP long-polling uses its own CORS logic, independent of the Express `cors()` middleware.

**How to avoid:** Pass `cors: { origin: ['http://localhost:5173'], credentials: true }` directly to `new Server(httpServer, { cors: ... })`. Do not rely on Express cors middleware to cover Socket.IO requests.

**Warning signs:** Browser console shows `Access-Control-Allow-Origin` error on `/socket.io/` requests specifically.

### Pitfall 2: React 18 StrictMode Double-Effect

**What goes wrong:** In development, `useEffect` runs twice. If the socket connects/disconnects in the effect, it appears to flicker or fail.

**Why it happens:** React 18 StrictMode intentionally double-invokes effects to surface bugs.

**How to avoid:** Use the singleton pattern (`socket.ts` module level, `autoConnect: false`). The connect/disconnect in `useEffect` will call `socket.connect()` twice then `socket.disconnect()` then `socket.connect()` — Socket.IO handles this gracefully as long as it's the same instance.

**Warning signs:** Socket connects and immediately disconnects in dev; works in production.

### Pitfall 3: Stale Token on Reconnect

**What goes wrong:** User's access token refreshes (15-minute JWT rotation). Socket reconnects with old token, server rejects, socket goes into reconnect loop.

**Why it happens:** Static `auth: { token: '...' }` captures the token at connection time. Token expires, new one is issued, but socket still has the old one.

**How to avoid:** Use `auth: (cb) => cb({ token: getAccessToken() ?? '' })` — the callback is called fresh on each reconnect attempt, picking up the latest token from the module closure.

**Warning signs:** Sockets disconnect and fail to reconnect after ~15 minutes of use.

### Pitfall 4: Multiple setInterval Timers

**What goes wrong:** `startLeaderboardBroadcast` is called multiple times (e.g., if hot reload fires it again), creating multiple overlapping timers.

**Why it happens:** Node.js module hot reload with `tsx watch` can re-execute module-level code.

**How to avoid:** Track the interval handle; clear it before creating a new one. Or export `startLeaderboardBroadcast` with a guard that only starts once.

**Warning signs:** DB query logs show 2x, 4x, 8x the expected query frequency.

### Pitfall 5: Own-Rank Row Shown for Logged-Out Users

**What goes wrong:** REST `/api/leaderboard` returns own-rank data even for unauthenticated requests because `requireAuth` wasn't applied — or own-rank is conditionally shown on frontend but the condition is wrong.

**Why it happens:** The leaderboard page is public (no `ProtectedRoute`), so the REST endpoint must handle both auth and guest cases.

**How to avoid:** On the REST endpoint, read the `Authorization` header optionally. If present and valid, query own rank; if absent, return `null` for `ownRank`. Frontend checks `ownRank !== null && user is logged in` before rendering the pinned row.

**Warning signs:** Logged-out users see a "rank #undefined" row below the table.

### Pitfall 6: balance:update Listener in Multiple Components

**What goes wrong:** The `balance:update` socket event updates `balanceStore`. If this listener is registered in multiple components (e.g., every game page), each registration calls `setBalance` — which is harmless but produces N identical calls and potential cleanup bugs.

**Why it happens:** Game pages each mount the balance push listener independently.

**How to avoid:** Register the `balance:update` listener in one place only — either `AuthContext` (already has balance init logic) or a top-level `SocketProvider` component. Game pages should not register their own `balance:update` listeners; they rely on `balanceStore` which the single listener updates.

---

## Code Examples

Verified patterns from official sources and project conventions:

### Backend: Full index.ts Refactor

```typescript
// apps/backend/src/index.ts
import './env.js';
import { createServer } from 'node:http';
import { env } from './env.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket/index.js';

const app = createApp();
const server = createServer(app);
createSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`[backend] Running at http://localhost:${env.PORT}`);
  console.log(`[backend] Health check: http://localhost:${env.PORT}/api/health`);
});
```

### Backend: Leaderboard REST Route (initial page load + own-rank)

```typescript
// apps/backend/src/routes/leaderboard.ts
import { Router } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { desc, asc, eq, sql } from 'drizzle-orm';
import { verifyAccessToken } from '../services/tokenService.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', async (req, res) => {
  // Optional auth — derive userId if token present
  let userId: number | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyAccessToken(authHeader.slice(7));
      userId = Number(payload.sub);
    } catch { /* guest */ }
  }

  const [byBalance, byWagered, byProfit] = await Promise.all([
    db.select({ id: users.id, username: users.username, value: users.balance })
      .from(users).orderBy(desc(users.balance), asc(users.id)).limit(25),
    db.select({ id: users.id, username: users.username, value: users.totalWagered })
      .from(users).orderBy(desc(users.totalWagered), asc(users.id)).limit(25),
    db.select({ id: users.id, username: users.username, value: users.totalProfit })
      .from(users).orderBy(desc(users.totalProfit), asc(users.id)).limit(25),
  ]);

  let ownRanks: { balance: { rank: number; value: number } | null; wagered: { rank: number; value: number } | null; profit: { rank: number; value: number } | null } | null = null;

  if (userId !== null) {
    const [balRank, wagRank, profRank] = await Promise.all([
      db.select({ rank: sql<number>`rank() over (order by ${users.balance} desc)`.mapWith(Number), value: users.balance })
        .from(users).where(eq(users.id, userId)),
      db.select({ rank: sql<number>`rank() over (order by ${users.totalWagered} desc)`.mapWith(Number), value: users.totalWagered })
        .from(users).where(eq(users.id, userId)),
      db.select({ rank: sql<number>`rank() over (order by ${users.totalProfit} desc)`.mapWith(Number), value: users.totalProfit })
        .from(users).where(eq(users.id, userId)),
    ]);
    ownRanks = {
      balance: balRank[0] ? { rank: balRank[0].rank, value: balRank[0].value } : null,
      wagered: wagRank[0] ? { rank: wagRank[0].rank, value: wagRank[0].value } : null,
      profit: profRank[0] ? { rank: profRank[0].rank, value: profRank[0].value } : null,
    };
  }

  res.json({ byBalance, byWagered, byProfit, ownRanks });
});
```

### Frontend: Leaderboard Zustand Store (v5 pattern)

```typescript
// apps/frontend/src/stores/leaderboardStore.ts
import { create } from 'zustand';

interface LeaderboardRow {
  id: number;
  username: string;
  value: number;
}

interface LeaderboardSnapshot {
  byBalance: LeaderboardRow[];
  byWagered: LeaderboardRow[];
  byProfit: LeaderboardRow[];
}

interface OwnRanks {
  balance: { rank: number; value: number } | null;
  wagered: { rank: number; value: number } | null;
  profit: { rank: number; value: number } | null;
}

interface LeaderboardState {
  snapshot: LeaderboardSnapshot | null;
  ownRanks: OwnRanks | null;
  activeTab: 'balance' | 'wagered' | 'profit';
  setSnapshot: (snapshot: LeaderboardSnapshot) => void;
  setOwnRanks: (ownRanks: OwnRanks | null) => void;
  setActiveTab: (tab: 'balance' | 'wagered' | 'profit') => void;
}

// Zustand v5 double-parens pattern (required for TypeScript inference)
export const useLeaderboardStore = create<LeaderboardState>()((set) => ({
  snapshot: null,
  ownRanks: null,
  activeTab: 'balance',
  setSnapshot: (snapshot) => set({ snapshot }),
  setOwnRanks: (ownRanks) => set({ ownRanks }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
```

### Frontend: Socket Singleton

```typescript
// apps/frontend/src/socket.ts
import { io } from 'socket.io-client';
import { getAccessToken } from './api/client';

export const socket = io('http://localhost:3000', {
  autoConnect: false,
  auth: (cb) => {
    cb({ token: getAccessToken() ?? '' });
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `require('socket.io')` / `@types/socket.io` separate | Types bundled in `socket.io` package | Socket.IO v3+ | No `@types/socket.io` needed; would conflict |
| `io.set('authorization', fn)` | `io.use((socket, next) => ...)` middleware | Socket.IO 1.x → 2.x | Aligns with Express middleware pattern |
| `socket.rooms` was a Map | `socket.rooms` is now a Set | Socket.IO v3 | `socket.rooms.has(roomName)` not `.get()` |

**Deprecated/outdated:**
- `socketio-jwt` npm package: Wraps old API; not needed. Use `io.use()` with `jose` directly.
- `@types/socket.io`: Don't install. Built-in types in `socket.io` package since v3; installing `@types/socket.io` causes conflicts.

---

## Open Questions

1. **Window function performance at scale**
   - What we know: `rank() OVER (ORDER BY col DESC)` with a WHERE clause runs in O(n) over the full table.
   - What's unclear: For a small project (< 10,000 users), this is fine. For larger scale, a materialized rank column or Redis sorted set would be better.
   - Recommendation: Acceptable for v1. Add an index on `balance`, `total_wagered`, `total_profit` columns if query latency becomes observable. (The columns are already queried by `ORDER BY` in the leaderboard, so indexes would help the top-25 fetch too.)

2. **BIGINT coin values in leaderboard display**
   - What we know: `balance`, `totalWagered`, `totalProfit` are stored as integer coins (BIGINT). The frontend displays them as raw numbers.
   - What's unclear: Whether the leaderboard display should format these as coin values (e.g., "1,250 coins") or a formatted decimal.
   - Recommendation: Match existing game display conventions. Format with `toLocaleString()` for readability (e.g., "1,250").

3. **Socket.IO port — same port as Express or separate?**
   - What we know: Socket.IO can share the same HTTP port as Express by attaching to `http.Server`. The `/socket.io/` path namespace is reserved for Socket.IO handshakes.
   - What's unclear: No conflict documented for this project.
   - Recommendation: Share port 3000 with Express. This matches the CONTEXT.md description and avoids adding a second port to CORS/proxy config.

---

## Sources

### Primary (HIGH confidence)

- [Socket.IO v4 Official Docs — Middlewares](https://socket.io/docs/v4/middlewares/) — `io.use()` pattern, `socket.handshake.auth`, guest-permissive auth
- [Socket.IO v4 Official Docs — Broadcasting Events](https://socket.io/docs/v4/broadcasting-events/) — `io.emit()`, `io.to(room).emit()`, room-based targeting
- [Socket.IO v4 Official Docs — Server Options](https://socket.io/docs/v4/server-options/) — CORS configuration, `credentials: true`, origin array
- [Socket.IO v4 Official Docs — TypeScript](https://socket.io/docs/v4/typescript/) — `ServerToClientEvents`, `ClientToServerEvents`, `SocketData` interfaces
- [Socket.IO — How to use with React](https://socket.io/how-to/use-with-react) — singleton pattern, `useEffect` cleanup, React 18 StrictMode
- [Socket.IO — How to use with JWT](https://socket.io/how-to/use-with-jwt) — token in handshake auth, `auth` callback form for reconnect
- [Socket.IO v4 Official Docs — Server Installation](https://socket.io/docs/v4/server-installation/) — version 4.8.3, Dec 2025
- [Socket.IO v4 Official Docs — Client Installation](https://socket.io/docs/v4/client-installation/) — version 4.8.3, pnpm install command
- [Drizzle ORM Docs — Select](https://orm.drizzle.team/docs/select) — `orderBy(desc(...))`, `.limit(25)`, `sql` template for window functions

### Secondary (MEDIUM confidence)

- [Socket.IO Discussion #4936 — reconnect with new JWT](https://github.com/socketio/socket.io/discussions/4936) — confirms `auth` callback form picks up fresh token on reconnect

### Tertiary (LOW confidence)

- [WebSearch: throttled leaderboard broadcast pattern] — setInterval pattern confirmed against official docs; specific interval values (5–10 s) are project decision not from docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Socket.IO 4.8.3 confirmed from official install docs (Dec 2025). No additional packages needed beyond socket.io and socket.io-client.
- Architecture: HIGH — All patterns verified against official Socket.IO v4 docs, existing codebase reviewed for integration points.
- Pitfalls: HIGH — CORS double-config and StrictMode issues are documented Socket.IO community knowledge; token staleness is from official JWT guide.

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Socket.IO 4.x is stable; 30-day window is safe)
