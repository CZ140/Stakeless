/**
 * Unit tests for walletService.ts
 *
 * These tests document expected behavior and serve as a specification.
 * No test runner is configured yet — these will be wired to vitest/jest in a
 * future phase when a test infrastructure task is added.
 *
 * Each section corresponds to one exported function.
 */

// ─── Test: deductBet ──────────────────────────────────────────────────────────

/**
 * SHOULD throw BET_TOO_SMALL when betAmount < 1
 *
 * Setup:  betAmount = 0
 * Expect: Error with code 'BET_TOO_SMALL' (thrown before opening DB transaction)
 */

/**
 * SHOULD throw INSUFFICIENT_FUNDS when balance < betAmount
 *
 * Setup:  user.balance = 50, betAmount = 100
 * Expect: Error with code 'INSUFFICIENT_FUNDS'
 *
 * Mock:
 *   tx.select().from(users).where().for('update') resolves to [{ id: 1, balance: 50 }]
 */

/**
 * SHOULD deduct betAmount from balance and increment totalWagered atomically
 *
 * Setup:  user.balance = 500, betAmount = 100
 * Expect: { newBalance: 400 }
 *         tx.update(users).set({ balance: 400, totalWagered: sql`${users.totalWagered} + 100` })
 *
 * Mock:
 *   tx.select()... resolves to [{ id: 1, balance: 500 }]
 */

// ─── Test: settleBet ──────────────────────────────────────────────────────────

/**
 * SHOULD increment totalLoss by betAmount when profit === 0
 *
 * Setup:  user.balance = 400, profit = 0, betAmount = 100, outcome = 'loss'
 * Expect: tx.update called with { totalLoss: sql`${users.totalLoss} + 100` }
 *         gameLogs insert called with { profit: 0, outcome: 'loss', balanceAfter: 400 }
 *
 * Mock:
 *   tx.select()... resolves to [{ id: 1, balance: 400 }]
 */

/**
 * SHOULD increment totalProfit by profit when profit > 0
 *
 * Setup:  user.balance = 400, profit = 200, betAmount = 100, outcome = 'win'
 * Expect: newBalance = 600
 *         tx.update called with { totalProfit: sql`${users.totalProfit} + 200` }
 *         gameLogs insert called with { profit: 200, outcome: 'win', balanceAfter: 600 }
 *
 * Mock:
 *   tx.select()... resolves to [{ id: 1, balance: 400 }]
 */

// ─── Test: claimDailyBonus ────────────────────────────────────────────────────

/**
 * SHOULD throw BONUS_NOT_READY with msUntilNext when lastBonusClaimedAt within 24h
 *
 * Setup:  user.lastBonusClaimedAt = new Date(Date.now() - 12 * 60 * 60 * 1000) (12h ago)
 * Expect: Error with code 'BONUS_NOT_READY'
 *         err.msUntilNext ≈ 12 * 60 * 60 * 1000 (±1s tolerance)
 *
 * Mock:
 *   tx.select()... resolves to [{ id: 1, balance: 1000, lastBonusClaimedAt: <12h ago> }]
 */

/**
 * SHOULD credit BONUS_AMOUNT (100) when lastBonusClaimedAt is null
 *
 * Setup:  user.lastBonusClaimedAt = null, user.balance = 1000
 * Expect: { newBalance: 1100, nextClaimAt: <ISO string ~24h from now> }
 *         tx.update called with { balance: 1100, lastBonusClaimedAt: <Date> }
 *         dailyBonusClaims insert called with { userId: 1, amount: 100 }
 *
 * Mock:
 *   tx.select()... resolves to [{ id: 1, balance: 1000, lastBonusClaimedAt: null }]
 */

/**
 * SHOULD credit BONUS_AMOUNT (100) when lastBonusClaimedAt is exactly 24h+ ago
 *
 * Setup:  user.lastBonusClaimedAt = new Date(Date.now() - 25 * 60 * 60 * 1000) (25h ago)
 * Expect: { newBalance: user.balance + 100 }
 *
 * Mock:
 *   tx.select()... resolves to [{ id: 1, balance: 900, lastBonusClaimedAt: <25h ago> }]
 */

export {};
