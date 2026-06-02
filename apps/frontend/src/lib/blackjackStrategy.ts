// Basic-strategy decision for the auto-bet blackjack player. Tuned for the backend
// ruleset: dealer hits soft 17 (H17), split on same rank, double on any two cards.
// This is an entertainment auto-player (textbook basic strategy), not card counting.
import type { Card, Rank } from '../stores/blackjackStore';

export type BJAction = 'hit' | 'stand' | 'double' | 'split';

export function cardValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
  return parseInt(rank, 10);
}

/** Best total for a hand + whether an ace is still counted as 11 (a "soft" hand). */
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

function hardDecision(total: number, up: number, canDouble: boolean): BJAction {
  if (total >= 17) return 'stand';
  if (total >= 13) return up <= 6 ? 'stand' : 'hit';
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (total === 11) return canDouble ? 'double' : 'hit';
  if (total === 10) return up <= 9 ? (canDouble ? 'double' : 'hit') : 'hit';
  if (total === 9) return up >= 3 && up <= 6 ? (canDouble ? 'double' : 'hit') : 'hit';
  return 'hit'; // 5–8
}

function softDecision(total: number, up: number, canDouble: boolean): BJAction {
  if (total >= 20) return 'stand'; // soft 20 / 21
  if (total === 19) return up === 6 ? (canDouble ? 'double' : 'stand') : 'stand'; // A,8 (H17 doubles vs 6)
  if (total === 18) {
    if (up >= 2 && up <= 6) return canDouble ? 'double' : 'stand';
    if (up === 7 || up === 8) return 'stand';
    return 'hit'; // vs 9, 10, A
  }
  if (total === 17) return up >= 3 && up <= 6 ? (canDouble ? 'double' : 'hit') : 'hit'; // A,6
  if (total >= 15) return up >= 4 && up <= 6 ? (canDouble ? 'double' : 'hit') : 'hit'; // A,4 / A,5
  if (total >= 13) return up >= 5 && up <= 6 ? (canDouble ? 'double' : 'hit') : 'hit'; // A,2 / A,3
  return 'hit';
}

// Whether to split a pair of the given card value against the dealer up-card.
function shouldSplit(rankVal: number, up: number): boolean {
  switch (rankVal) {
    case 11: // A,A
    case 8: // 8,8
      return true;
    case 9: // split vs 2-6, 8, 9; stand vs 7, 10, A
      return up !== 7 && up <= 9;
    case 7:
      return up <= 7;
    case 6:
      return up <= 6;
    case 4:
      return up === 5 || up === 6;
    case 3:
    case 2:
      return up <= 7;
    default: // 5,5 (play as hard 10) and 10,10 (stand) — never split
      return false;
  }
}

/**
 * Pick the basic-strategy action for the active hand. Only ever returns 'double'
 * when canDouble and 'split' when canSplit, so the result is always legal.
 */
export function decideBlackjack(
  cards: Card[],
  dealerUp: Card | null,
  canDouble: boolean,
  canSplit: boolean,
): BJAction {
  const up = dealerUp ? cardValue(dealerUp.rank) : 10;
  const { total, soft } = handTotal(cards);
  if (canSplit && cards.length === 2 && cards[0]!.rank === cards[1]!.rank && shouldSplit(cardValue(cards[0]!.rank), up)) {
    return 'split';
  }
  return soft ? softDecision(total, up, canDouble) : hardDecision(total, up, canDouble);
}
