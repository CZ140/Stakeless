import { randomInt } from 'node:crypto';
import {
  HILO,
  hiloGuessWins,
  hiloCompound,
  type HiloDirection,
  type HiloCard,
  type CardSuit,
} from '@gambling/shared';

const SUITS: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

// Draw a uniform card from a 52-card deck (i.i.d. model — a continuously
// shuffled shoe), using a crypto-secure RNG. Index 0..51 → rank 2..14 × 4 suits.
export function drawCard(): HiloCard {
  const n = randomInt(0, HILO.DECK_SIZE); // 0..51
  const rank = HILO.RANK_MIN + Math.floor(n / HILO.SUITS); // 2..14
  const suit = SUITS[n % HILO.SUITS]!;
  return { rank, suit };
}

export interface HiloSessionState {
  currentCard: HiloCard; // the card the next draw is compared against (public)
  history: HiloCard[]; // recent prior cards (most recent last), bounded for the client view
  streak: number; // correct guesses so far
  multiplier: number; // cumulative payout multiplier (house edge applied)
  status: 'active' | 'busted' | 'cashout';
}

const HISTORY_LIMIT = 12;

export function initialHiloState(): HiloSessionState {
  return { currentCard: drawCard(), history: [], streak: 0, multiplier: 1, status: 'active' };
}

export interface HiloGuessResult {
  nextCard: HiloCard;
  win: boolean;
  multiplier: number; // cumulative after this guess (unchanged on a bust)
  streak: number;
}

// Apply a guess to the (mutated) state. Draws the next card; on a win compounds
// the multiplier and advances the current card, on a loss busts the round.
// Caller is responsible for validating the direction is playable first.
export function applyHiloGuess(state: HiloSessionState, dir: HiloDirection): HiloGuessResult {
  const fromRank = state.currentCard.rank;
  const nextCard = drawCard();
  const win = hiloGuessWins(fromRank, nextCard.rank, dir);

  if (win) {
    state.history.push(state.currentCard);
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.currentCard = nextCard;
    state.streak += 1;
    state.multiplier = hiloCompound(state.multiplier, fromRank, dir);
  } else {
    state.status = 'busted';
  }

  return { nextCard, win, multiplier: state.multiplier, streak: state.streak };
}
