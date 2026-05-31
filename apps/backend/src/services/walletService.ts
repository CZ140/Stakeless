import { db } from '../db/index.js';
import { users, gameLogs, dailyBonusClaims } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import {
  TIERS,
  tierForWagered,
  tierLevelForWagered,
  tierByLevel,
  BONUS_COOLDOWN_MS,
  streakBonusAmount,
  nextStreak,
  rakebackAvailable,
  rakebackWagerConsumed,
} from '@gambling/shared';

// Constants
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
// Atomically credits the player's tier-scaled daily bonus once per 24 hours,
// scaled by a consecutive-day STREAK. The base amount is derived live from
// totalWagered (Bronze 100 … Obsidian 1000), so a player who ranks up mid-cooldown
// sees the bigger bonus on their next claim; the streak then multiplies it
// (day 1 = 1×, capped at MAX_STREAK_MULTIPLIER). Claiming on time (within
// STREAK_RESET_MS of the last claim) advances the streak; lapsing resets it to 1.
// Uses SELECT FOR UPDATE inside a transaction to prevent race conditions.
// Throws BONUS_NOT_READY with msUntilNext if within 24h of last claim.
// Returns { newBalance, nextClaimAt, amount, streak }.
export async function claimDailyBonus(
  userId: number,
): Promise<{ newBalance: number; nextClaimAt: string; amount: number; streak: number }> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: users.id,
        balance: users.balance,
        totalWagered: users.totalWagered,
        lastBonusClaimedAt: users.lastBonusClaimedAt,
        bonusStreak: users.bonusStreak,
      })
      .from(users)
      .where(eq(users.id, userId))
      .for('update'); // row lock

    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const now = Date.now();
    let msSinceLastClaim: number | null = null;
    if (user.lastBonusClaimedAt) {
      const last = user.lastBonusClaimedAt.getTime();
      const readyAt = last + BONUS_COOLDOWN_MS;
      if (readyAt > now) {
        const msUntilNext = readyAt - now;
        throw Object.assign(new Error('Bonus not ready'), { code: 'BONUS_NOT_READY', msUntilNext });
      }
      msSinceLastClaim = now - last;
    }

    const streak = nextStreak(user.bonusStreak, msSinceLastClaim);
    const amount = streakBonusAmount(tierForWagered(user.totalWagered).dailyBonus, streak);
    const newBalance = user.balance + amount;
    const claimedAt = new Date();

    await tx
      .update(users)
      .set({
        balance: newBalance,
        lastBonusClaimedAt: claimedAt,
        bonusStreak: streak,
      })
      .where(eq(users.id, userId));

    // Record the claim in daily_bonus_claims table
    await tx.insert(dailyBonusClaims).values({
      userId,
      amount,
    });

    return {
      newBalance,
      nextClaimAt: new Date(now + BONUS_COOLDOWN_MS).toISOString(),
      amount,
      streak,
    };
  });
}

// ─── claimRakeback ────────────────────────────────────────────────────────────
// Atomically credits a flat fraction (RAKEBACK_RATE) of the wager accrued since
// the player's last rakeback claim. The watermark (rakeback_claimed_wagered) is
// advanced by exactly the wager the payout covers, so a coin of wager is only ever
// rebated once and the sub-coin remainder carries forward. Uses SELECT FOR UPDATE
// to serialize concurrent claims (no double-pay). Available any time — no cooldown.
// Throws NO_RAKEBACK when less than a whole coin has accrued.
// Returns { newBalance, amount }.
export async function claimRakeback(
  userId: number,
): Promise<{ newBalance: number; amount: number }> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: users.id,
        balance: users.balance,
        totalWagered: users.totalWagered,
        rakebackClaimedWagered: users.rakebackClaimedWagered,
      })
      .from(users)
      .where(eq(users.id, userId))
      .for('update'); // row lock

    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const amount = rakebackAvailable(user.totalWagered, user.rakebackClaimedWagered);
    if (amount < 1) {
      throw Object.assign(new Error('No rakeback available'), { code: 'NO_RAKEBACK' });
    }

    const newBalance = user.balance + amount;
    // Advance the watermark by only the wager this payout covers (not the full
    // totalWagered), so the floored-off remainder rolls into the next claim.
    const newWatermark = user.rakebackClaimedWagered + rakebackWagerConsumed(amount);

    await tx
      .update(users)
      .set({
        balance: newBalance,
        rakebackClaimedWagered: newWatermark,
      })
      .where(eq(users.id, userId));

    return { newBalance, amount };
  });
}

// ─── reconcileTier ──────────────────────────────────────────────────────────
// Brings users.tier_level in line with the tier their lifetime totalWagered now
// earns, and grants the one-time reward for every tier newly crossed (summed, in
// case a single big round vaults more than one threshold). Called once per round
// after settleBet — totalWagered was already bumped by deductBet, so this reads
// the final post-round figure. Idempotent and monotonic: tier_level only rises,
// and the FOR UPDATE row lock serializes concurrent rounds so a reward can never
// be paid twice. Returns the tier-up details when a level was crossed, else null.
export interface TierUpResult {
  fromLevel: number;
  toLevel: number;
  name: string;
  reward: number;
  dailyBonus: number;
  newBalance: number;
}

export async function reconcileTier(userId: number): Promise<TierUpResult | null> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ balance: users.balance, totalWagered: users.totalWagered, tierLevel: users.tierLevel })
      .from(users)
      .where(eq(users.id, userId))
      .for('update'); // row lock — prevents a concurrent round double-granting

    if (!user) return null;

    const newLevel = tierLevelForWagered(user.totalWagered);
    if (newLevel <= user.tierLevel) return null; // no advancement

    // Sum the one-time rewards for every tier crossed since the stored level.
    const reward = TIERS.slice(user.tierLevel + 1, newLevel + 1).reduce(
      (sum, t) => sum + t.reward,
      0,
    );
    const newBalance = user.balance + reward;

    await tx
      .update(users)
      .set({ tierLevel: newLevel, balance: newBalance })
      .where(eq(users.id, userId));

    const reached = tierByLevel(newLevel);
    return {
      fromLevel: user.tierLevel,
      toLevel: newLevel,
      name: reached.name,
      reward,
      dailyBonus: reached.dailyBonus,
      newBalance,
    };
  });
}
