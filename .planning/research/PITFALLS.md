# Pitfalls Research

**Domain:** Browser-based virtual casino / gambling platform
**Researched:** 2026-02-27
**Confidence:** HIGH (security pitfalls verified across multiple authoritative sources)

---

## Critical Pitfalls

### Pitfall 1: Client-Side RNG — Using Math.random() for Game Outcomes

**What goes wrong:**
The developer puts game outcome logic in the browser — calling `Math.random()` client-side to determine card draws, mine positions, Plinko paths, or roulette results. Since the browser runs untrusted code, any player can intercept, replay, or modify the RNG call using DevTools or a browser extension. They can also predict outcomes if the seed is exposed or guessable.

**Why it happens:**
It's fast to prototype. The outcome appears on screen instantly without a round-trip. Developers new to games don't realize the browser is adversarial territory. `Math.random()` looks like "random" and passes naive testing.

**How to avoid:**
All game outcomes MUST be determined server-side, before the client receives any result. The server computes the outcome (e.g., mine grid layout, Plinko bucket, card drawn), stores it in the game session record, then sends only the result to the client. The client never knows the full game state until the round resolves.

Concretely:
- POST `/api/games/mines/start` → server generates mine grid, stores encrypted in session or DB, returns only safe tile count and bet deduction
- POST `/api/games/mines/reveal` → server checks the tile coordinate against stored grid, returns hit/miss
- Server never sends mine positions until game over

`Math.random()` is also cryptographically weak. For server-side generation, use Node.js `crypto.randomBytes()` or `crypto.randomInt()` which uses a CSPRNG (Cryptographically Secure Pseudo-Random Number Generator).

**Warning signs:**
- Game outcome logic lives in React components or client JS files
- Bet result is computed before sending to the server
- API response includes the full game board state upfront (mine positions, upcoming cards)
- The `Math.random()` function appears anywhere in game-related code

**Phase to address:**
Game Infrastructure phase (before any individual game is built). Establish the server-side outcome pattern once, then every game follows it.

---

### Pitfall 2: Balance Race Condition — Double-Spend via Concurrent Requests

**What goes wrong:**
Two or more concurrent requests (e.g., submitting two bets simultaneously, or claiming the daily bonus twice in parallel) both pass the "sufficient balance" check before either has deducted the balance. Both proceed. The player spends coins they don't have, or claims the daily bonus twice.

A player can trigger this with a simple script that fires two identical POST requests within milliseconds. Without database-level locking, the check-then-act sequence has a race window:

```
Thread A: SELECT balance WHERE id=1  → 500 coins ✓
Thread B: SELECT balance WHERE id=1  → 500 coins ✓
Thread A: UPDATE balance SET balance = 500 - 200  → 300
Thread B: UPDATE balance SET balance = 500 - 200  → 300  ← should be 100
```

**Why it happens:**
Developers write application-layer checks ("if balance >= bet") and assume sequential execution. Works fine with one user in testing. Breaks under concurrent load or deliberate exploitation.

**How to avoid:**
Use PostgreSQL's `SELECT ... FOR UPDATE` to lock the user row during the entire bet transaction, or use a single atomic `UPDATE` with a `WHERE` guard clause and check the affected row count:

```sql
-- Atomic bet deduction — only succeeds if balance is sufficient
UPDATE users
SET balance = balance - $1
WHERE id = $2 AND balance >= $1
RETURNING balance;
```

If 0 rows are returned, the bet was rejected (insufficient balance). This is atomic — no race window.

For the daily bonus, add a `last_bonus_claimed_at` column and use the same atomic UPDATE pattern:

```sql
UPDATE users
SET balance = balance + $1, last_bonus_claimed_at = NOW()
WHERE id = $2
  AND (last_bonus_claimed_at IS NULL OR last_bonus_claimed_at < NOW() - INTERVAL '24 hours')
RETURNING balance;
```

For complex multi-step transactions, wrap in `BEGIN ... COMMIT` with `SELECT ... FOR UPDATE` to hold a row lock for the duration.

**Warning signs:**
- Balance check and balance update are two separate SQL queries without a transaction wrapper
- No `FOR UPDATE` lock on the user row before bet processing
- Daily bonus uses a `SELECT` then `UPDATE` pattern with no atomicity guarantee
- Tests never fire concurrent requests

