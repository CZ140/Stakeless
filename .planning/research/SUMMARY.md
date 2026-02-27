# Project Research Summary

**Project:** Browser-Based Virtual Casino Platform
**Domain:** Social gambling / virtual casino (Blackjack, Roulette, Plinko, Mines)
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a browser-based social casino platform using virtual currency only — no real money. The domain is well-understood: real-money casino platforms have established patterns for server-side RNG, atomic balance transactions, and WebSocket leaderboards that translate directly to a virtual-currency implementation. The recommended approach is a monorepo with a React 19 + Vite frontend and a Node.js 22 / Express 5 backend, sharing TypeScript types, backed by PostgreSQL 16+ with Drizzle ORM. The architecture follows a strict separation: game engines are pure server-side functions, all balance mutations run inside PostgreSQL transactions with row-level locking, and WebSockets handle only outbound push (leaderboard, balance sync) rather than game actions.

The biggest risks in this domain are not technical complexity but security discipline. Three failure modes appear repeatedly in casino platforms: client-side RNG (trivially exploitable by any player), balance race conditions (double-spend via concurrent bet requests), and JWT misuse (weak secrets enabling admin privilege escalation). All three are preventable if the wallet transaction service and authentication layer are built correctly in the first two phases — before any game UI exists. The architecture research is unusually specific about build order: Foundation → Auth → Wallet must be fully implemented and tested before game engines are added.

The feature scope is well-matched to a v1 build. The four games (Blackjack, Roulette, Plinko, Mines) have clear implementation patterns from competitor analysis of Stake.com and BC.Game. The primary scope risk is the Roulette wheel animation — a full 3D/canvas animated wheel is rated HIGH complexity and is the only feature where scope creep is likely. All other v1 features are LOW to MEDIUM complexity. Autoplay, chat, multiplayer Poker, VIP tiers, and cosmetic marketplaces are explicitly identified as anti-features or v2+ deferred work and should not enter the v1 scope under any circumstances.

---

## Key Findings

### Recommended Stack

The full-stack TypeScript approach (React 19 / Express 5 / Drizzle ORM / PostgreSQL) is the clear winner for this project. Drizzle ORM is preferred over Prisma specifically because its SQL-first TypeScript schema stays auditable alongside the codebase — important when bet payout logic runs in the same transaction layer. Socket.IO 4.8 is chosen over raw WebSockets because the leaderboard broadcast pattern (`io.to('leaderboard').emit()`) is built in, removing manual client-set management. All game outcome RNG uses Node.js `crypto.randomInt()` from the standard library — no third-party RNG dependency is needed or acceptable.

Authentication uses short-lived JWTs (15-minute access tokens stored in memory, 7-day refresh tokens in httpOnly cookies). The JWT pattern is explicit: bcrypt at cost factor 12 for password hashing, `HS256` algorithm whitelisted in `jwt.verify()`, and admin routes verified against the database on every request rather than trusting the token claim alone. For animation, Motion (formerly Framer Motion) 12.x handles all standard game animations; GSAP is only introduced if Plinko ball physics or Roulette wheel spin requires multi-step timeline control.

**Core technologies:**
- Node.js 22 LTS + Express 5: backend runtime and HTTP API — async error propagation built in, active LTS until April 2027
- React 19 + Vite 6 + TypeScript 5: frontend — concurrent rendering, Actions API, sub-100ms HMR
- PostgreSQL 16/17 + Drizzle ORM 0.45: primary datastore — ACID transactions mandatory for bet atomicity
- Socket.IO 4.8: WebSocket server — rooms/namespaces built in, Redis adapter available for future scale
- Zustand 5 + TanStack Query 5: client state — Zustand for session/UI, TanStack Query for server state
- Tailwind CSS 4 + shadcn/ui: styling — copy-owned components, dark theming straightforward
- Motion 12: animation — declarative, GPU-accelerated; covers card flip, chip slide, win/loss feedback
- Node.js `crypto` module: RNG — CSPRNG via OS entropy pool, no third-party dependency

**Explicit do-not-use list:** `Math.random()` for game outcomes, `localStorage` for JWTs, Redux Toolkit, Sequelize/TypeORM, MongoDB/Mongoose, `express@4`, `bcrypt-nodejs`, raw `ws` for leaderboard broadcasting.

### Expected Features

