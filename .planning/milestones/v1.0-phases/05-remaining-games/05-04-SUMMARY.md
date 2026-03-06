---
phase: 05-remaining-games
plan: "04"
subsystem: backend
tags: [blackjack, game-engine, tdd, session-management]
dependency_graph:
  requires:
    - walletService (deductBet, settleBet)
    - gameSessions table (DB session storage)
    - requireAuth middleware
  provides:
    - blackjackService.ts (createDeck, calculateHandValue, isBlackjack, dealerPlay, getOutcome, computeProfit)
    - POST /api/games/blackjack/deal
    - POST /api/games/blackjack/hit
    - POST /api/games/blackjack/stand
    - POST /api/games/blackjack/double
    - GET /api/games/blackjack/active-session
  affects:
    - apps/backend/src/routes/games.ts (routes appended)
tech_stack:
  added: []
  patterns:
    - TDD (red-green with vitest)
    - Fisher-Yates shuffle with crypto.randomInt
    - Server-side session state (gameSessions table)
    - Dealer AI (stands hard 17, hits soft 17)
    - Basic strategy auto-complete for disconnect recovery
key_files:
  created:
    - apps/backend/src/services/blackjackService.ts
    - apps/backend/src/services/blackjackService.test.ts
  modified:
    - apps/backend/src/routes/games.ts
decisions:
  - "Dealer hole card never sent to client during player_turn — only dealerUpCard returned on deal"
  - "Natural blackjack profit = betAmount + floor(betAmount * 0.5) for 3:2 payout following roulette profit semantics"
  - "dealerPlay returns new state (immutable) — does not mutate input to avoid bugs in auto-complete flow"
  - "Disconnect auto-complete uses basic strategy: hit hard <=16, stand hard 17+, hit soft <=17"
  - "Double down deducts additional betAmount via deductBet before dealing one card"
  - "Both-blackjack scenario resolves as push (not player_blackjack) — dealer natural negates player advantage"
metrics:
  duration: "5 min"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_changed: 3
---

# Phase 5 Plan 4: Blackjack Backend Summary

**One-liner:** Complete Blackjack backend with 52-card deck engine, dealer AI standing on hard 17 (hitting soft 17), 4 session routes (deal/hit/stand/double), 3:2 natural payout, and basic-strategy disconnect recovery.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Blackjack service (TDD — RED) | f2ea54b | blackjackService.test.ts |
| 1 | Blackjack service (TDD — GREEN) | 71d422f | blackjackService.ts |
| 2 | Blackjack backend routes | b6c4165* | games.ts |

*Note: games.ts was committed as part of plan 05-01 which included the full updated routes file. The blackjack routes are fully present and TypeScript-verified.

## What Was Built

### blackjackService.ts

Pure service module with no I/O dependencies:

- **`createDeck()`** — Generates a standard 52-card deck (4 suits × 13 ranks), shuffled using Fisher-Yates algorithm with `crypto.randomInt` (GINF-02 compliant, no Math.random)
- **`calculateHandValue(hand)`** — Returns `{ value, isSoft }`. Aces start as 11, reduced to 1 to prevent bust. `isSoft=true` when any ace still counts as 11
- **`isBlackjack(hand)`** — True only for exactly 2-card hands summing to 21 (natural)
- **`dealerPlay(state)`** — Dealer draws until value >= 17 AND NOT soft 17. Stands on hard 17+, stands on soft 18+, hits on soft 17 (A+6). Returns new state (immutable)
- **`getOutcome(playerHand, dealerHand)`** — Returns one of 6 outcomes with priority: player_blackjack → player_bust → dealer_bust → compare values → push
- **`computeProfit(outcome, betAmount)`** — Calculates settleBet profit following roulette semantics (deductBet already removed stake):
  - `player_blackjack`: `betAmount + floor(betAmount * 0.5)` → 3:2 payout
  - `player_win`, `dealer_bust`, `push`: `betAmount` → 1:1 / stake return
  - `player_bust`, `dealer_win`: `0` → loss

### Blackjack Routes (games.ts)

**POST /api/games/blackjack/deal**
- Deducts bet, creates fresh 52-card deck per hand
- Deals: playerHand = [deck[0], deck[2]], dealerHand = [deck[1], deck[3]] (alternating)
- Natural blackjack check: if player has 21 on deal, immediately settles (push if dealer also has blackjack, else 3:2)
- Normal play: stores session, returns `{ sessionId, playerHand, dealerUpCard, playerValue }`
- Dealer hole card (index 1) is NEVER sent during player turn

**POST /api/games/blackjack/hit**
- Draws one card from deck, appends to playerHand
- If bust (>21): settles immediately as `player_bust`, profit=0
- If safe: updates session state, returns `{ card, playerHand, playerValue, busted: false }`

**POST /api/games/blackjack/stand**
- Triggers dealer AI: dealer draws until 17+ (hits soft 17)
- Determines outcome via `getOutcome`, settles with effective bet (doubled if isDoubled)
- Returns `{ dealerHand, dealerValue, outcome, newBalance }`

**POST /api/games/blackjack/double**
- Deducts additional bet (doubles the stake)
- Deals exactly one card to player
- If bust: settles immediately at doubled bet
- If safe: dealer plays, outcome determined, settles at doubled bet
- Returns `{ card, playerHand, dealerHand, outcome, newBalance }`

**GET /api/games/blackjack/active-session**
- Finds incomplete blackjack session for user
- **Disconnect auto-complete**: If session is in `player_turn`, applies basic strategy:
  - Hit on hard <= 16 or soft <= 17
  - Stand on hard 17+
  - Settles auto-completed hand silently, returns resolved result with `autoCompleted: true`
- Normal return: `{ sessionId, playerHand, dealerUpCard, playerValue, phase, betAmount }`

## Test Coverage

45 tests in blackjackService.test.ts:
- **createDeck**: 5 tests (count, uniqueness, suits, ranks, shuffle randomness)
- **calculateHandValue**: 9 tests (5+ hand combinations including soft/hard aces)
- **isBlackjack**: 8 tests (all face cards, order independence, non-naturals)
- **dealerPlay**: 7 tests (hard 17 stand, soft 17 hit, soft 18 stand, bust, no-mutation)
- **getOutcome**: 8 tests (all 6 outcome types + double blackjack push)
- **computeProfit**: 8 tests (3:2 blackjack, 1:1, push, loss, odd amounts)

All 96 backend tests pass. TypeScript compiles with 0 errors.

## Deviations from Plan

None — plan executed exactly as written. The games.ts blackjack routes were committed as part of the plan 05-01 wave execution (prior plan executor included the full routes file), but all blackjack functionality is present, correct, and TypeScript-verified.

## Self-Check: PASSED

- FOUND: apps/backend/src/services/blackjackService.ts
- FOUND: apps/backend/src/services/blackjackService.test.ts
- FOUND: .planning/phases/05-remaining-games/05-04-SUMMARY.md
- FOUND: f2ea54b (test(05-04): add failing tests for blackjackService)
- FOUND: 71d422f (feat(05-04): implement blackjackService)
- TypeScript: 0 errors
- Tests: 96/96 passing (45 blackjack-specific)