**Phase to address:**
Game Infrastructure phase. Build the atomic balance deduction function once as a shared service, used by every game. Do not let individual game routes implement their own balance logic.

---

### Pitfall 3: Bet Validation Bypass — Trusting Client-Sent Amounts

**What goes wrong:**
The server accepts the `betAmount` field directly from the request body without validating it server-side. A player sends a negative bet amount (`betAmount: -500`) to gain coins instead of losing them, or sends a fractional amount smaller than the minimum, or sends a bet of 0 to play for free.

Integer overflow variant: a player sends `betAmount: 9223372036854775808` which wraps to a negative number in some integer type implementations, awarding them a credit.

**Why it happens:**
The frontend enforces min/max bet constraints in the UI, so developers assume those limits hold. The server receives what looks like a number and uses it directly.

**How to avoid:**
Server-side validation on every bet endpoint, before any game logic runs:

```javascript
// Express middleware for bet validation
function validateBet(req, res, next) {
  const { betAmount } = req.body;
  if (typeof betAmount !== 'number') return res.status(400).json({ error: 'betAmount must be a number' });
  if (!Number.isInteger(betAmount)) return res.status(400).json({ error: 'betAmount must be a whole number' });
  if (betAmount < MIN_BET) return res.status(400).json({ error: `Minimum bet is ${MIN_BET}` });
  if (betAmount > MAX_BET) return res.status(400).json({ error: `Maximum bet is ${MAX_BET}` });
  next();
}
```

Constants `MIN_BET` and `MAX_BET` live on the server only — never in client code used as a source of truth.

Also validate game-specific parameters: mine count must be within grid bounds, Plinko rows must be within supported range, roulette bet type must be from a whitelist of valid bet types.

**Warning signs:**
- Bet validation logic exists only in React form validation (e.g., `min={1}` on an HTML input)
- Server route uses `req.body.betAmount` directly in SQL or game logic without type/range checks
- No server-side constants defining min/max bet
- Game parameters (mine count, risk level, rows) not validated against allowed values

**Phase to address:**
Game Infrastructure phase. Create a shared validation middleware applied to all game routes before any specific game logic.

---

### Pitfall 4: JWT Misuse — Weak Secrets, Missing Claims Validation, Role Escalation

**What goes wrong:**
Several JWT mistakes combine to allow authentication bypass or privilege escalation:

1. **Weak or default secret**: Using `secret`, `jwt_secret`, or a short key. An attacker who obtains a valid token can brute-force the secret with tools like `hashcat` and forge arbitrary tokens — including `{ role: "admin" }`.

2. **Algorithm confusion**: A server that accepts both `HS256` and `RS256` can be exploited. An attacker changes the header to `"alg": "HS256"` and signs the token with the server's public key (which is public). The server validates it as a valid HMAC signature.

3. **Missing `exp` validation**: Tokens that never expire remain valid indefinitely, even after a user is banned.

4. **Role claims trusted from token without DB check**: Storing `role: "admin"` in the JWT payload and trusting it without verifying against the database means anyone who forges a token with that claim gains admin access.

5. **Admin routes check only the token role, not a database flag**: If an admin is created and later their role is revoked in the DB, the old JWT still works until it expires.

**Why it happens:**
JWT tutorials show simple examples with short secrets and full claim trust. Developers copy the pattern without understanding the threat model. Admin routes feel "safe" because they're not publicized.

**How to avoid:**
- Use a randomly generated 256-bit secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Explicitly whitelist the algorithm: `jwt.verify(token, secret, { algorithms: ['HS256'] })`
- Always validate `exp` — use short-lived tokens (e.g., 15 min access + refresh token pattern) or at minimum set expiry to 24h
- For admin access, verify the `role` field against the database on every admin request, not just the token claim:

