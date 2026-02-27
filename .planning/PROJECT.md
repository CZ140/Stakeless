# Virtual Casino Platform

## What This Is

A browser-based entertainment platform where users play casino-style games (Blackjack, Roulette, Plinko, Mines) using virtual currency — no real money, no deposits, no withdrawals. Players earn coins through gameplay and a daily bonus system, compete on leaderboards, and track their progression over time. Built as a full-stack learning project with real competitive mechanics.

## Core Value

Players can jump in daily, collect their bonus, play fair-odds casino games with virtual coins, and compete against others on leaderboards — all without any real-money risk.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Auth & Accounts**
- [ ] User can register with email and password
- [ ] User can log in and maintain a persistent session (JWT)
- [ ] User can log out
- [ ] User can reset password via email link
- [ ] User profile stores: balance, total wagered, total profit/loss, account dates

**Virtual Currency**
- [ ] New users receive a starting balance
- [ ] User can claim a daily bonus (once per 24 hours) from the dashboard
- [ ] Balance updates in real-time after each game

**Games — v1 Core Four**
- [ ] Blackjack: single-player vs dealer, hit/stand/double-down
- [ ] Roulette: European wheel with red/black, odd/even, number, dozens, columns bets
- [ ] Plinko: user selects bet amount, risk level, and rows; multiplier determined by final slot
- [ ] Mines: user selects bet amount, grid size, and mine count; safe tiles increase multiplier, mines end round

**Game Infrastructure**
- [ ] All games deduct bet before play and credit winnings after
- [ ] Every game logs: UserID, GameType, BetAmount, Result, Profit, Timestamp
- [ ] Game outcomes calculated server-side (no client trust)

**Leaderboards**
- [ ] Balance leaderboard (top users by current balance)
- [ ] Total wagered leaderboard
- [ ] Profit leaderboard
- [ ] Real-time updates via WebSockets

**Player Profile**
- [ ] Public profile page: username, balance, rank, total wagered, total profit, games played
- [ ] Balance over time chart
- [ ] Wagered per day chart

**Admin Panel (Basic)**
- [ ] Admin login with role-based access control
- [ ] Dashboard: total users, total bets, coins in system, most active users
- [ ] Player inspector: search user, view balance + game/wager history
- [ ] Admin can ban or reset a player account

**Anti-Cheat**
- [ ] Server-side rate limiting on all game and click endpoints
- [ ] Server-side validation of all bet amounts and game outcomes
- [ ] Click interval checks to detect automation

### Out of Scope

- Real money, deposits, withdrawals, payment processors — by design, never
- Cryptocurrency — explicitly excluded
- Clicker progression system — deferred to v2 (daily bonus covers retention for v1)
- Slots, Case Spinner — deferred to v2
- Poker (multiplayer + bots) — deferred to v2; when built: real-time tables with bot fill support
- Blackjack split — optional, deferred
- Mobile app — web-first
- Chat, friends, tournaments — v2+
- Cosmetic marketplace — v2+

## Context

- This is a greenfield programming project intended to demonstrate full-stack skills
- Target audience: casual gamers, competitive players, small friend groups; also developers/students studying game probability
- No existing codebase — building from scratch
- Real-time feel is important: balance and leaderboard updates should feel live, not page-refresh
- Admin panel is for the operator/developer, not public-facing

## Constraints

- **Tech Stack**: React (frontend) + Node.js/Express (backend API) — chosen explicitly
- **Database**: PostgreSQL — tables: Users, Bets, Games, ClickerUpgrades (future), Leaderboards, AdminLogs
- **Auth**: JWT sessions, passwords hashed with bcrypt
- **Real-Time**: WebSockets (leaderboards, balance sync)
- **No Real Money**: Platform must never handle or imply real financial value

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Node/Express (separate apps) | Maximum separation of concerns, classic fullstack split | — Pending |
| PostgreSQL over NoSQL | Relational data (bets, users, sessions) benefits from joins and transactions | — Pending |
| Server-side game logic only | Prevents client-side cheating; all outcomes validated server-side | — Pending |
| Daily bonus in v1, clicker in v2 | Daily bonus covers retention; clicker adds complexity without critical value at launch | — Pending |
| Basic admin panel for v1 | Full RTP/advantage controls are advanced features; ban/reset covers essential moderation | — Pending |
| European roulette (single zero) | Better odds, standard for fair-play contexts | — Pending |

---
*Last updated: 2026-02-27 after initialization*
