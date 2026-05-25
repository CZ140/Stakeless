// Hi-Lo — a card-based cash-out ladder. A card is shown; the player guesses
// whether the next card is HIGHER or LOWER. A correct guess compounds the
// multiplier and the drawn card becomes the new base; the player cashes out any
// time. One wrong guess loses the whole stake. Shared by the backend
// (settlement) and frontend (live odds). The crypto RNG (drawCard) lives
// backend-only in services/hiloService.ts.
//
// Model: a 52-card deck, ranks 2..14 (J=11, Q=12, K=13, A=14), four suits each.
// Draws are independent and uniform over the 52 cards (an i.i.d. / continuously
// shuffled-shoe model) so the odds are a clean closed form with no deck-depletion
// edge cases over an endless ladder.
//
// Comparisons are STRICT and ties LOSE:
//   • HIGHER wins iff nextRank >  currentRank
//   • LOWER  wins iff nextRank <  currentRank
// Ties (equal rank) bust the ladder. Strictness keeps every playable step's win
// chance < 1, so every multiplier is > 1 (no sub-1× "guaranteed" steps). Because
// the step multiplier is RTP / winChance, each step's expected return is exactly
// the RTP (0.97), and so is the whole ladder (RTP^streak), matching the rest of
// the platform's 97%. At an Ace, HIGHER is impossible; at a 2, LOWER is.

export type HiloDirection = 'hi' | 'lo';
export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export interface HiloCard {
  rank: number; // 2..14
  suit: CardSuit;
}

export const HILO = {
  RTP: 0.97, // 97% return-to-player (3% house edge)
  RANK_MIN: 2,
  RANK_MAX: 14,
  RANKS: 13,
  SUITS: 4,
  DECK_SIZE: 52,
  // Sanity cap on the compounding multiplier (prevents runaway/overflow on an
  // astronomically improbable streak). Far beyond any realistic cash-out.
  MAX_MULTIPLIER: 1_000_000,
} as const;

// Cards in the deck strictly higher / lower than a rank.
export function cardsHigher(rank: number): number {
  return (HILO.RANK_MAX - rank) * HILO.SUITS; // ranks rank+1 .. 14
}
export function cardsLower(rank: number): number {
  return (rank - HILO.RANK_MIN) * HILO.SUITS; // ranks 2 .. rank-1
}

// Fraction (0..1) of next-card outcomes that win for a direction at this rank.
export function hiloWinChance(rank: number, dir: HiloDirection): number {
  const wins = dir === 'hi' ? cardsHigher(rank) : cardsLower(rank);
  return wins / HILO.DECK_SIZE;
}

// Whether a direction is playable at all (a strict win is possible).
export function hiloDirectionAvailable(rank: number, dir: HiloDirection): boolean {
  return hiloWinChance(rank, dir) > 0;
}

// Per-step payout multiplier (house edge applied). 0 when the direction is
// impossible (Ace→higher, 2→lower). Kept full-precision; round only for display.
export function hiloStepMultiplier(rank: number, dir: HiloDirection): number {
  const p = hiloWinChance(rank, dir);
  if (p <= 0) return 0;
  return HILO.RTP / p;
}

// Resolve a guess: did `nextRank` beat `currentRank` in the chosen direction?
// Strict — equal ranks lose.
export function hiloGuessWins(currentRank: number, nextRank: number, dir: HiloDirection): boolean {
  return dir === 'hi' ? nextRank > currentRank : nextRank < currentRank;
}

// Compound a correct step onto the running multiplier, clamped to the cap.
export function hiloCompound(multiplier: number, rank: number, dir: HiloDirection): number {
  return Math.min(HILO.MAX_MULTIPLIER, multiplier * hiloStepMultiplier(rank, dir));
}