```javascript
// Admin middleware — token + DB verification
async function requireAdmin(req, res, next) {
  const user = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
  if (!user.rows[0] || user.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

- Store JWT secret in environment variables, never in source code

**Warning signs:**
- `JWT_SECRET=secret` or `JWT_SECRET=changeme` in `.env` or code
- No `algorithms` option passed to `jwt.verify()`
- Admin routes check only `req.user.role === 'admin'` without a DB lookup
- No `expiresIn` set when signing tokens
- Banned users can still authenticate

**Phase to address:**
Auth & Accounts phase (foundation). Any mistake here is foundational — fixing JWT after the game system is built requires touching every protected route.

---

### Pitfall 5: SQL Injection in Bet and Game Endpoints

**What goes wrong:**
A developer writes a raw SQL query that interpolates user input directly:

```javascript
// VULNERABLE
const result = await db.query(
  `SELECT * FROM bets WHERE user_id = ${req.user.id} AND game_type = '${req.body.gameType}'`
);
```

An attacker sends `gameType = "'; DROP TABLE bets; --"` or uses the injection to read other users' data, modify balances, or extract admin credentials.

**Why it happens:**
String interpolation into SQL looks like natural JavaScript. The vulnerability is invisible in low-traffic testing. Developers who come from ORM backgrounds and then write raw queries don't apply the same care.

**How to avoid:**
Always use parameterized queries with the `pg` client:

```javascript
// SAFE
const result = await db.query(
  'SELECT * FROM bets WHERE user_id = $1 AND game_type = $2',
  [req.user.id, req.body.gameType]
);
```

Also validate `gameType` against a whitelist of known values (`['blackjack', 'roulette', 'plinko', 'mines']`) before it reaches the query, as an extra layer.

Consider using an ORM (Sequelize, Drizzle, Prisma) which parameterizes automatically — though raw queries are fine if disciplined.

**Warning signs:**
- Template literals (`${}`) appearing inside SQL query strings
- `req.body`, `req.params`, or `req.query` values concatenated directly into SQL
- No input type/whitelist validation on `gameType`, `userId`, or similar parameters
- The `pg` client `query()` called with a single string argument rather than `(string, array)`

**Phase to address:**
Game Infrastructure phase. Establish the parameterized query pattern in the first database interaction written, then enforce it in code review for every subsequent query.

---

### Pitfall 6: WebSocket Authentication — Unauthenticated Message Handling

**What goes wrong:**
The WebSocket server handles messages (e.g., leaderboard subscribe, balance sync) without verifying the connecting client is authenticated. Because the WebSocket handshake upgrades from HTTP, it doesn't automatically carry cookie-based sessions or require re-authentication.

A second failure mode: the server authenticates on connection open but never re-validates during the session. A user whose account is banned can keep their existing WebSocket connection and receive live data indefinitely.

A third failure: the WebSocket endpoint accepts action-triggering messages (e.g., `{ type: "placeBet", amount: 100 }`) rather than being strictly read-only for broadcasts. If the server processes these without full HTTP API validation, bet validation logic is bypassed entirely.

**Why it happens:**
WebSocket is often added after the HTTP API is "done." Developers focus on getting real-time updates working and don't apply the same security rigor as HTTP routes. The WebSocket connection feels "internal" because it's not a URL users navigate to.

**How to avoid:**
- Require a JWT token in the connection handshake (passed as a query parameter or first message):
```javascript
wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'ws://base').searchParams.get('token');
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    ws.userId = user.id;
  } catch {
    ws.close(1008, 'Unauthorized');
    return;
  }
});
```
- WebSocket should be strictly broadcast-only. All state-changing actions (bets, claims) go through HTTP POST endpoints with full validation. WebSocket only pushes outbound data (leaderboard updates, balance sync).
- Periodically re-validate the user's auth status if connections are long-lived.

**Warning signs:**
- `wss.on('connection')` handler has no JWT verification step
- WebSocket message handlers contain any `INSERT` or `UPDATE` database logic
- Banned users still receive leaderboard updates
- No `close` call with an error code on invalid token

**Phase to address:**
Leaderboards / Real-Time phase. WebSocket is introduced here — authentication must be built in from the first line, not retrofitted.

---

### Pitfall 7: Admin Privilege Escalation — Insufficient Route Protection

**What goes wrong:**
Admin routes are protected by checking a token claim or a simple middleware, but the protection has gaps:

1. A regular user modifies their JWT payload to add `"role": "admin"` (if the secret is weak or the algorithm is exploitable)
2. Admin endpoints return full user data including password hashes, enabling offline cracking
3. The admin ban/reset action doesn't invalidate existing JWTs — a banned user continues playing until their token expires
4. Admin routes are discoverable (no obscurity, no rate limiting) and vulnerable to credential stuffing

**Why it happens:**
Admin panels are built last, under time pressure, as "internal tools." Developers assume no one will find the routes. RBAC is added as an afterthought rather than designed in.

**How to avoid:**
- Design RBAC into the user model from day one: `role` column with values `user | admin`, checked against the DB on every admin request (see Pitfall 4)
- Admin routes must never return password hashes, raw tokens, or secrets — use `SELECT id, email, username, balance, role FROM users` not `SELECT *`
- Implement a `token_version` or `jti` (JWT ID) counter in the database. On ban, increment the counter. Middleware rejects any token with an old version:

```sql
-- Users table
ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0;

