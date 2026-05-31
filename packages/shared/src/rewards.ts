// ─── Economy: faucet streaks & rakeback (single source of truth) ───────────────
// Two ways a player tops up between/around wagering, shared by the backend
// (crediting + persistence) and the frontend (previews + countdowns) so the
// numbers shown always match the numbers credited.
//
//   1. Daily-bonus STREAK — the existing 24h tier-scaled faucet, now multiplied
//      by a consecutive-day streak so showing up daily compounds the reward.
//   2. RAKEBACK — claim back a flat fraction of everything you've *wagered* since
//      your last claim, any time. Rewards playing the games (97% RTP bleeds ~3%;
//      rakeback hands a slice of that back) and is self-limiting: you can't farm
//      it without betting, and each coin of wager is only ever rebated once.

// ─── Daily-bonus streak ─────────────────────────────────────────────────────────

/** Cooldown before the daily bonus can be claimed again. */
export const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// A streak survives as long as you claim within this window of your last claim.
// It's the 24h cooldown plus a 24h grace day, so missing a single day's claim
// (claiming up to 48h later) keeps the streak; beyond that it resets to day 1.
export const STREAK_RESET_MS = 48 * 60 * 60 * 1000;

/** The streak multiplier is capped here so the faucet can't grow without bound. */
export const MAX_STREAK_MULTIPLIER = 7;

// Multiplier applied to the tier daily bonus for a given streak length (in days).
// Day 1 = 1×, day 2 = 2× … capped at MAX_STREAK_MULTIPLIER. A null/0 streak (a
// brand-new claimer) is treated as day 1.
export function streakMultiplier(streak: number): number {
  return Math.min(Math.max(streak, 1), MAX_STREAK_MULTIPLIER);
}

// The actual coins credited for a claim: the tier's base daily bonus scaled by
// the streak multiplier. Kept integer (bonuses are whole coins).
export function streakBonusAmount(baseDailyBonus: number, streak: number): number {
  return baseDailyBonus * streakMultiplier(streak);
}

// Given the previous streak and the gap since the last claim, the streak this
// claim earns: continue (+1) if claimed within the reset window, else restart at 1.
// `msSinceLastClaim` is null for a player who has never claimed.
export function nextStreak(prevStreak: number, msSinceLastClaim: number | null): number {
  if (msSinceLastClaim === null || msSinceLastClaim > STREAK_RESET_MS) return 1;
  return prevStreak + 1;
}

// ─── Rakeback ─────────────────────────────────────────────────────────────────

/** Fraction of lifetime wager returned as claimable rakeback (1%). */
export const RAKEBACK_RATE = 0.01;

// Coins currently claimable: the rate applied to wager accrued since the last
// claim (totalWagered minus the already-rebated watermark), floored to a whole
// coin. Never negative.
export function rakebackAvailable(totalWagered: number, claimedWagered: number): number {
  const eligibleWager = Math.max(0, totalWagered - claimedWagered);
  return Math.floor(eligibleWager * RAKEBACK_RATE);
}

// The amount of wager a given rakeback payout "consumes" — used to advance the
// claimed-wager watermark by exactly what was paid for, so the sub-coin remainder
// carries forward to the next claim instead of being silently dropped.
export function rakebackWagerConsumed(amount: number): number {
  return Math.round(amount / RAKEBACK_RATE);
}
