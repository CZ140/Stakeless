# Virtual Casino Platform

## What This Is

A browser-based entertainment platform where users play casino-style games (Blackjack, Roulette, Plinko, Mines) using virtual currency — no real money, no deposits, no withdrawals. Players earn coins through gameplay and a daily bonus system, compete on three live leaderboards, and track their progression over time on public profile pages. Built as a full-stack learning project with real competitive mechanics.

## Core Value

Players can jump in daily, collect their bonus, play fair-odds casino games with virtual coins, and compete against others on leaderboards — all without any real-money risk.

## Requirements

### Validated

**Auth & Accounts**
- ✓ User can register with email and password — v1.0
- ✓ User can log in and maintain a persistent session (JWT) — v1.0
- ✓ User can log out — v1.0
- ✓ User can reset password via email link — v1.0
- ✓ User profile stores: balance, total wagered, total profit/loss, account dates — v1.0

**Virtual Currency**
- ✓ New users receive a starting balance — v1.0 (1,000 coins)
- ✓ User can claim a daily bonus (once per 24 hours) from the dashboard — v1.0
- ✓ Balance updates in real-time after each game — v1.0 (Socket.IO WebSocket push)

**Games — v1 Core Four**
- ✓ Blackjack: single-player vs dealer, hit/stand/double-down — v1.0
- ✓ Roulette: European wheel with red/black, odd/even, number, dozens, columns bets — v1.0
- ✓ Plinko: user selects bet amount, risk level, and rows; multiplier determined by final slot — v1.0
- ✓ Mines: user selects bet amount, grid size, and mine count; safe tiles increase multiplier, mines end round — v1.0

**Game Infrastructure**
- ✓ All games deduct bet before play and credit winnings after — v1.0
- ✓ Every game logs: UserID, GameType, BetAmount, Result, Profit, Timestamp — v1.0
- ✓ Game outcomes calculated server-side (no client trust) — v1.0 (crypto.randomInt)

**Leaderboards**
- ✓ Balance leaderboard (top users by current balance) — v1.0
- ✓ Total wagered leaderboard — v1.0
- ✓ Profit leaderboard — v1.0
- ✓ Real-time updates via WebSockets — v1.0 (Socket.IO, 7s broadcast)

**Player Profile**
- ✓ Public profile page: username, balance, rank, total wagered, total profit, games played — v1.0
- ✓ Balance over time chart — v1.0 (Recharts LineChart)
- ✓ Wagered per day chart — v1.0 (Recharts BarChart)

**Admin Panel**
- ✓ Admin login with role-based access control (DB-verified on every request) — v1.0
- ✓ Dashboard: total users, total bets, coins in system, most active users — v1.0
- ✓ Player inspector: search user, view balance + game/wager history — v1.0
- ✓ Admin can ban or reset a player account (with immediate session invalidation) — v1.0

**Anti-Cheat**
- ✓ Server-side rate limiting on all game and click endpoints (30 req/min/IP) — v1.0
- ✓ Server-side validation of all bet amounts and game outcomes — v1.0
- ✓ Click interval checks to detect automation (100ms minimum) — v1.0

### Active

(None — all v1.0 requirements validated. Define v2.0 requirements with `/gsd:new-milestone`.)

### Out of Scope

- Real money, deposits, withdrawals, payment processors — by design, never
- Cryptocurrency — explicitly excluded
- Clicker progression system — deferred to v2 (daily bonus covers retention for v1)
- Slots, Case Spinner — deferred to v2
- Poker (multiplayer + bots) — deferred to v2; when built: real-time tables with bot fill support
- Blackjack split — optional, deferred to v2
- Mobile app — web-first
- Chat, friends, tournaments — v2+
- Cosmetic marketplace — v2+

## Context

- Shipped v1.0 with ~9,465 LOC TypeScript (199 files, 149 commits) in 8 days
- Tech stack: React 19 + Vite, Node.js/Express, PostgreSQL + Drizzle ORM, Socket.IO, GSAP, Framer Motion, Zustand v5, Recharts, Zod, pnpm monorepo
- Known tech debt: no Nyquist VALIDATION.md files; 12 requirements have doc-only gaps in SUMMARY frontmatter; one dead API endpoint (POST /api/wallet/bet)
- Target audience: casual gamers, competitive players, small friend groups; also developers/students studying game probability
- Real-time feel achieved: balance and all three leaderboards update live without page refresh

## Constraints

- **Tech Stack**: React (frontend) + Node.js/Express (backend API) — chosen explicitly
- **Database**: PostgreSQL — tables: users, game_logs, game_sessions, daily_bonus_claims, admin_logs, refresh_tokens, email_verification_tokens, password_reset_tokens
- **Auth**: JWT sessions (15-min access + 7-day refresh httpOnly cookie), passwords hashed with bcryptjs
- **Real-Time**: Socket.IO (leaderboards, balance sync)
- **No Real Money**: Platform must never handle or imply real financial value

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Node/Express (separate apps) | Maximum separation of concerns, classic fullstack split | ✓ Good — clean boundary, easy to develop independently |
| PostgreSQL over NoSQL | Relational data (bets, users, sessions) benefits from joins and transactions | ✓ Good — SELECT FOR UPDATE atomicity was essential for balance |
| Server-side game logic only | Prevents client-side cheating; all outcomes validated server-side | ✓ Good — crypto.randomInt() on server; client cannot fabricate outcomes |
| Daily bonus in v1, clicker in v2 | Daily bonus covers retention; clicker adds complexity without critical value at launch | ✓ Good — simple retention loop shipped cleanly |
| Basic admin panel for v1 | Full RTP/advantage controls are advanced features; ban/reset covers essential moderation | ✓ Good — ban + audit log sufficient for v1 |
| European roulette (single zero) | Better odds, standard for fair-play contexts | ✓ Good — no issues |
| Balance as BIGINT integer coins | Avoid float precision issues for monetary values | ✓ Good — no precision bugs, consistent across all game calculations |
| pnpm workspace monorepo | Single repo, shared types package, workspace protocol | ✓ Good — @gambling/shared types used across backend/frontend without duplication |
| Drizzle ORM over Prisma | Closer to SQL, easier transactions, lighter | ✓ Good — SELECT FOR UPDATE via .for('update') worked cleanly |
| Socket.IO for real-time | Established library, easy rooms/targeted events | ✓ Good — balance push + leaderboard broadcast both simple to implement |
| Decimal phase numbering (3.1, 5.1, 5.2) | Clear insertion semantics for gap-closure phases without renumbering | ✓ Good — 3 inserted phases closed critical gaps without disrupting roadmap |
| gameLimiter before requireAuth | Rate limit before DB auth query maximizes bot rejection efficiency | ✓ Good — bots hit limit before consuming DB resources |

---
*Last updated: 2026-03-06 after v1.0 milestone*
