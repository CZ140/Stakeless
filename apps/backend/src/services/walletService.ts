import { db } from '../db/index.js';
import { users, gameLogs, dailyBonusClaims } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

// Constants
const BONUS_AMOUNT = 100;
const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MIN_BET = 1;

// ─── deductBet ────────────────────────────────────────────────────────────────
// Atomically deducts betAmount from the user's balance.
// Uses SELECT FOR UPDATE inside a transaction to prevent concurrent double-spend.
// Throws BET_TOO_SMALL if betAmount < MIN_BET (validated before opening the tx).
// Throws INSUFFICIENT_FUNDS if balance < betAmount.
// Returns { newBalance }.
export async function deductBet(
  userId: number,
  betAmount: number,
  _gameType: string,
): Promise<{ newBalance: number }> {
  if (betAmount < MIN_BET) {
    throw Object.assign(new Error('Bet amount too small'), { code: 'BET_TOO_SMALL' });
  }

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, balance: users.balance })
      .from(users)
      .where(eq(users.id, userId))
      .for('update'); // SELECT FOR UPDATE — row-level lock prevents concurrent double-spend

    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    if (user.balance < betAmount) {
      throw Object.assign(new Error('Insufficient funds'), { code: 'INSUFFICIENT_FUNDS' });
    }

    const newBalance = user.balance - betAmount;

    await tx
      .update(users)
      .set({
        balance: newBalance,
        totalWagered: sql`${users.totalWagered} + ${betAmount}`, // atomic SQL expression — no read-modify-write in JS
      })
      .where(eq(users.id, userId));

    return { newBalance };
  });
}

// ─── settleBet ────────────────────────────────────────────────────────────────
// Atomically credits profit and appends a game_logs row inside one transaction.
// profit = 0 on a loss (bet was already deducted by deductBet).
// profit > 0 on a win (net winnings; e.g. betAmount for a 2x payout).
// Uses SELECT FOR UPDATE to prevent concurrent race on the same user row.
// Returns { newBalance }.
export async function settleBet(
  userId: number,
  profit: number,
  betAmount: number,
  outcome: string,
  gameType: string,
): Promise<{ newBalance: number }> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, balance: users.balance })
      .from(users)
      .where(eq(users.id, userId))
      .for('update'); // row lock

    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const newBalance = user.balance + profit;

    if (profit > 0) {
      await tx
        .update(users)
        .set({
          balance: newBalance,
          totalProfit: sql`${users.totalProfit} + ${profit}`, // atomic SQL expression
        })
        .where(eq(users.id, userId));
    } else {
      await tx
        .update(users)
        .set({
          balance: newBalance,
          totalLoss: sql`${users.totalLoss} + ${betAmount}`, // atomic SQL expression
        })
        .where(eq(users.id, userId));
    }

    // Append game log inside the same transaction
    await tx.insert(gameLogs).values({
      userId,
      gameType,
      betAmount,
      outcome,
      profit,
      balanceAfter: newBalance,
    });

    return { newBalance };
  });
}

// ─── claimDailyBonus ──────────────────────────────────────────────────────────
// Atomically credits BONUS_AMOUNT (100 coins) once per 24 hours.
// Uses SELECT FOR UPDATE inside a transaction to prevent race conditions.
// Throws BONUS_NOT_READY with msUntilNext if within 24h of last claim.
// Returns { newBalance, nextClaimAt }.
export async function claimDailyBonus(
  userId: number,
): Promise<{ newBalance: number; nextClaimAt: string }> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, balance: users.balance, lastBonusClaimedAt: users.lastBonusClaimedAt })
      .from(users)
      .where(eq(users.id, userId))
      .for('update'); // row lock

    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const now = Date.now();
    if (user.lastBonusClaimedAt) {
      const readyAt = user.lastBonusClaimedAt.getTime() + BONUS_COOLDOWN_MS;
      if (readyAt > now) {
        const msUntilNext = readyAt - now;
        throw Object.assign(new Error('Bonus not ready'), { code: 'BONUS_NOT_READY', msUntilNext });
      }
    }

    const newBalance = user.balance + BONUS_AMOUNT;
    const claimedAt = new Date();

    await tx
      .update(users)
      .set({
        balance: newBalance,
        lastBonusClaimedAt: claimedAt,
      })
      .where(eq(users.id, userId));

    // Record the claim in daily_bonus_claims table
    await tx.insert(dailyBonusClaims).values({
      userId,
      amount: BONUS_AMOUNT,
    });

    return {
      newBalance,
      nextClaimAt: new Date(now + BONUS_COOLDOWN_MS).toISOString(),
    };
  });
}
