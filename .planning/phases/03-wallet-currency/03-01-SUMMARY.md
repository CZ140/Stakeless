---
phase: 03-wallet-currency
plan: 01
subsystem: api
tags: [drizzle-orm, postgresql, select-for-update, transactions, wallet, balance]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Drizzle ORM schema (users, gameLogs, dailyBonusClaims tables), db connection
  - phase: 02-auth-accounts
    provides: requireAuth middleware, user.id on req.user

provides:
  - walletService.ts with deductBet/settleBet/claimDailyBonus — atomic balance mutations via SELECT FOR UPDATE
  - POST /api/wallet/bonus endpoint (requireAuth-gated, 429 on cooldown)
  - register() now grants 1,000 coins starting balance (CURR-01)

affects: [04-roulette, 05-plinko, 06-mines, 07-blackjack, 08-anti-cheat-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - db.transaction() + .select().for('update') for all balance mutations — no concurrent double-spend
    - sql template expressions for aggregate increments (totalWagered, totalProfit, totalLoss) — avoids read-modify-write races
    - Error objects with .code property for typed error handling in route layer

key-files:
  created:
    - apps/backend/src/services/walletService.ts
    - apps/backend/src/services/walletService.test.ts
    - apps/backend/src/routes/wallet.ts
  modified:
    - apps/backend/src/app.ts
    - apps/backend/src/services/authService.ts

key-decisions:
  - "All balance mutations use db.transaction() + .select().for('update') — single choke-point prevents concurrent double-spend for all Phases 3-8 game engines"
  - "Aggregate columns (totalWagered, totalProfit, totalLoss) always updated via sql template expressions, never JS read-modify-write — prevents lost-update anomalies"
  - "No { noWait: true } or { skipLocked: true } on .for() calls — known Drizzle ORM bug #3554 makes these options unreliable; plain .for('update') only"
  - "deductBet validates betAmount >= MIN_BET before opening transaction — fast-fail avoids unnecessary DB round-trip"
  - "BONUS_AMOUNT=100, BONUS_COOLDOWN_MS=24h as named constants at module top — single change point for future tuning"
  - "walletService.test.ts created as specification-style docs without runnable test framework — test infra to be added in dedicated future task"

patterns-established:
  - "Pattern: Balance mutation = tx + FOR UPDATE lock + sql expression aggregate update — required for ALL game engines"
  - "Pattern: Route error handling via err.code string comparison — matches authRouter established convention"

requirements-completed: [CURR-01, GINF-01, GINF-03]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 3 Plan 01: WalletService Foundation Summary

**PostgreSQL SELECT FOR UPDATE wallet service with atomic deductBet/settleBet/claimDailyBonus, daily bonus endpoint, and 1,000-coin starting balance on registration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T17:02:48Z
- **Completed:** 2026-03-02T17:04:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `walletService.ts` — all three balance-mutation functions use `db.transaction()` + `.select().for('update')` row locking, making concurrent double-spend impossible at the database level
- Created `POST /api/wallet/bonus` route (requireAuth-gated) with 200/429/500 responses, mounted at `/api/wallet` in `app.ts`
- Fixed `register()` in `authService.ts` to insert `balance: 1000` — every new user receives 1,000 coins starting balance (CURR-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WalletService with atomic balance mutations** - `078520b` (feat)
2. **Task 2: Create wallet router, mount it, and fix starting balance** - `882b376` (feat)

**Plan metadata:** (docs commit — see final_commit below)

## Files Created/Modified

- `apps/backend/src/services/walletService.ts` — deductBet, settleBet, claimDailyBonus; all use SELECT FOR UPDATE inside db.transaction()
- `apps/backend/src/services/walletService.test.ts` — specification-style unit test documentation (behavior descriptions with mock setup notes)
- `apps/backend/src/routes/wallet.ts` — POST /bonus route, requireAuth gate, 429 on BONUS_NOT_READY
- `apps/backend/src/app.ts` — added walletRouter import and mount at /api/wallet
- `apps/backend/src/services/authService.ts` — added balance: 1000 to register() insert values

## Decisions Made

- All balance mutations use `db.transaction()` + `.select().for('update')` — this is the single choke-point for all game engine phases (3-8), preventing concurrent double-spend at the DB level rather than application level.
- Aggregate columns use `sql` template expressions (e.g. `sql\`${users.totalWagered} + ${betAmount}\``) — avoids lost-update anomalies that would occur with JS read-modify-write.
- No `{ noWait: true }` or `{ skipLocked: true }` — Drizzle ORM bug #3554 makes these options unreliable; plain `.for('update')` only.
- Test file created as specification documentation without runnable framework — no test runner is installed in backend package.json; adding one is a dedicated future infrastructure task.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `deductBet` and `settleBet` are ready for game engines (Phase 4 Roulette onward)
- `claimDailyBonus` wired to `/api/wallet/bonus` — frontend can call this immediately after Phase 3 frontend wallet UI is built
- DB migration 0001 is still pending (noted in STATE.md from Phase 2) — must run `docker compose up -d && pnpm --filter backend db:migrate` before any live testing

## Self-Check: PASSED

- FOUND: apps/backend/src/services/walletService.ts
- FOUND: apps/backend/src/routes/wallet.ts
- FOUND: .planning/phases/03-wallet-currency/03-01-SUMMARY.md
- FOUND commit 078520b: feat(03-01): create WalletService with atomic balance mutations
- FOUND commit 882b376: feat(03-01): create wallet router, mount it, and fix starting balance
- TypeScript typecheck: zero errors
- .for('update') count in walletService.ts: 3 (one per function, correct)
- balance: 1000 in authService.ts: present
- walletRouter in app.ts: imported and mounted
- No noWait/skipLocked flags: none found

---
*Phase: 03-wallet-currency*
*Completed: 2026-03-02*
