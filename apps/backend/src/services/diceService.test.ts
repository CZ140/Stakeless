import { describe, it, expect } from 'vitest';
import {
  DICE,
  diceWinChance,
  diceMultiplier,
  diceWinChanceValid,
  diceTargetBounds,
} from '@gambling/shared';
import { rollDice, resolveDice } from './diceService.js';

describe('rollDice', () => {
  it('always returns a value in 0.00–99.99 at two-decimal precision', () => {
    for (let i = 0; i < 5000; i++) {
      const roll = rollDice();
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThanOrEqual(99.99);
      // a clean two-decimal value (k/100) — roll*100 is within float epsilon of an int
      expect(Math.abs(roll * 100 - Math.round(roll * 100))).toBeLessThan(1e-6);
    }
  });
});

describe('diceWinChance', () => {
  it('is target/100 for under and its complement for over', () => {
    expect(diceWinChance(50, 'under')).toBeCloseTo(0.5, 10);
    expect(diceWinChance(50, 'over')).toBeCloseTo(0.5, 10);
    expect(diceWinChance(25, 'under')).toBeCloseTo(0.25, 10);
    expect(diceWinChance(25, 'over')).toBeCloseTo(0.75, 10);
  });

  it('under and over at the same target are exactly complementary', () => {
    for (const t of [2, 10, 33.33, 50, 88.5, 95]) {
      expect(diceWinChance(t, 'under') + diceWinChance(t, 'over')).toBeCloseTo(1, 10);
    }
  });
});

describe('diceMultiplier', () => {
  it('applies the RTP to the inverse win chance, rounded to 2dp', () => {
    expect(diceMultiplier(50, 'under')).toBe(1.94); // 0.97 / 0.5
    expect(diceMultiplier(2, 'under')).toBe(48.5); //  0.97 / 0.02
    expect(diceMultiplier(98, 'over')).toBe(48.5); //  win chance 0.02
    expect(diceMultiplier(95, 'under')).toBe(1.02); // 0.97 / 0.95 ≈ 1.0210
  });

  it('a max-win-chance bet still pays more than 1×', () => {
    expect(diceMultiplier(DICE.MAX_WIN_CHANCE * 100, 'under')).toBeGreaterThan(1);
  });
});

describe('resolveDice', () => {
  it('decides under wins on the low side, exclusive of the target', () => {
    expect(resolveDice(49.99, 50, 'under').win).toBe(true);
    expect(resolveDice(50.0, 50, 'under').win).toBe(false);
    expect(resolveDice(50.01, 50, 'under').win).toBe(false);
  });

  it('decides over wins on the high side, inclusive of the target', () => {
    expect(resolveDice(50.0, 50, 'over').win).toBe(true);
    expect(resolveDice(49.99, 50, 'over').win).toBe(false);
    expect(resolveDice(99.99, 50, 'over').win).toBe(true);
  });

  it('returns the shared multiplier', () => {
    expect(resolveDice(10, 50, 'under').multiplier).toBe(diceMultiplier(50, 'under'));
  });
});

describe('diceWinChanceValid / diceTargetBounds', () => {
  it('accepts only win chances within the playable band', () => {
    expect(diceWinChanceValid(0.5)).toBe(true);
    expect(diceWinChanceValid(DICE.MIN_WIN_CHANCE)).toBe(true);
    expect(diceWinChanceValid(DICE.MAX_WIN_CHANCE)).toBe(true);
    expect(diceWinChanceValid(0.01)).toBe(false);
    expect(diceWinChanceValid(0.99)).toBe(false);
  });

  it('gives direction-specific target bounds that stay in range', () => {
    const under = diceTargetBounds('under');
    expect(diceWinChanceValid(diceWinChance(under.min, 'under'))).toBe(true);
    expect(diceWinChanceValid(diceWinChance(under.max, 'under'))).toBe(true);
    const over = diceTargetBounds('over');
    expect(diceWinChanceValid(diceWinChance(over.min, 'over'))).toBe(true);
    expect(diceWinChanceValid(diceWinChance(over.max, 'over'))).toBe(true);
  });
});

describe('house edge (Monte Carlo)', () => {
  it('average return per unit staked converges to the RTP', () => {
    const target = 50;
    const direction = 'under' as const;
    const mult = diceMultiplier(target, direction); // 1.94
    const N = 300_000;
    let wins = 0;
    for (let i = 0; i < N; i++) {
      if (resolveDice(rollDice(), target, direction).win) wins++;
    }
    const ev = (wins / N) * mult; // expected return per unit staked
    expect(ev).toBeGreaterThan(0.95);
    expect(ev).toBeLessThan(0.99); // centred on RTP 0.97
  });
});
