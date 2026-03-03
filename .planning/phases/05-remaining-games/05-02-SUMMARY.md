---
phase: 05-remaining-games
plan: 02
subsystem: backend
tags: [mines, backend, session-state, game-engine, tdd]
dependency_graph:
  requires: [walletService.deductBet, walletService.settleBet, gameSessions schema, requireAuth middleware]
  provides: [minesService.generateMineGrid, minesService.calculateMinesMultiplier, /api/games/mines/* routes]
  affects: [apps/backend/src/routes/games.ts, apps/backend/src/services/minesService.ts]
tech_stack:
  added: []
  patterns: [Fisher-Yates shuffle via crypto.randomInt, hypergeometric compound multiplier formula, session-state pattern (game_sessions table), TDD red-green cycle]
key_files:
  created:
    - apps/backend/src/services/minesService.ts
    - apps/backend/src/services/minesService.test.ts
  modified:
    - apps/backend/src/routes/games.ts
decisions:
  - "calculateMinesMultiplier uses hypergeometric compound formula: product((25-i)/(totalSafe-i)) for i=0..n-1 then multiply by 0.97 house factor — grows monotonically, higher mine count gives higher multiplier per reveal"
  - "cashout profit passed to settleBet equals payout (betAmount * multiplier) — deductBet already removed stake, settleBet adds gross payout back"
  - "explode path calls settleBet with profit=0 — bet fully lost, stake already removed by deductBet"
  - "GET /mines/active-session returns revealed tile indices and mineCount but never grid boolean array — enforces MINE-01 client-side opacity constraint"
metrics:
  duration: "3 min"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 05 Plan 02: Mines Backend Summary

**One-liner:** Session-based Mines backend with crypto Fisher-Yates grid generation, hypergeometric multiplier formula, and four REST endpoints enforcing server-side mine opacity.

## What Was Built

Complete Mines game backend consisting of two files:

**minesService.ts** — Pure service with no I/O dependencies:
- `generateMineGrid(mineCount)`: generates a 25-element boolean array using Fisher-Yates shuffle seeded by `crypto.randomInt` (GINF-02 compliance). Mines are placed at indices 0..mineCount-1 then shuffled.
- `calculateMinesMultiplier(mineCount, tilesRevealed)`: hypergeometric compound formula with 0.97 house edge. Returns 1.0 before any reveal; grows monotonically; higher risk = higher multiplier per reveal.
- `MinesSessionState` interface: shared contract between service and routes.

**games.ts additions** — Four Mines routes appended (existing roulette + plinko routes preserved):
- `POST /mines/start`: deducts bet, generates hidden grid, inserts `game_sessions` row, returns only `sessionId`.
- `POST /mines/tile`: loads session, validates row/col, reveals tile — returns `{ hit: true, mineGrid }` on explosion (settleBet profit=0) or `{ hit: false, gem: true, currentMultiplier, tilesRevealed }` on safe tile.
- `POST /mines/cashout`: validates at least one reveal, computes `payout = floor(betAmount * multiplier)`, calls `settleBet(userId, payout, ...)`, returns `{ payout, newBalance, mineGrid }`.
- `GET /mines/active-session`: returns board state with `revealed` indices and `mineCount` only — mine grid boolean array never exposed mid-round (MINE-01).

## Test Results

All 16 minesService unit tests pass:
- `generateMineGrid`: length=25, exact mine count across mineCount=1/5/24, all boolean elements, randomness across 10 calls
- `calculateMinesMultiplier`: 1.0 before reveals, >1.0 after first reveal, monotonic growth for mineCount=1 and mineCount=5, high-risk > low-risk multiplier, high value after 24 reveals with 1 mine, 2dp rounding

## Decisions Made

- **Multiplier formula**: hypergeometric compound `product((25-i)/(totalSafe-i)) * 0.97` — mathematically correct for the Mines tile selection model, matches Stake.com provably-fair approach.
- **cashout profit = payout (gross)**: `deductBet` already removed the stake; `settleBet` receives the full payout amount to add back, consistent with the Plinko pattern used in this codebase.
- **profit=0 on explode**: `settleBet(userId, 0, betAmount, 'exploded', 'mines')` — logs the loss in game_logs without crediting anything back.
- **active-session hides grid**: Only `revealed` (safe tile indices) and `mineCount` returned — no `grid` boolean array — enforcing anti-cheat opacity (MINE-01).

## Deviations from Plan

### Pre-existing Issues (out of scope, deferred)

**plinkoService.ts missing (pre-existing)**: `plinkoService.test.ts` fails with module-not-found and has 2 TS errors (`'buckets' is possibly 'undefined'`). These are from the Plinko plan (05-01) executing in parallel. Noted in deferred-items but not fixed — outside 05-02 scope.

### Auto-fixed Issues

None — plan executed as written.

### Parallel Agent Observation

During execution, a parallel agent (05-01 Plinko and 05-03 Blackjack) also modified `games.ts`, adding `resolvePlinko`/`plinkoService.js` imports, Plinko routes, and `blackjackService.js` imports. These additions are complementary and were preserved. The Mines routes were appended after the Plinko block as written.

## Self-Check: PASSED

- FOUND: apps/backend/src/services/minesService.ts
- FOUND: apps/backend/src/services/minesService.test.ts
- FOUND: .planning/phases/05-remaining-games/05-02-SUMMARY.md
- FOUND commit: 557ac51 (Task 1 — minesService TDD)
- FOUND commit: 4b5fb28 (Task 2 — Mines routes)
- 8 `/mines/` route references in games.ts (all 4 routes present)