Research from casino UX conventions and competitor analysis (Stake.com, BC.Game, Pulsz) confirms the planned v1 feature set is well-scoped. The dependency chain is clear: Auth → Wallet → Game Infrastructure must be sequential; everything else (leaderboards, profiles, admin) can follow once the core bet pipeline is solid.

**Must have (table stakes):**
- Persistent balance display in header — users expect this at all times; absence causes immediate distrust
- Quick-select bet chips (Half / Double / Max) — standard casino UI; typing raw numbers feels unpolished
- Win/loss feedback animations with sound — silent state changes read as losses regardless of outcome
- Sound effects with persistent mute toggle — mute state must survive page refresh via localStorage
- Daily bonus with 24-hour gate — the core free-to-play retention loop; non-negotiable for social casinos
- Server-side bet validation — all deduct/resolve/credit logic server-side only; client-trust is an exploit
- Game rules / how-to-play panel — casual users abandon without accessible rules
- Min/max bet enforcement — both UI display and server-side guard
- Sufficient starting balance — enough for ~50-100 minimum bets; zero-balance dead-ends cause churn
- Plinko ball physics animation — the game's entire identity; a static result message destroys the experience
- Mines cashout button with live multiplier — core decision loop of the game; must be prominent
- Roulette wheel spin animation — tension-building moment; skipping animation fails the experience (scope risk: HIGH)
- Real-time leaderboard via WebSocket — leaderboards that require page refresh feel stale
- Multiple leaderboard dimensions (Balance / Total Wagered / Profit) — already scoped in PROJECT.md
- Player profile with stats and balance chart — private stats are table stakes; chart data is already in game_logs

**Should have (competitive differentiators):**
- Progressive daily bonus streak (Day 1-7 escalating rewards) — significantly increases day-3/4 return rate; defer to v1.x
- Bet history UI (last 50 rounds per game) — trigger: player feedback asking about balance changes
- Keyboard shortcuts for Blackjack — power user UX polish; trigger: explicit user requests
- Per-game themed sound design — game-specific audio vs shared library; trigger: aesthetic feedback

**Defer (v2+):**
- Slots / Case Spinner — game library expansion after v1 validated
- Poker (multiplayer + bot fill) — separate engineering workstream; high complexity
- VIP tier / loyalty points — premature without validated player base
- Cosmetic marketplace — requires monetization model decision
- Chat / social features — requires moderation infrastructure
- Provably fair verification UI — trust differentiator for a later stage
- Clicker/idle progression system — explicitly deferred in PROJECT.md

**Anti-features (never build for v1):**
- Autoplay / auto-bet — peer-reviewed research shows +7-9% total gambling activity increase; defeats interactive game loop
- Real-time multiplayer (Poker tables) — matchmaking, room state, bot fill, disconnect handling = separate workstream
- Client-side outcome trust — trivially exploitable; reputation destruction if discovered

### Architecture Approach

The architecture follows a layered, dependency-ordered design: Client Layer (React) → API Layer (Express REST + Socket.IO push) → Service / Business Layer (AuthService, WalletService, per-game Engines) → Data Access Layer (Drizzle + pg) → PostgreSQL. Game engines are pure stateless functions with no I/O — they receive validated inputs and return outcomes deterministically from a crypto seed. All balance mutations are funneled through a single WalletService using `BEGIN` / `SELECT ... FOR UPDATE` / `UPDATE` / `COMMIT`. WebSockets are strictly push-only; bets travel via REST HTTP only.

**Major components:**
1. WalletService — single choke-point for all balance mutations; owns the atomic PostgreSQL transaction
2. Game Engines (per game) — pure stateless functions; no DB calls; fully unit-testable in isolation
3. WebSocket Server — outbound push only; authenticated on connection handshake; never carries bet requests
4. Admin Router — isolated on `/api/admin/*` with `authenticate` + `requireAdmin` (DB-verified) middleware chain
5. PostgreSQL schema — balance as BIGINT (integer coins, no floats); game_logs as append-only audit trail; denormalized leaderboard columns (`total_wagered`, `total_profit`) on users table for fast queries

**Key schema decisions:** Balance stored as BIGINT integer coins (never FLOAT), game_logs append-only with RNG seed stored for auditability, `banned_at` as nullable timestamp (soft delete), `total_wagered`/`total_profit` denormalized on users table for leaderboard performance.

