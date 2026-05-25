import { describe, it, expect } from 'vitest';
import {
  HILO,
  hiloWinChance,
  hiloStepMultiplier,
  hiloDirectionAvailable,
  hiloGuessWins,
} from '@gambling/shared';
import { drawCard, initialHiloState, applyHiloGuess, type HiloSessionState } from './hiloService.js';

describe('drawCard', () => {
  it('always returns a valid rank (2..14) and suit', () => {
    const suits = new Set(['spades', 'hearts', 'diamonds', 'clubs']);
    for (let i = 0; i < 5000; i++) {
      const c = drawCard();
      expect(c.rank).toBeGreaterThanOrEqual(2);
      expect(c.rank).toBeLessThanOrEqual(14);
      expect(Number.isInteger(c.rank)).toBe(true);
      expect(suits.has(c.suit)).toBe(true);
    }
  });

  it('is roughly uniform over the 13 ranks', () => {
    const N = 260_000;
    const counts = new Array(15).fill(0);
    for (let i = 0; i < N; i++) counts[drawCard().rank]++;
    const expected = N / HILO.RANKS;
    for (let r = 2; r <= 14; r++) {
      expect(counts[r]).toBeGreaterThan(expected * 0.9);
      expect(counts[r]).toBeLessThan(expected * 1.1);
    }
  });
});

describe('hiloWinChance / availability', () => {
  it('counts strictly higher/lower cards out of 52', () => {
    // rank 7: higher = ranks 8..14 (7 ranks × 4 = 28); lower = ranks 2..6 (5 × 4 = 20)
    expect(hiloWinChance(7, 'hi')).toBeCloseTo(28 / 52, 10);
    expect(hiloWinChance(7, 'lo')).toBeCloseTo(20 / 52, 10);
  });

  it('ties are excluded — chances do not sum to 1 (the 4/52 tie gap)', () => {
    for (const r of [3, 7, 10, 13]) {
      expect(hiloWinChance(r, 'hi') + hiloWinChance(r, 'lo')).toBeCloseTo(48 / 52, 10);
    }
  });

  it('disables the impossible direction at the extremes', () => {
    expect(hiloDirectionAvailable(14, 'hi')).toBe(false); // Ace can't go higher
    expect(hiloDirectionAvailable(2, 'lo')).toBe(false); //  2 can't go lower
    expect(hiloDirectionAvailable(14, 'lo')).toBe(true);
    expect(hiloDirectionAvailable(2, 'hi')).toBe(true);
  });
});

describe('hiloStepMultiplier', () => {
  it('is RTP / winChance and always > 1 for a playable step', () => {
    expect(hiloStepMultiplier(7, 'hi')).toBeCloseTo(0.97 / (28 / 52), 10);
    // The safest playable step (2→higher / Ace→lower) is 48/52 ≈ 0.923 → ~1.05×.
    expect(hiloStepMultiplier(2, 'hi')).toBeGreaterThan(1);
    expect(hiloStepMultiplier(14, 'lo')).toBeGreaterThan(1);
  });

  it('is 0 for an impossible direction', () => {
    expect(hiloStepMultiplier(14, 'hi')).toBe(0);
    expect(hiloStepMultiplier(2, 'lo')).toBe(0);
  });
});

describe('hiloGuessWins', () => {
  it('is strict — ties lose', () => {
    expect(hiloGuessWins(7, 9, 'hi')).toBe(true);
    expect(hiloGuessWins(7, 7, 'hi')).toBe(false);
    expect(hiloGuessWins(7, 5, 'hi')).toBe(false);
    expect(hiloGuessWins(7, 5, 'lo')).toBe(true);
    expect(hiloGuessWins(7, 7, 'lo')).toBe(false);
  });
});

describe('applyHiloGuess', () => {
  function stateWithCard(rank: number): HiloSessionState {
    const s = initialHiloState();
    s.currentCard = { rank, suit: 'spades' };
    return s;
  }

  it('on a win: advances the card, increments streak, compounds, pushes history', () => {
    const s = stateWithCard(7);
    // Force determinism by checking against the actual drawn card.
    const r = applyHiloGuess(s, 'hi');
    if (r.win) {
      expect(r.nextCard.rank).toBeGreaterThan(7);
      expect(s.streak).toBe(1);
      expect(s.currentCard).toEqual(r.nextCard);
      expect(s.history).toHaveLength(1);
      expect(s.multiplier).toBeGreaterThan(1);
      expect(s.status).toBe('active');
    } else {
      expect(r.nextCard.rank).toBeLessThanOrEqual(7);
      expect(s.status).toBe('busted');
      expect(s.streak).toBe(0);
    }
  });

  it('always busts when guessing higher on an Ace base (impossible to win)', () => {
    const s = stateWithCard(14);
    const r = applyHiloGuess(s, 'hi');
    expect(r.win).toBe(false);
    expect(s.status).toBe('busted');
  });

  it('always wins guessing higher on a 2 base unless tied', () => {
    let wins = 0;
    let ties = 0;
    for (let i = 0; i < 2000; i++) {
      const s = stateWithCard(2);
      const r = applyHiloGuess(s, 'hi');
      if (r.win) wins++;
      else ties++; // only a drawn 2 (tie) loses
    }
    expect(wins).toBeGreaterThan(ties); // ~92% win
  });
});

describe('house edge (Monte Carlo)', () => {
  it('average return per single guess converges to the RTP', () => {
    const dir = 'hi' as const;
    const baseRank = 7;
    const stepMult = hiloStepMultiplier(baseRank, dir);
    const N = 300_000;
    let totalReturn = 0;
    for (let i = 0; i < N; i++) {
      const s: HiloSessionState = { currentCard: { rank: baseRank, suit: 'clubs' }, history: [], streak: 0, multiplier: 1, status: 'active' };
      const r = applyHiloGuess(s, dir);
      if (r.win) totalReturn += stepMult; // staked 1 unit, paid stepMult on a win
    }
    const ev = totalReturn / N;
    expect(ev).toBeGreaterThan(0.95);
    expect(ev).toBeLessThan(0.99); // centred on RTP 0.97
    expect(HILO.RTP).toBe(0.97);
  });
});