-- On ban
UPDATE users SET token_version = token_version + 1 WHERE id = $1;
```

```javascript
// Auth middleware
const user = await db.query('SELECT token_version FROM users WHERE id = $1', [decoded.id]);
if (user.rows[0].token_version !== decoded.tokenVersion) {
  return res.status(401).json({ error: 'Token revoked' });
}
```

- Rate-limit admin login endpoint separately with a stricter limit (e.g., 5 attempts per 15 minutes)
- Log all admin actions to an `AdminLogs` table with timestamp, admin user ID, action, and target

**Warning signs:**
- A banned user can still make bets (token not invalidated)
- Admin routes accessible without additional factor or strict IP restriction
- `SELECT *` used on user queries in admin endpoints
- No `AdminLogs` table or audit trail
- Admin routes have no rate limiting

**Phase to address:**
Auth & Accounts phase (RBAC model), with Admin Panel phase implementing the audit log and ban-invalidation logic.

---

### Pitfall 8: Game State Desync — No Server-Authoritative Session

**What goes wrong:**
The game state (e.g., which Mines tiles have been revealed, current Blackjack hand, Plinko path in progress) is stored only in the React client. If the player refreshes mid-game, the state is lost. Worse, a player can manipulate client state (e.g., mark all tiles as safe in localStorage or React state) and submit a fabricated win result to the server.

**Why it happens:**
React state is convenient and fast. Developers build the game UI first, then add server calls. The "submit result" endpoint becomes an afterthought, and the server trusts the client's reported outcome.

**How to avoid:**
The server must be the single source of truth for all active game sessions:
- On game start, server creates a `game_sessions` record (or stores session data in the `Games` table) with the authoritative game state (mine grid, current hand, etc.)
- On each player action, server looks up the session, validates the action against the authoritative state, and updates it
- The client only ever sends player actions (click tile X, hit, stand) — never game state or outcomes
- On disconnect/reconnect, client fetches active session state from the server

```sql
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id),
  game_type TEXT NOT NULL,
  state JSONB NOT NULL,  -- authoritative game state (mines layout, hand, etc.)
  bet_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'active',  -- active | completed | abandoned
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Warning signs:**
- No `game_sessions` table or equivalent server-side state store
- The endpoint `/api/games/mines/result` accepts a `won: true` field from the client
- Refreshing mid-game loses progress permanently
- The server doesn't know which tiles have already been revealed in a Mines session