**Game-specific architecture notes:**
- Blackjack requires multi-step server session state (deal → player turn → dealer turn) — build after Roulette/Plinko/Mines to validate the simpler stateless pattern first
- Mines requires a `game_sessions` table to store the authoritative mine grid server-side; the client sends only tile coordinates, never outcomes
- Plinko and Roulette animations must reveal a server-predetermined result; the animation path must match the actual outcome

### Critical Pitfalls

All eight documented pitfalls have HIGH recovery cost if discovered post-build. The top five are:

1. **Client-side RNG** — `Math.random()` or any client-computed outcome. Prevention: all game resolution logic server-side only; `crypto.randomBytes()` for seed generation. Red flag: if `Math.random()` appears anywhere in game-related files, the build is compromised.

2. **Balance race condition (double-spend)** — Two concurrent requests both pass the balance check before either deducts. Prevention: `SELECT ... FOR UPDATE` row lock within a `BEGIN/COMMIT` transaction, or atomic `UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance` with 0-row check. Test with `Promise.all` firing 10 simultaneous bet requests.

3. **JWT misuse** — Weak secret, missing algorithm whitelist, no expiry, role trusted from token without DB verification. Prevention: 256-bit random secret, `algorithms: ['HS256']` in `jwt.verify()`, 15-minute access token expiry, DB lookup on every admin request. Admin ban must invalidate tokens via `token_version` counter.

4. **Game state desync** — Mines/Blackjack state stored only in React; client sends fabricated win result. Prevention: `game_sessions` table stores authoritative server state; client sends only player actions (tile coordinate, hit/stand); server validates every action against stored state.

5. **SQL injection** — Template literal string interpolation into SQL queries. Prevention: always use parameterized queries `pool.query('... WHERE id = $1', [userId])`; `gameType` validated against whitelist `['blackjack', 'roulette', 'plinko', 'mines']` before reaching the query.

**Performance pitfalls to address before scale:**
- Leaderboard full table scan on every WebSocket broadcast — add `INDEX ON users(balance DESC)` and throttle broadcasts to 1-2 second intervals
- Balance push to ALL connected clients — push only to the specific user's socket for balance; broadcast only for leaderboard changes
- N+1 query on leaderboard endpoint — use a single JOIN query

---

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md and the pitfall-to-phase mapping in PITFALLS.md, the build order is hard-constrained. Phases 1-3 must be complete and tested before any game is built. The wallet transaction service is the architectural foundation everything else sits on — building game UIs before WalletService is tested is explicitly identified as the most common cause of difficult-to-fix bugs in this type of system.

### Phase 1: Foundation & Infrastructure
**Rationale:** Zero-dependency starting point. Database schema, Express skeleton, and environment config have no upstream requirements. These decisions are irreversible once games are built on top — get them right first.
**Delivers:** PostgreSQL schema (users, game_logs, daily_bonus_claims, admin_logs, game_sessions), Express app with CORS/helmet/body parsing, pg pool singleton, .env structure, TypeScript project config, Drizzle schema and migration setup, Vite React frontend scaffold
**Addresses:** Integer coin schema (BIGINT not FLOAT), append-only game_logs design, indexed leaderboard columns
**Avoids:** Floating-point balance drift (schema decision made here), N+1 leaderboard queries (indexes created here)
**Research flag:** Standard patterns — no additional research needed

### Phase 2: Authentication & Authorization
**Rationale:** Auth gates everything else. RBAC must be designed into the user model before any protected route is built. JWT pattern, bcrypt cost factor, and token revocation strategy are foundational decisions that touch every subsequent phase.
**Delivers:** User registration + bcrypt password hashing, login + JWT issue (HS256, 15-min access + 7-day httpOnly refresh), `authenticate` middleware, `requireAdmin` middleware (DB-verified), password reset flow, `token_version` column for ban invalidation
**Addresses:** JWT weak secret pitfall, algorithm confusion attack, role escalation via token claim
**Avoids:** Admin privilege escalation, token-not-invalidated-on-ban bug
**Research flag:** Standard patterns — OWASP guidance is clear; no additional research needed

