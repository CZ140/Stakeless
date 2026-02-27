# Architecture Research

**Domain:** Browser-based social casino / virtual gambling platform
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH (core patterns verified across multiple sources; specific social-casino implementations sparse, extrapolated from real-money casino architecture)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Game UIs    │  │  Dashboard   │  │  Admin Panel │               │
│  │ (BJ/Roul/    │  │  (Balance,   │  │  (RBAC-      │               │
│  │  Plinko/Mine)│  │   Leaderbd)  │  │   protected) │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                  │                       │
│         │ REST            │ REST + WS         │ REST                 │
└─────────┼─────────────────┼──────────────────┼───────────────────────┘
          │                 │                  │
┌─────────┼─────────────────┼──────────────────┼───────────────────────┐
│         │    API LAYER    │   (Node/Express) │                       │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐               │
│  │  Game Router │  │   WS Server  │  │  Admin Router│               │
│  │  /api/games/*│  │  (ws / sio)  │  │  /api/admin/*│               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                  │                       │
│  ┌──────▼─────────────────▼──────────────────▼───────┐               │
│  │                  Service / Business Layer          │               │
│  │  AuthService  │  WalletService  │  GameEngines     │               │
│  │  UserService  │  LeaderService  │  (per-game)      │               │
│  └──────────────────────────┬───────────────────────┘               │
│                             │                                        │
│  ┌──────────────────────────▼───────────────────────┐                │
│  │               Data Access Layer (DAL)             │                │
│  │         pg / node-postgres query builders         │                │
│  └──────────────────────────┬───────────────────────┘                │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
┌─────────────────────────────┼──────────────────────────────────────────┐
│               PERSISTENCE LAYER                                         │
│  ┌───────────────────┐      │      ┌──────────────────────┐             │
│  │    PostgreSQL      │◄─────┘      │   (Optional: Redis)  │             │
│  │  users, bets,     │             │  leaderboard cache   │             │
│  │  game_logs,       │             │  session store        │             │
│  │  daily_bonuses,   │             └──────────────────────┘             │
│  │  admin_logs       │                                                   │
│  └───────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| React Game UIs | Render game state, collect player input, display outcomes | REST API (bets), WS Server (balance/leaderboard push) |
| React Admin Panel | Operator dashboards, player search, ban/reset actions | REST API (admin routes only) |
| Express REST API | Route HTTP requests, authenticate JWT, validate input | Service layer, PostgreSQL |
| WebSocket Server | Push leaderboard updates, balance sync after bets | Clients (broadcast), Service layer (subscribe to balance events) |
| AuthService | Register, login, JWT issue/verify, password reset | UserService, PostgreSQL |
| WalletService | Deduct bets, credit winnings, read balance; all via DB transactions | PostgreSQL (atomic writes), WS Server (post-bet push) |
| Game Engines (per game) | Stateless pure functions: receive bet params, call RNG, compute outcome | WalletService (deduct/credit), BetLogService (record) |
| BetLogService | Append-only write of every bet result to game_logs | PostgreSQL |
| LeaderboardService | Aggregate leaderboard queries; push via WS | PostgreSQL, WS Server |
| AdminService | User lookup, ban/reset, audit log writes | PostgreSQL, UserService |
| PostgreSQL | Authoritative data store; ACID transactions for balance updates | All services |

---

## Recommended Project Structure

```
project-root/
├── client/                       # React frontend (Vite)
│   ├── src/
│   │   ├── pages/                # Route-level components (Home, Games, Profile, Admin)
│   │   ├── components/           # Shared UI components
│   │   ├── games/                # Per-game UI modules (blackjack/, roulette/, plinko/, mines/)
│   │   ├── hooks/                # useWebSocket, useBalance, useAuth
│   │   ├── services/             # HTTP client wrappers (api.ts)
│   │   └── store/                # Global state (balance, user, leaderboard)
│   └── vite.config.ts
│
├── server/                       # Node.js / Express backend
│   ├── src/
│   │   ├── routes/               # Express routers
│   │   │   ├── auth.ts           # /api/auth/*
│   │   │   ├── games.ts          # /api/games/*
│   │   │   ├── leaderboard.ts    # /api/leaderboard/*
│   │   │   ├── profile.ts        # /api/profile/*
│   │   │   └── admin.ts          # /api/admin/* (RBAC middleware applied)
│   │   ├── middleware/
│   │   │   ├── authenticate.ts   # JWT verification
│   │   │   ├── requireAdmin.ts   # Role check (admin only)
│   │   │   └── rateLimiter.ts    # Per-endpoint rate limits
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── wallet.service.ts # All balance mutations live here
│   │   │   ├── betLog.service.ts # Append-only game_logs writes
│   │   │   ├── leaderboard.service.ts
│   │   │   └── admin.service.ts
│   │   ├── games/                # Game engine modules (pure, stateless)
│   │   │   ├── engine.interface.ts  # Shared GameEngine interface
│   │   │   ├── rng.ts               # Cryptographic RNG utilities
│   │   │   ├── blackjack.engine.ts
│   │   │   ├── roulette.engine.ts
│   │   │   ├── plinko.engine.ts
│   │   │   └── mines.engine.ts
│   │   ├── websocket/
│   │   │   ├── ws.server.ts      # WS server init, auth handshake
│   │   │   └── broadcast.ts      # Typed broadcast helpers (leaderboard, balance)
│   │   ├── db/
│   │   │   ├── pool.ts           # pg Pool singleton
│   │   │   ├── migrations/       # SQL migration files (numbered)
│   │   │   └── queries/          # Parameterized query functions per table
│   │   └── app.ts                # Express app setup
│   └── index.ts                  # Server entry point (HTTP + WS)
│
└── shared/                       # Types shared between client and server
    └── types.ts                  # GameType enum, BetRequest, GameResult, etc.
```

### Structure Rationale

- **games/**: Game engines isolated as pure functions with a shared interface. No database calls inside an engine — they receive inputs, return outputs. This makes them trivially testable and replaceable without touching the rest of the system.
- **services/wallet.service.ts**: Single choke-point for all balance mutations. Prevents balance update logic from scattering across game routes.
- **middleware/**: Auth and RBAC separated from route logic. `requireAdmin` is a middleware layer on top of `authenticate`, applied to the entire `/api/admin` router.
- **websocket/**: Isolated from HTTP routing. The WS server is co-located in the same Node process (simplicity for v1), but its broadcast helpers can be called from any service after a DB write completes.
- **shared/**: Prevents type drift between client and server for core domain types.

---

## Architectural Patterns

### Pattern 1: Game Engine Isolation (Stateless Pure Functions)

**What:** Each game is implemented as a module exporting a single function. The function receives validated inputs (bet amount, game-specific params) and returns a deterministic outcome given a random seed. It has no side effects — no DB calls, no HTTP calls.

**When to use:** Always. Every game follows this interface.

**Trade-offs:** Slightly more orchestration code in the route handler, but complete testability and zero coupling between games.

**Example:**
```typescript
// server/src/games/engine.interface.ts
export interface GameResult {
  outcome: 'win' | 'loss' | 'push';
  multiplier: number;         // e.g., 2.0 for a 2x win
  payout: number;             // coins returned to player (0 on loss)
  details: Record<string, unknown>; // game-specific (cards dealt, wheel result, etc.)
}

export interface GameEngine {
  play(betAmount: number, params: Record<string, unknown>, rngSeed: string): GameResult;
}

// server/src/games/roulette.engine.ts
export function playRoulette(betAmount: number, betType: string, betValue: string, rngSeed: string): GameResult {
  const spinResult = deriveRouletteOutcome(rngSeed); // deterministic from seed
  const won = evaluateBet(spinResult, betType, betValue);
  const multiplier = ROULETTE_PAYOUTS[betType];
  return {
    outcome: won ? 'win' : 'loss',
    multiplier: won ? multiplier : 0,
    payout: won ? betAmount * multiplier : 0,
    details: { spinResult, betType, betValue }
  };
}
```

---

### Pattern 2: Atomic Bet Transaction (Deduct → RNG → Outcome → Credit → Log)

**What:** The entire bet lifecycle runs inside a single PostgreSQL transaction. The balance deduction, outcome computation trigger, and payout credit are committed atomically. If any step fails, the entire transaction rolls back and the player's balance is unchanged.

**When to use:** Every single bet placement, without exception.

**Trade-offs:** Slightly slower than optimistic writes, but eliminates double-spend and partial-credit bugs entirely. For a virtual currency platform at this scale, the performance trade-off is irrelevant.

**Example:**
```typescript
// server/src/services/wallet.service.ts
import { pool } from '../db/pool';
import { generateRNGSeed } from '../games/rng';

export async function placeBet(userId: number, betAmount: number, gameType: string, gameParams: unknown, engine: GameEngine) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock user row and read balance (prevents race conditions)
    const { rows } = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const currentBalance = rows[0].balance;

    // 2. Validate: sufficient funds
    if (currentBalance < betAmount) {
      await client.query('ROLLBACK');
      throw new Error('INSUFFICIENT_FUNDS');
    }

    // 3. Deduct bet from balance
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [betAmount, userId]
    );

    // 4. Generate RNG seed server-side, compute outcome (pure function, no DB)
    const rngSeed = generateRNGSeed();
    const result = engine.play(betAmount, gameParams, rngSeed);

    // 5. Credit payout (0 on loss — still runs, just adds 0)
    await client.query(
      'UPDATE users SET balance = balance + $1, total_wagered = total_wagered + $2 WHERE id = $3',
      [result.payout, betAmount, userId]
    );

    // 6. Append-only log (never update, always insert)
    await client.query(
      `INSERT INTO game_logs (user_id, game_type, bet_amount, outcome, payout, profit, rng_seed, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [userId, gameType, betAmount, result.outcome, result.payout, result.payout - betAmount, rngSeed, JSON.stringify(result.details)]
    );

    await client.query('COMMIT');

    return { newBalance: currentBalance - betAmount + result.payout, result };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

**Key safety properties:**
- `SELECT ... FOR UPDATE` row-locks the user row, preventing two concurrent bet requests from both reading the same stale balance
- `BEGIN`/`COMMIT`/`ROLLBACK` wraps all mutations — partial states cannot persist
- RNG and outcome computation happen inside the transaction boundary but are CPU-only (safe)
- game_logs is append-only; outcomes are never mutated after recording

---

### Pattern 3: Server-Side RNG with Cryptographic Seed

**What:** Game outcomes are never determined or influenced by the client. The server generates a cryptographically secure random seed using Node's `crypto` module (not `Math.random()`). This seed drives all game outcomes. For auditability, the seed is stored in game_logs.

**When to use:** Every game outcome, every time.

**Trade-offs:** Slightly more complex than `Math.random()`, but `Math.random()` is explicitly unsafe for gambling applications (predictable, not cryptographically secure).

**Example:**
```typescript
// server/src/games/rng.ts
import crypto from 'crypto';

export function generateRNGSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Derive a float in [0, 1) from a seed deterministically
export function seedToFloat(seed: string, nonce: number = 0): number {
  const hash = crypto.createHmac('sha256', seed)
    .update(String(nonce))
    .digest('hex');
  const int = parseInt(hash.slice(0, 8), 16);
  return int / 0xFFFFFFFF; // normalize to [0, 1)
}

// Example: pick a roulette slot 0-36 from seed
export function seedToRange(seed: string, min: number, max: number, nonce: number = 0): number {
  return Math.floor(seedToFloat(seed, nonce) * (max - min + 1)) + min;
}
```

---

### Pattern 4: WebSocket for Push-Only Real-Time (Not Game State)

**What:** WebSockets are used exclusively to push leaderboard snapshots and balance updates to connected clients after a bet completes. WebSockets do NOT carry bet requests or game logic — those remain on REST. This keeps the WS layer simple and stateless from the game's perspective.

**When to use:** After any bet resolves, the server pushes the new balance to that user's socket. After any top-10 leaderboard position changes, it broadcasts the new leaderboard to all subscribers.

**Trade-offs:** REST for bets means standard HTTP error handling, JWT middleware, rate limiting, and logging all work normally. If WebSockets went down, bets would still process correctly — clients would just not receive live pushes.

**Example:**
```typescript
// server/src/websocket/broadcast.ts
import { WebSocketServer, WebSocket } from 'ws';

// Map of userId → WebSocket for targeted pushes
const userSockets = new Map<number, WebSocket>();

export function registerSocket(userId: number, ws: WebSocket) {
  userSockets.set(userId, ws);
  ws.on('close', () => userSockets.delete(userId));
}

export function pushBalanceUpdate(userId: number, newBalance: number) {
  const ws = userSockets.get(userId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'BALANCE_UPDATE', payload: { balance: newBalance } }));
  }
}

export function broadcastLeaderboard(leaderboardData: unknown) {
  const message = JSON.stringify({ type: 'LEADERBOARD_UPDATE', payload: leaderboardData });
  userSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
}

// server/src/websocket/ws.server.ts — authenticate WS connection on upgrade
import { verifyJWT } from '../services/auth.service';
export function initWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    const token = extractTokenFromRequest(req); // from query param or cookie
    const user = verifyJWT(token);
    if (!user) { ws.close(1008, 'Unauthorized'); return; }
    registerSocket(user.id, ws);
  });
}
```

---

### Pattern 5: Admin Router Isolation with RBAC Middleware

**What:** All admin endpoints live under `/api/admin/` on a separate Express router. The entire router is wrapped with `authenticate` + `requireAdmin` middleware before any route handler runs. Admin routes are never exposed to regular users.

**When to use:** Any operation that modifies or reads privileged data (user ban, balance reset, full game history).

**Example:**
```typescript
// server/src/routes/admin.ts
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
router.use(authenticate);   // Must be logged in
router.use(requireAdmin);   // Must have role='admin'

router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUserDetail);
router.post('/users/:id/ban', adminController.banUser);
router.post('/users/:id/reset', adminController.resetUser);

export default router;

// server/src/middleware/requireAdmin.ts
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

---

## Data Flow

### Bet Request Flow (Complete Path)

```
[Player clicks "Bet" in React UI]
        |
        | POST /api/games/roulette/bet
        | Body: { betAmount: 100, betType: "red" }
        | Header: Authorization: Bearer <JWT>
        |
        v
[Express Route: /api/games/roulette/bet]
        |
        +-- authenticate middleware (verifies JWT, attaches req.user)
        +-- rateLimiter middleware (max N bets/second per userId)
        +-- Input validation (betAmount > 0, betAmount <= balance, betType valid)
        |
        v
[WalletService.placeBet()]
        |
        | BEGIN TRANSACTION
        |
        +-- SELECT balance FROM users WHERE id=$1 FOR UPDATE  (lock row)
        +-- Validate: balance >= betAmount                    (prevent overdraft)
        +-- UPDATE users SET balance = balance - betAmount    (deduct)
        |
        +-- generateRNGSeed()                                 (crypto.randomBytes)
        +-- roulette.engine.play(betAmount, params, seed)     (pure function)
        |
        +-- UPDATE users SET balance = balance + payout       (credit winnings)
        +-- INSERT INTO game_logs (...)                       (immutable record)
        |
        | COMMIT
        |
        v
[Route Handler receives { newBalance, result }]
        |
        +-- pushBalanceUpdate(userId, newBalance)   (WebSocket push to this user)
        +-- if leaderboard changed: broadcastLeaderboard()  (WS to all)
        |
        v
[HTTP 200 response to client]
        Body: { outcome, payout, newBalance, details }
        |
        v
[React UI updates game state, balance shown in header]
[WebSocket message arrives → confirms/updates balance display]
```

### WebSocket Connection Flow

```
[Browser connects: ws://host/ws?token=<JWT>]
        |
        v
[WS Server: upgrade event]
        |
        +-- Extract token from query param
        +-- verifyJWT(token) → user
        +-- if invalid: ws.close(1008, 'Unauthorized')
        +-- if valid: registerSocket(user.id, ws)
        |
        v
[Connection registered in userSockets Map]
        |
        (Server-initiated messages only — client does not send game data over WS)
        |
        v
[After any bet resolves]
        +-- pushBalanceUpdate(userId, newBalance)      → BALANCE_UPDATE event
        |
[After any leaderboard rank changes]
        +-- broadcastLeaderboard(snapshot)             → LEADERBOARD_UPDATE event
```

---

## Database Schema Design

### Core Tables

```sql
-- Users: identity, balance, stats
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  username      VARCHAR(64)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(32)  NOT NULL DEFAULT 'player', -- 'player' | 'admin'
  balance       BIGINT       NOT NULL DEFAULT 0,        -- store as integer cents/coins (avoid float)
  total_wagered BIGINT       NOT NULL DEFAULT 0,
  total_profit  BIGINT       NOT NULL DEFAULT 0,        -- can be negative
  games_played  INTEGER      NOT NULL DEFAULT 0,
  last_daily_bonus_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  banned_at     TIMESTAMPTZ                              -- NULL = not banned
);

-- Game logs: immutable append-only record of every bet
CREATE TABLE game_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id),
  game_type   VARCHAR(32) NOT NULL,  -- 'blackjack' | 'roulette' | 'plinko' | 'mines'
  bet_amount  BIGINT      NOT NULL,
  outcome     VARCHAR(16) NOT NULL,  -- 'win' | 'loss' | 'push'
  payout      BIGINT      NOT NULL,  -- coins returned (0 on loss)
  profit      BIGINT      NOT NULL,  -- payout - bet_amount (negative on loss)
  rng_seed    VARCHAR(64) NOT NULL,  -- stored for auditability
  details     JSONB,                 -- game-specific data (cards, spin result, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily bonus claims: one record per user per day
CREATE TABLE daily_bonus_claims (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount     BIGINT      NOT NULL
);

-- Admin audit log: every admin action recorded
CREATE TABLE admin_logs (
  id           SERIAL PRIMARY KEY,
  admin_id     INTEGER     NOT NULL REFERENCES users(id),
  action       VARCHAR(64) NOT NULL,  -- 'ban_user' | 'reset_balance' | 'view_history'
  target_user_id INTEGER   REFERENCES users(id),
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id),
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Key Schema Decisions

| Decision | Rationale |
|----------|-----------|
| Balance as BIGINT (integer coins, not DECIMAL) | Eliminates floating-point rounding errors in financial calculations. Store in smallest unit (1 coin = 1 unit). |
| game_logs is append-only (no UPDATE) | Immutable audit trail. If an outcome was wrong, insert a correction record — never mutate existing rows. |
| total_wagered / total_profit on users table | Denormalized for fast leaderboard queries without expensive aggregations. Updated within the same transaction as the bet. |
| rng_seed stored in game_logs | Allows post-hoc auditability: anyone can re-run the RNG function with the stored seed and verify the outcome matches. |
| banned_at as nullable timestamp | Soft delete pattern — banned user still exists in DB for audit purposes. Check `banned_at IS NOT NULL` on login. |

### Indexes

```sql
-- Leaderboard queries
CREATE INDEX idx_users_balance       ON users(balance DESC);
CREATE INDEX idx_users_total_wagered ON users(total_wagered DESC);
CREATE INDEX idx_users_total_profit  ON users(total_profit DESC);

-- Game history lookups
CREATE INDEX idx_game_logs_user_id   ON game_logs(user_id, created_at DESC);
CREATE INDEX idx_game_logs_game_type ON game_logs(game_type, created_at DESC);

-- Daily bonus check
CREATE INDEX idx_daily_bonus_user    ON daily_bonus_claims(user_id, claimed_at DESC);
```

---

## Anti-Patterns

### Anti-Pattern 1: Computing Game Outcomes in the Client

**What people do:** Send the outcome or the random seed from the browser to the server; trust a client-sent win/loss flag.

**Why it's wrong:** The client is fully inspectable and modifiable. Any player can alter JavaScript, intercept network requests, and send `outcome: 'win'` for every bet. Even exposing the RNG seed to the client before the round ends allows prediction of outcomes.

**Do this instead:** All RNG and outcome logic runs server-side only. The client sends only bet parameters (amount, bet type). The server computes and returns the result.

---

### Anti-Pattern 2: Updating Balance Outside a Transaction

**What people do:** Query the balance, compute new balance in application code, then issue a separate UPDATE — without a transaction or row lock.

**Why it's wrong:** Two concurrent requests (e.g., two rapid bet clicks) can both read the same balance, both pass the "sufficient funds" check, and both deduct — resulting in a negative balance or credit for a bet that should have been rejected.

**Do this instead:** Always use `BEGIN` + `SELECT ... FOR UPDATE` + `UPDATE` + `COMMIT`. The `FOR UPDATE` lock serializes concurrent balance mutations for the same user row.

---

### Anti-Pattern 3: Sending Bets Over WebSockets

**What people do:** Route all game actions through the WebSocket connection to reduce latency.

**Why it's wrong:** WebSockets bypass standard HTTP middleware (JWT verification, rate limiting, body validation). You lose Express's well-understood request/response lifecycle and have to re-implement these concerns in WS message handlers. Error handling becomes ad hoc.

**Do this instead:** Bets are REST (POST). WebSockets are push-only for server-initiated events (balance updates, leaderboard changes). Use the right tool for each direction of communication.

---

### Anti-Pattern 4: Storing Balance as FLOAT/DECIMAL in Application Code

**What people do:** Keep balance as a JavaScript `number` (IEEE 754 float) and accumulate rounding errors across hundreds of transactions.

**Why it's wrong:** `0.1 + 0.2 === 0.30000000000000004` in JavaScript. Over many bets, rounding errors compound and balances drift from their true values.

**Do this instead:** Store balance as integer coins in PostgreSQL `BIGINT`. Perform all arithmetic as integers. Convert to display format (e.g., divide by 100 for a decimal representation) only in the UI layer.

---

### Anti-Pattern 5: Monolithic Game Handler (One Route for All Games)

**What people do:** A single `/api/games/bet` endpoint with a `gameType` switch statement that contains all game logic inline.

**Why it's wrong:** Adding a new game requires modifying a growing switch statement. Testing any single game requires loading the entire handler. Bug in one game can affect the route handling of others.

**Do this instead:** Each game gets its own isolated engine module and its own route (or at minimum a clearly separated handler function). The route for `/api/games/roulette/bet` imports only `roulette.engine.ts`.

---

## Build Order (Dependency Graph)

The system has hard dependencies that dictate the order phases must be built:

```
Phase 1: Foundation (no dependencies)
  ├── PostgreSQL schema (users, game_logs, daily_bonus_claims, admin_logs)
  ├── Express app skeleton (app.ts, index.ts, port, CORS, body parsing)
  ├── pg Pool singleton
  └── Environment config (.env structure, secrets loading)

Phase 2: Auth (depends on: Phase 1)
  ├── User registration + password hashing
  ├── Login + JWT issue
  ├── authenticate middleware
  └── Password reset flow

Phase 3: Wallet Core (depends on: Phase 2)
  ├── WalletService.placeBet() with full transaction safety
  ├── Balance read endpoint
  ├── Daily bonus claim (idempotent: one per 24h, checked in transaction)
  └── Starting balance on registration

Phase 4: Game Engines + First Game Route (depends on: Phase 3)
  ├── RNG utilities (crypto-based)
  ├── GameEngine interface
  ├── First game engine (recommend: Roulette — simplest state)
  ├── POST /api/games/roulette/bet route
  └── BetLogService (game_logs writes)

Phase 5: Remaining Games (depends on: Phase 4 pattern)
  ├── Blackjack engine (multi-step state — most complex)
  ├── Plinko engine (stateless — easiest)
  ├── Mines engine (session state needed — medium complexity)
  └── Per-game routes

Phase 6: WebSocket Server (depends on: Phase 3 — needs balance events)
  ├── WS server init + JWT handshake
  ├── userSockets registry
  ├── pushBalanceUpdate (called from WalletService after Phase 3)
  └── broadcastLeaderboard

Phase 7: Leaderboard (depends on: Phase 3, Phase 6)
  ├── LeaderboardService (DB aggregate queries)
  ├── GET /api/leaderboard endpoints
  └── WS broadcast trigger (after bet completes)

Phase 8: Player Profile (depends on: Phase 3, Phase 4)
  ├── GET /api/profile/:id endpoint
  └── Balance/wagered history queries from game_logs

Phase 9: Admin Panel (depends on: Phase 2 RBAC, all prior phases)
  ├── requireAdmin middleware
  ├── Admin router (/api/admin/*)
  ├── AdminService (user lookup, ban, reset)
  └── admin_logs audit trail

Phase 10: React Frontend (can build in parallel with Phase 4+)
  ├── Auth pages (login, register)
  ├── Dashboard (balance, daily bonus)
  ├── Game UIs (one per game, in same order as engines)
  ├── WebSocket client hook
  └── Admin panel UI (last — depends on all backend phases)
```

**Critical dependency: Phases 1-3 (Foundation, Auth, Wallet) must be complete before any game can be built.** The wallet transaction pattern is the architectural foundation everything else sits on. Building game engines before the wallet service is tested is the most common cause of difficult-to-fix bugs in this type of system.

**Blackjack sequencing note:** Blackjack requires multi-step state (deal → player turn → dealer turn → outcome). This is the one game that cannot be fully stateless — you need either a game session stored in the DB or in-memory (server-side) during the round. Build Roulette, Plinko, or Mines first to validate the transaction pattern before adding Blackjack's session complexity.

---

## Scalability Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Single Node.js process, single PostgreSQL instance. No Redis needed. WS in the same process as HTTP. This is the target for v1. |
| 1k-10k users | Add Redis for leaderboard caching (avoid hitting PG on every leaderboard broadcast). PostgreSQL connection pooling (PgBouncer). PM2 cluster mode for Node (requires sticky sessions for WS). |
| 10k+ users | Separate WS server process with Redis pub/sub for cross-process balance push. Read replicas for leaderboard/profile queries. Consider partitioning game_logs by month (it will be the largest table). |

### Scaling Priority for v1

1. **First bottleneck:** PostgreSQL connection exhaustion under concurrent bets. Mitigation: use a pool (default pg pool is fine for v1; tune pool size).
2. **Second bottleneck:** Leaderboard broadcast frequency. Every bet triggers a leaderboard check. Add a short throttle (debounce broadcasts to max once per 2 seconds) before adding Redis.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Game Route → WalletService | Direct function call (same process) | WalletService owns the transaction; route handler only calls it |
| WalletService → Game Engine | Direct function call (pure function, no I/O) | Engine receives RNG seed, returns result synchronously |
| WalletService → BetLogService | Shared DB client within same transaction | Both use the same `client` object from `pool.connect()` |
| WalletService → WS Broadcast | Function call after COMMIT | Push happens only after DB write confirmed |
| Admin Route → AdminService | Direct function call (same process) | requireAdmin middleware blocks non-admins before handler |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Email (password reset) | Nodemailer or SMTP service (SendGrid) | Called from AuthService; async, non-blocking |
| No payment processors | N/A — virtual currency only | By design: no Stripe, no PayPal, no crypto |

---

## Sources

- [Online Casinos From the Inside: Architecture, Backend, and Security — Datemill](https://www.datemill.com/online-casinos-from-the-inside-architecture-backend-and-security/) — MEDIUM confidence (industry overview)
- [Inside the Code: Building Scalable Casino Game Engines for the Modern Web — DEV Community](https://dev.to/bob_packer_7c9018a4d1a1f1/inside-the-code-building-scalable-casino-game-engines-for-the-modern-web-3ij9) — MEDIUM confidence
- [Best Practices in Casino Game Backend Architecture — SDLC Corp](https://sdlccorp.com/post/best-practices-in-casino-game-backend-architecture/) — MEDIUM confidence (enterprise-scale, adapted for v1)
- [Building Provably Fair Casino Games: Implementing Cryptographic RNG in JavaScript — TouMaili](https://mailtoui.com/building-provably-fair-casino-games-implementing-cryptographic-rng-in-javascript/) — HIGH confidence (cryptographic patterns verified against Node.js crypto docs)
- [Preventing Postgres SQL Race Conditions with SELECT FOR UPDATE — on-systems.tech](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/) — HIGH confidence (verified against PostgreSQL documentation behavior)
- [PostgreSQL Transaction Atomicity — brandur.org](https://brandur.org/postgres-atomicity) — HIGH confidence (PostgreSQL internals, widely cited)
- [WebSockets vs Socket.IO: Complete Real-Time Guide 2025 — MergeSociety](https://www.mergesociety.com/code-report/websocets-explained) — MEDIUM confidence
- [Real-time Gaming with Node.js + WebSocket — Google Cloud Architecture](https://cloud.google.com/architecture/real-time-gaming-with-node-js-websocket) — HIGH confidence (official Google Cloud architecture reference)
- [Casino Database Schema Reference — GitHub casino-team1](https://github.com/casino-team1/Casino/blob/master/Database/Database.sql) — LOW confidence (student project, used only as schema structure reference)
- [Implementing RBAC in Node.js and Express — permify.co](https://permify.co/post/role-based-access-control-rbac-nodejs-expressjs/) — MEDIUM confidence (established pattern, multiple corroborating sources)

---

*Architecture research for: Browser-based virtual casino platform (React + Node.js/Express + PostgreSQL + WebSockets)*
*Researched: 2026-02-27*