**Phase to address:**
Game Infrastructure phase. Design the session model before building any individual game.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store balance as a `FLOAT` or `DECIMAL` in JS | Easy math | Floating-point drift causes incorrect balances over time (0.1 + 0.2 = 0.30000000000000004) | Never — use INTEGER (coins as whole units) |
| Skip game session table, rely on client state | Faster to build | Client can fabricate outcomes; no mid-game recovery; no audit trail | Never |
| Hard-code JWT secret in source | Zero setup | Rotatable only by redeployment; leaked in git history forever | Never |
| Single global rate limit for all endpoints | One config | Bots can still hammer game endpoints if general limit is loose | MVP only — add per-endpoint limits before launch |
| Client-side balance display without server confirmation | Instant UI feedback | Balance can show wrong value if server rejects; opens timing exploits | Acceptable with optimistic UI + server correction on response |
| No `token_version` on JWT | Simpler auth | Banned/compromised accounts stay active until token expires | MVP only — acceptable if ban is rare, add revocation before scale |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostgreSQL transactions | Forgetting `ROLLBACK` on error — partial updates persist | Always use `try/catch` with explicit `BEGIN/ROLLBACK/COMMIT` or a transaction helper |
| WebSocket + JWT | Sending token in a WebSocket message after connection, then processing subsequent messages before token validation completes | Validate token synchronously before registering any message handlers on that socket |
| bcrypt password hashing | Using rounds < 10 (too fast to crack) or > 14 (too slow for login UX) | Use 12 rounds — secure and sub-200ms on modern hardware |
| Express JSON body parser | No `limit` set — default 100kb; a malicious request with a huge body can stall the server | Set `express.json({ limit: '10kb' })` |
| PostgreSQL `pg` pool | Opening a new pool per request instead of one global pool | Create the pool once at startup; each request uses `pool.query()` |
| Daily bonus `last_claimed_at` | Storing as a date (midnight boundary) instead of a timestamp — allows double-claiming on the same calendar day | Store as `TIMESTAMPTZ` and compare against `NOW() - INTERVAL '24 hours'` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Leaderboard computed on every WebSocket request via `ORDER BY balance DESC` full table scan | Leaderboard updates slow down as user count grows; DB CPU spikes | Add `INDEX ON users(balance DESC)` and cache leaderboard query result for 5–10 seconds | ~5,000+ users with frequent updates |
| Broadcasting balance update to ALL connected clients on every bet | WebSocket server overloaded; message storm on heavy play periods | Only push to the specific user's socket for balance; use throttled batch updates for leaderboard | ~500+ concurrent connections |
| No database connection limit on `pg.Pool` | One spike in traffic exhausts all Postgres connections, causing 500 errors for all users | Set `max: 20` (or appropriate) on the pool and handle `pool full` errors gracefully | Depends on Postgres max_connections setting |
| Storing full game history in memory for analytics | Node.js heap grows unbounded; server crashes on long uptime | Always persist to DB; never accumulate in-process state | Days of uptime with active users |
| N+1 query on leaderboard endpoint (fetching user profile for each rank) | API response time grows linearly with leaderboard size | Use a single JOIN query to fetch all leaderboard data at once | Leaderboard size > 20 entries |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RNG server seed exposed before game completion | Player can compute all future outcomes and guarantee wins | Never send server seed or game state to client until round is fully resolved |
| Bet endpoint has no rate limiting | Automated bots can cycle through thousands of bets per second, exploiting any payout imbalance | Apply per-user rate limiting on all game POST endpoints (e.g., max 10 bets/second) |
| Admin routes not separately rate-limited | Credential stuffing can brute-force admin login | 5 attempts per 15-minute window on `/api/admin/login`, lockout after threshold |
| Game type not validated as an enum | Attacker sends `gameType: "../../etc/passwd"` or unexpected game type, causing undefined behavior | Whitelist: `['blackjack', 'roulette', 'plinko', 'mines']` — reject anything else |
| Stack traces returned in 500 errors | Reveals file paths, library versions, DB schema — aids targeted attack | Always return generic `{ error: "Internal server error" }` in production; log details server-side |
| No click interval validation server-side | Automation bots can trigger game actions at superhuman speed (e.g., 100 Mines reveals/second) | Validate minimum time between actions per user server-side; flag intervals < 50ms as suspicious |
| User IDs in URL paths without ownership check | Player accesses `/api/users/123/bets` where 123 is another player's ID | Always check `WHERE user_id = req.user.id` — never trust user ID from URL without ownership verification |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No optimistic balance update after bet | UI feels sluggish — players see a freeze between bet submission and result display | Show optimistic deduction immediately, correct with server response |
| Daily bonus countdown resets on page refresh | Players don't know when they can claim — creates confusion and frustration | Store `last_bonus_claimed_at` server-side; return remaining cooldown in API response; show countdown client-side |
| Leaderboard shows internal user IDs instead of usernames | Players can't identify competitors; feels broken | Always join leaderboard data with username; never expose numeric IDs in UI |
| Game result displayed before server confirms | If network error occurs after display, player thinks they won/lost incorrectly | Show result only after server response is received and confirmed |
| No feedback when bet is rejected (insufficient balance) | Player thinks game is broken | Return a clear `{ error: "Insufficient balance", currentBalance: X }` response; display it in the UI |