### Phase 3: Wallet Core & Daily Bonus
**Rationale:** WalletService is the single most critical component. Every game, every leaderboard update, every balance display depends on it being correct. Build and test this in isolation before any game engine touches it.
**Delivers:** `WalletService.placeBet()` with full `BEGIN/SELECT FOR UPDATE/UPDATE/COMMIT` transaction, balance read endpoint, starting balance on registration, daily bonus claim with atomic 24-hour gate
**Addresses:** Balance race condition (double-spend prevention), daily bonus double-claim prevention, balance persistence
**Avoids:** Race conditions on concurrent bets, coin farming via parallel bonus claims
**Research flag:** Standard patterns — PostgreSQL transaction patterns are well-documented; no additional research needed

### Phase 4: Game Infrastructure & First Game (Roulette)
**Rationale:** Establish the server-side game resolution pattern with the simplest game (Roulette is stateless — no session management). BetLogService and the game_sessions table must exist before Blackjack or Mines. Roulette validates the RNG-to-outcome-to-wallet pipeline end-to-end.
**Delivers:** RNG utilities (`crypto.randomBytes`, `seedToFloat`, `seedToRange`), `GameEngine` interface, Roulette engine (pure stateless function), `POST /api/games/roulette/bet` route, BetLogService (append-only game_logs writes), bet validation middleware (negative/zero/non-integer/over-limit rejection), `game_sessions` table
**Addresses:** Server-side RNG (never `Math.random()`), bet validation bypass, SQL injection in bet endpoints, game state desync
**Avoids:** Client-side outcome trust, parameterized query violations
**Research flag:** Standard patterns for Roulette engine and parameterized queries; no additional research needed

### Phase 5: Remaining Game Engines
**Rationale:** Build games in order of complexity. Plinko is stateless (easiest). Mines adds session state. Blackjack adds multi-step session state (most complex). Validate simpler patterns before adding complexity.
**Delivers:** Plinko engine (stateless, risk level + rows → bucket), Mines engine (game_sessions for grid storage, cashout mechanic), Blackjack engine (multi-step session: deal → player turn → dealer turn → outcome), per-game routes, Mines cashout endpoint
**Addresses:** Game state desync in Mines and Blackjack (server-authoritative session), Plinko ball path matching server-determined outcome
**Avoids:** Client-fabricated win results in session-based games
**Research flag:** Blackjack dealer rule implementation (hit-on-soft-17 vs stand) may need validation — standard rules but worth confirming against PROJECT.md spec. Plinko multiplier tables need to match the documented risk/row matrix.

### Phase 6: WebSocket Server & Real-Time Push
**Rationale:** WebSocket is introduced here — authentication must be built in from the first connection, not retrofitted. Depends on Phase 3 (needs balance events) and Phase 2 (JWT verification on handshake).
**Delivers:** Socket.IO server init with JWT handshake authentication, `userSockets` registry, `pushBalanceUpdate` (targeted to individual user), `broadcastLeaderboard` (throttled, all subscribers), WebSocket client hook in React
**Addresses:** WebSocket unauthenticated access pitfall, targeted vs broadcast push separation, leaderboard broadcast throttling (1-2 second debounce)
**Avoids:** Bets sent over WebSocket (REST only), unauthenticated connections receiving data
**Research flag:** Standard patterns — no additional research needed

### Phase 7: Leaderboards
**Rationale:** Depends on Phase 3 (denormalized stats columns), Phase 6 (WebSocket broadcast). The denormalized `total_wagered` and `total_profit` columns already updated within each bet transaction make leaderboard queries fast without aggregation.
**Delivers:** LeaderboardService (DB queries against indexed denormalized columns), `GET /api/leaderboard` endpoints (Balance / Wagered / Profit dimensions), WebSocket broadcast trigger after bet completion, player's own rank included in response ("You: #47"), top-10 display with expanded top-50 view
**Addresses:** Leaderboard full table scan (uses indexed columns), N+1 query pattern (single JOIN), real-time feel vs stale page-refresh updates
**Avoids:** Leaderboard showing internal user IDs instead of usernames
**Research flag:** Standard patterns — no additional research needed

### Phase 8: Player Profile & Game History
**Rationale:** Depends on Phase 3 and Phase 4 (game_logs data). No new data collection needed — queries existing tables. Recharts balance-over-time chart queries running balance from game_logs.
**Delivers:** `GET /api/profile/:id` endpoint (own profile only, ownership check mandatory), stats display (total wagered, profit/loss, games played per type), balance-over-time chart using Recharts, game history display (last 20-50 rounds per game type)
**Addresses:** User ID in URL path without ownership check vulnerability, leaderboard showing IDs vs usernames
**Avoids:** `SELECT *` on user rows, exposing other players' private data
**Research flag:** Standard patterns — no additional research needed

