---
phase: 04-game-infrastructure-roulette
plan: 01
subsystem: backend
tags: [typescript, express, roulette, tdd, vitest, zod, crypto]

# Dependency graph
requires:
  - phase: 03-wallet-currency
    provides: deductBet + settleBet in walletService.ts used by games route
  - phase: 02-auth-accounts
    provides: requireAuth middleware guarding POST /roulette/bet
provides:
  - rouletteService.ts pure resolver with resolveRouletteBets + BetZone + PlacedBet
  - gamesRouter with POST /api/games/roulette/bet endpoint
  - /api/games registered in app.ts
affects: [04-03-roulette-ui, 05-plinko, 05-mines, 05-blackjack]

# Tech tracking
tech-stack:
  added:
    - vitest (unit test runner for backend pure functions)
  patterns:
    - Pure resolver function pattern (resolveRouletteBets) — stateless, zero I/O, easily testable
    - TDD RED→GREEN cycle for pure business logic
    - validate → deductBet → crypto.randomInt → resolve → settleBet → log pipeline
    - IRouter typing on all Express routers (prevents TS2742 portability errors)

key-files:
  created:
    - apps/backend/src/services/rouletteService.ts
    - apps/backend/src/services/rouletteService.test.ts
    - apps/backend/src/routes/games.ts
    - apps/backend/vitest.config.ts
  modified:
    - apps/backend/src/app.ts
    - apps/backend/package.json

key-decisions:
  - "vitest installed as backend test runner — walletService.test.ts excluded (documentation stubs only, no runnable suites)"
  - "resolveRouletteBets returns pure profit (not totalBet + profit) — deductBet already removes the stake"
  - "col_3 branch uses pocket % 3 === 0 safely — zero pocket guard handles the zero case before switch"
  - "Outcome stored as pocket number string only (e.g. '17') per game_logs.outcome varchar 50 limit"
  - "crypto.randomInt(0, 37) selects index into WHEEL_SEQUENCE — maps random index to actual pocket number"

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 04 Plan 01: Roulette Backend Pipeline Summary

**Pure roulette resolver service with TDD (19 cases), gamesRouter with POST /api/games/roulette/bet, and vitest setup for backend unit tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T03:01:19Z
- **Completed:** 2026-03-03T03:04:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- rouletteService.ts: pure resolveRouletteBets function covering all bet zones (red/black, odd/even, dozens, columns, straight-up 0-36) with correct payouts (35:1, 2:1, 1:1)
- Zero pocket guard: only number_0 wins on pocket 0 — all outside bets correctly return 0
- col_3 column modulo logic: pocket % 3 === 0, safe because zero is handled above the switch
- 19 TDD behavior cases: written RED (test file only, no implementation), then GREEN (all pass after rouletteService.ts created)
- vitest installed, vitest.config.ts created, test/test:watch scripts added to package.json
- games.ts gamesRouter with Zod schema validating zone names via regex and amounts (int, min 1)
- Full pipeline: validate → deductBet(totalBet) → crypto.randomInt(0,37) → WHEEL_SEQUENCE lookup → resolveRouletteBets → settleBet → respond
- INSUFFICIENT_FUNDS → 402, BET_TOO_SMALL → 400, invalid zone → 400
- app.ts updated: gamesRouter imported and registered at /api/games after walletRouter
- TypeScript compiles clean with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create rouletteService.ts (TDD)** - `d733b3f` (feat)
2. **Task 2: Create gamesRouter and register in app.ts** - `b932cdf` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `apps/backend/src/services/rouletteService.ts` - Pure resolver: resolveRouletteBets, BetZone type, PlacedBet interface, isBetWon, getMultiplier
- `apps/backend/src/services/rouletteService.test.ts` - 19 vitest cases covering all bet zone behaviors and edge cases
- `apps/backend/src/routes/games.ts` - gamesRouter with POST /roulette/bet; Zod validation; deductBet/settleBet pipeline
- `apps/backend/vitest.config.ts` - Vitest config; excludes walletService.test.ts (documentation stubs)
- `apps/backend/package.json` - Added vitest dev dependency + test/test:watch scripts
- `apps/backend/src/app.ts` - Import gamesRouter + app.use('/api/games', gamesRouter)

## Decisions Made

- vitest installed as backend test runner; walletService.test.ts excluded from vitest runs (it's documentation-only comment stubs with no runnable test suites)
- resolveRouletteBets returns pure profit only — the deductBet call has already removed the stake, so profit represents net winnings added back
- col_3 branch uses `pocket % 3 === 0` safely because the `if (pocket === 0)` guard handles zero before the switch statement
- Outcome logged as pocket number string only (e.g. "17") to stay within game_logs.outcome varchar 50 limit
- crypto.randomInt(0, 37) produces index into WHEEL_SEQUENCE array (37 pockets total: 0-36) mapping to actual European wheel pocket number

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest test infrastructure setup needed**
- **Found during:** Task 1 (TDD setup)
- **Issue:** Neither vitest nor jest were installed in the backend; walletService.test.ts had no runnable suites and caused vitest to report "no test suite found"
- **Fix:** Installed vitest; created vitest.config.ts; added test script to package.json; excluded walletService.test.ts (documentation stubs) from vitest include pattern
- **Files modified:** apps/backend/package.json, apps/backend/vitest.config.ts
- **Commit:** d733b3f (included in Task 1 commit)

## Self-Check: PASSED

- FOUND: apps/backend/src/services/rouletteService.ts
- FOUND: apps/backend/src/services/rouletteService.test.ts
- FOUND: apps/backend/src/routes/games.ts
- FOUND: apps/backend/vitest.config.ts
- FOUND commit: d733b3f (Task 1 - rouletteService.ts with TDD)
- FOUND commit: b932cdf (Task 2 - gamesRouter + app.ts)
- TypeScript compiles clean: zero errors
- Tests: 19/19 passing