---

## "Looks Done But Isn't" Checklist

- [ ] **Server-side RNG:** Game outcome appears random — verify that `Math.random()` is nowhere in game resolution logic; all outcomes come from `crypto.randomBytes()` on the server
- [ ] **Balance protection:** Balance decrements visually — verify concurrent requests don't produce negative balances using the atomic UPDATE pattern
- [ ] **Daily bonus:** Bonus button works — verify it can't be claimed twice in 24h via parallel requests (test with `Promise.all` firing 5 simultaneous claim requests)
- [ ] **JWT security:** Auth appears to work — verify token secret is not the default `secret`, expiry is set, and algorithm is whitelisted
- [ ] **Admin gate:** Admin panel loads for admin users — verify a regular user cannot access it by manually constructing a request with `role: "admin"` in a forged token
- [ ] **Bet validation:** Bets submit correctly — verify the server rejects negative amounts, zero, amounts exceeding balance, and non-integer values
- [ ] **WebSocket auth:** Leaderboard updates live — verify that an unauthenticated WebSocket connection receives no data (test with `wscat` without a token)
- [ ] **Game session integrity:** Games complete correctly — verify the server stores game state and the client cannot submit a fabricated win result
- [ ] **SQL injection:** Queries work — run `sqlmap` or manually test `'; DROP TABLE users; --` in gameType fields
- [ ] **Floating-point safety:** Payouts calculate correctly — verify the system uses integer coin arithmetic throughout, with no floating-point multiplication in payout formulas

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Client-side RNG discovered post-launch | HIGH | Rewrite all game resolution logic server-side; invalidate all active sessions; audit game history for exploitation indicators |
| Balance race condition exploited (coin duplication) | HIGH | Identify affected accounts via audit log; reset exploited balances; add atomic UPDATE pattern; consider rolling back DB to pre-exploit snapshot |
| JWT secret compromised | HIGH | Rotate secret immediately (all existing sessions invalidated); force re-login for all users; audit logs for unauthorized admin access |
| SQL injection found in bet endpoint | HIGH | Patch immediately with parameterized queries; audit DB for unauthorized data access or modifications; rotate DB credentials |
| Admin privilege escalation discovered | HIGH | Immediately revoke all non-admin sessions; audit AdminLogs for unauthorized actions; patch RBAC logic; notify affected users if data was accessed |
| Daily bonus double-claimed (coin farming) | MEDIUM | Identify accounts via bet history anomalies; apply coin correction; add atomic claim logic; add rate limiting |
| Floating-point balance drift discovered | MEDIUM | Migrate balance column to INTEGER (store coins as whole units); run data migration to round/correct existing balances; add tests |
| WebSocket unauthenticated access | LOW-MEDIUM | Add JWT verification to connection handler; close all existing unauthenticated connections; no data loss, only information leak risk |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Client-side RNG | Game Infrastructure | Integration test: POST bet start → verify outcome not in response; POST reveal → verify server computes result |
| Balance race condition | Game Infrastructure | Concurrent request test: fire 10 simultaneous bet requests, verify balance never goes negative |
| Bet validation bypass | Game Infrastructure | Unit tests: submit negative, zero, non-integer, over-limit bet amounts — all must return 400 |
| JWT weak secret / missing claims | Auth & Accounts | Security test: decode token, modify role claim, re-encode — verify server rejects |
| JWT algorithm confusion | Auth & Accounts | Penetration test: send `"alg": "none"` token — verify server rejects with 401 |
| SQL injection in bet endpoints | Game Infrastructure | Automated: `sqlmap` scan on bet endpoints; manual: inject `;` in gameType field |
| WebSocket auth missing | Leaderboards / Real-Time | Integration test: connect WebSocket without token — verify connection is closed with 1008 |
| Admin privilege escalation | Admin Panel | Test: regular user JWT on admin routes — verify 403; test: forged admin token — verify DB check rejects it |
| Game state desync / client fabrication | Game Infrastructure | Test: POST win result with fabricated outcome not matching server session — verify 400 |
| Floating-point precision | Game Infrastructure | Unit tests: verify all payout calculations use integer arithmetic; grep codebase for `FLOAT` / `DECIMAL` in balance columns |
| Click automation bypass | Anti-Cheat (cross-cutting) | Load test: fire 1000 requests/second per user — verify rate limiter fires and click interval check triggers |
| Admin privilege escalation via ban bypass | Admin Panel | Test: ban user, attempt further bets with old JWT — verify 401 due to token_version mismatch |