### Phase 9: Admin Panel
**Rationale:** Built last because it depends on all prior phases (user data, game logs, RBAC). Admin panel is a read/write operator tool, not a player-facing feature.
**Delivers:** Admin router (`/api/admin/*`) with `authenticate` + `requireAdmin` (DB-verified) middleware, AdminService (user lookup, ban with token_version increment, balance reset), AdminLogs audit trail (every admin action recorded), admin dashboard with platform stats, React admin UI behind role-gated routes
**Addresses:** Admin privilege escalation, ban not invalidating existing JWTs, `SELECT *` returning password hashes, missing audit trail
**Avoids:** Admin routes without rate limiting, non-admin users accessing admin endpoints
**Research flag:** Standard patterns — no additional research needed

### Phase 10: React Frontend (Game UIs & Polish)
**Rationale:** Frontend game UIs can be built in parallel with Phase 4+ on the backend once API contracts are defined. This phase captures the complete frontend build including animations, sound, and UX polish.
**Delivers:** Auth pages (login/register), dashboard with balance display and daily bonus, all four game UIs with Motion animations (card flip, chip slide, ball physics, tile reveal, wheel spin), win/loss feedback animations, sound system with persistent mute toggle, quick-select bet chips, game rules panels, optimistic balance updates with server correction, admin panel UI (last, behind role check)
**Addresses:** Roulette wheel animation (scope risk — highest complexity game animation), Plinko ball path must match server-determined outcome, Mines animation timing relative to server response
**Avoids:** Game result displayed before server confirmation, mute state not persisting across sessions
**Research flag:** Roulette wheel animation implementation is the one area that may warrant deeper research during planning. A full 3D canvas wheel with realistic ball deceleration is rated HIGH complexity. Evaluate whether Motion 12 suffices or whether GSAP timeline control is needed before committing to implementation approach.

### Phase Ordering Rationale

- **Phases 1-3 are non-negotiable prerequisites:** The architectural research is explicit that wallet transaction correctness is the foundation everything else depends on. Any shortcut here propagates bugs into every game.
- **Roulette before other games (Phase 4):** Stateless game validates the RNG-to-wallet pipeline without session complexity. Mines and Blackjack add session state that is harder to retrofit if the base pattern is wrong.
- **WebSocket after Wallet (Phase 6 after Phase 3):** The WS server emits balance events generated by WalletService. Socket.IO cannot be architected correctly before WalletService exists.
- **Admin Panel last (Phase 9):** It depends on all data produced by prior phases and has no dependencies in the other direction.
- **Frontend overlaps with Phase 4+ backend:** React game UIs can be built in parallel once the API contract is established in Phase 4. This is the primary opportunity for parallel work.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Blackjack):** Dealer hit-on-soft-17 rule confirmation against PROJECT.md spec. Multi-step session state design for Blackjack (deal → player turn → dealer turn) warrants a planning-time architecture decision on session storage approach (DB vs in-process).
- **Phase 10 (Roulette animation):** Motion 12 vs GSAP for the wheel spin. If the wheel requires realistic ball deceleration with bounce easing curves, GSAP timeline control may be necessary. This decision affects the animation library dependency list.

Phases with standard, well-documented patterns (skip research-phase):
- Phase 1 (Foundation): PostgreSQL schema design, Express setup, Drizzle migrations — all standard
- Phase 2 (Auth): JWT + bcrypt patterns are extensively documented; OWASP guidance is current
- Phase 3 (Wallet): PostgreSQL transaction with `SELECT FOR UPDATE` is the established pattern
- Phase 6 (WebSocket): Socket.IO authentication and room management are well-documented
- Phase 7 (Leaderboards): Indexed query + WebSocket broadcast pattern is standard
- Phase 8 (Profile): Standard profile endpoint with Recharts — no novel patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core stack (Node/Express/React/PG) verified via npm registry and official release notes. Drizzle vs Prisma comparison from multiple 2026 articles, consistent conclusion. shadcn/ui Radix dependency uncertainty is noted but non-blocking for v1. |
| Features | MEDIUM-HIGH | Casino UX conventions are well-documented across iGaming industry sources. Competitor feature analysis (Stake.com, BC.Game) is empirical. Autoplay harm data is from a peer-reviewed Frontiers in Psychiatry study (HIGH confidence). Some casino-specific UX stats (e.g., "60-75% mobile traffic") are MEDIUM confidence single studies. |
| Architecture | MEDIUM-HIGH | Core patterns (atomic transactions, server-side RNG, WebSocket push-only) are verified against PostgreSQL official docs and Node.js crypto docs (HIGH confidence). Social-casino-specific implementations are sparse — patterns are extrapolated from real-money casino architecture, which is appropriate but introduces some inference. |
| Pitfalls | HIGH | Security pitfalls sourced from PortSwigger Web Security Academy, Auth0 official blog, OWASP testing guide, and PostgreSQL official documentation. Race condition patterns verified against PostgreSQL CYBERTEC documentation. Recovery costs are well-established in security literature. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Email infrastructure for password reset:** The stack recommends Nodemailer or SendGrid but doesn't specify which. This decision needs to be made during Phase 2 planning — it affects infrastructure setup.
- **bcrypt native compilation on deployment target:** `bcrypt@6` requires `node-gyp` (Python + C++ compiler). This is a deployment environment concern that needs validation before Phase 2 build starts, particularly if using a containerized environment.
- **Roulette bet type completeness:** The competitor analysis confirms "all standard bet types" but doesn't enumerate them exhaustively. European Roulette has approximately 20 bet types (red/black, odd/even, columns, dozens, straight, split, street, corner, six-line). Confirming the exact set against PROJECT.md before Phase 4/5 prevents scope misalignment.
- **Blackjack session storage during multi-step play:** The architecture specifies server-side game sessions but doesn't resolve whether the mid-round Blackjack state lives in a `game_sessions` table (durable across reconnect) or in-process Redis/Map (faster, lost on restart). This is a Phase 5 planning decision.
- **Mines grid size:** Research references a "5x5 grid, 1-24 mine count" pattern (from Stake.com), but PROJECT.md should be the authoritative source. Confirm grid dimensions and mine count range before Phase 5.

---

## Sources

### Primary (HIGH confidence)
- Node.js crypto.randomInt docs — https://nodejs.org/api/crypto.html — RNG implementation
- PostgreSQL Official Docs: Transactions — https://www.postgresql.org/docs/current/tutorial-transactions.html — ACID guarantees
- PostgreSQL SELECT FOR UPDATE behavior — CYBERTEC, brandur.org — isolation and row locking
- JWT Attacks — PortSwigger Web Security Academy — algorithm confusion, none attack, claim manipulation
- Critical Vulnerabilities in JSON Web Token Libraries — Auth0 — library-level JWT pitfalls
- OWASP: Testing for Privilege Escalation — access control testing patterns
- Race Conditions — PortSwigger Web Security Academy — time-of-check time-of-use exploits
- Google Cloud: Real-time Gaming with Node.js + WebSocket — architecture reference
- Offering an auto-play feature likely increases total gambling activity — Frontiers in Psychiatry (peer-reviewed)
- The Impact of Sound in Modern Multiline Video Slot Machine Play — PMC/NIH (peer-reviewed)

### Secondary (MEDIUM confidence)
- npm registry (all packages) — version verification for Socket.IO, Drizzle, Motion, Recharts, Zustand, TanStack Query, jsonwebtoken, bcrypt, helmet, express-rate-limit
- Express 5 official blog — v5.1.0 became npm default March 2025
- React blog — React 19.2.0 stable
- Tailwind CSS v4 announcement — PostCSS pipeline changes
- Node.js release schedule — Node 22 active LTS until 2027-04-30
- Bytebase: Drizzle vs Prisma 2026 — ORM comparison
- Multiple iGaming UX/UI articles (2025-2026) — casino UX conventions
- Social Casino industry guides (2026) — feature landscape and player expectations
- WebSocket security patterns — Ably, MergeSociety

### Tertiary (LOW confidence)
- Casino Database Schema Reference — GitHub casino-team1 (student project, used only as schema structure reference)
- Saturn Partners: Casino Gaming Cybersecurity Threats 2025 — marketing source, threat landscape orientation only

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