---

## Sources

- [Building Provably Fair Casino Games: Implementing Cryptographic RNG in JavaScript](https://mailtoui.com/building-provably-fair-casino-games-implementing-cryptographic-rng-in-javascript/) — RNG implementation patterns (MEDIUM confidence, verified against Node.js crypto docs)
- [Winning Race Conditions with PostgreSQL](https://dev.to/mistval/winning-race-conditions-with-postgresql-54gn) — SELECT FOR UPDATE, SERIALIZABLE isolation, advisory locks (HIGH confidence, aligns with PostgreSQL official docs)
- [PostgreSQL Official Docs: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) — ACID transaction guarantees (HIGH confidence, official source)
- [Transaction Anomalies with SELECT FOR UPDATE | CYBERTEC](https://www.cybertec-postgresql.com/en/transaction-anomalies-with-select-for-update/) — Isolation level edge cases (HIGH confidence)
- [JWT Attacks | PortSwigger Web Security Academy](https://portswigger.net/web-security/jwt) — Algorithm confusion, none attack, claim manipulation (HIGH confidence, authoritative security reference)
- [Critical Vulnerabilities in JSON Web Token Libraries | Auth0](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/) — Library-level JWT pitfalls (HIGH confidence)
- [JWT Vulnerabilities: 2026 Security Risks | Red Sentry](https://redsentry.com/resources/blog/jwt-vulnerabilities-list-2026-security-risks-mitigation-guide) — Current JWT attack landscape (MEDIUM confidence)
- [Race Conditions | PortSwigger Web Security Academy](https://portswigger.net/web-security/race-conditions) — Time-of-check time-of-use exploits, bonus double-claim (HIGH confidence, authoritative)
- [WebSocket Security: 9 Common Vulnerabilities | Ably](https://ably.com/topic/websocket-security) — WebSocket auth patterns and DoS risks (MEDIUM confidence)
- [Node.js SQL Injection Guide | StackHawk](https://www.stackhawk.com/blog/node-js-sql-injection-guide-examples-and-prevention/) — Parameterized query patterns in Express/pg (MEDIUM confidence)
- [JavaScript Rounding Errors in Financial Applications | Robin Wieruch](https://www.robinwieruch.de/javascript-rounding-errors/) — Floating-point pitfalls in JS (HIGH confidence)
- [Price Manipulation via Integer Overflow | Medium](https://marxchryz.medium.com/price-manipulation-bypass-using-integer-overflow-method-36ff23ebe91d) — Negative amount bypass patterns (MEDIUM confidence)
- [Betting Bots: How to Stop and Prevent Them | Fingerprint](https://fingerprint.com/blog/betting-bots/) — Automation detection techniques (MEDIUM confidence)
- [Unauthorized Privilege Escalation via Role Manipulation | hashnode](https://chiomaibeakanma.hashnode.dev/unauthorized-privilege-escalation-vulnerability-via-role-manipulation) — RBAC bypass patterns (MEDIUM confidence)
- [Casino Gaming Cybersecurity Threats 2025 | Saturn Partners](https://saturnpartners.com/2025/10/casino-gaming-cybersecurity-threats/) — Industry threat landscape (LOW confidence, marketing source)
- [OWASP: Testing for Privilege Escalation](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/03-Testing_for_Privilege_Escalation) — Access control testing patterns (HIGH confidence, authoritative)

---
*Pitfalls research for: Browser-based virtual casino / gambling platform*
*Researched: 2026-02-27*
