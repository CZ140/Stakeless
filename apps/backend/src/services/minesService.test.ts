import { describe, it, expect } from 'vitest';
import { generateMineGrid, calculateMinesMultiplier } from './minesService.js';

describe('generateMineGrid', () => {
  it('returns array of 25 elements', () => {
    const grid = generateMineGrid(5);
    expect(grid).toHaveLength(25);
  });

  it('has exactly mineCount true values for mineCount=5', () => {
    const grid = generateMineGrid(5);
    const mineCount = grid.filter(Boolean).length;
    expect(mineCount).toBe(5);
  });

  it('has exactly mineCount true values for mineCount=1', () => {
    const grid = generateMineGrid(1);
    const mineCount = grid.filter(Boolean).length;
    expect(mineCount).toBe(1);
  });

  it('has exactly mineCount true values for mineCount=24', () => {
    const grid = generateMineGrid(24);
    const mineCount = grid.filter(Boolean).length;
    expect(mineCount).toBe(24);
  });

  it('has exactly 20 false values for mineCount=5', () => {
    const grid = generateMineGrid(5);
    const safeCount = grid.filter((v) => !v).length;
    expect(safeCount).toBe(20);
  });

  it('returns all booleans (no undefined/null in grid)', () => {
    const grid = generateMineGrid(5);
    grid.forEach((cell) => {
      expect(typeof cell).toBe('boolean');
    });
  });

  it('produces different distributions across multiple calls (randomness check)', () => {
    const grids = Array.from({ length: 10 }, () => generateMineGrid(5));
    // Very unlikely (essentially impossible) for all 10 to be identical
    const allSame = grids.every(
      (g) => JSON.stringify(g) === JSON.stringify(grids[0])
    );
    expect(allSame).toBe(false);
  });
});

describe('calculateMinesMultiplier', () => {
  it('returns 1.0 before any reveal (0 tiles) with 1 mine', () => {
    expect(calculateMinesMultiplier(1, 0)).toBe(1.0);
  });

  it('returns 1.0 before any reveal (0 tiles) with 24 mines', () => {
    expect(calculateMinesMultiplier(24, 0)).toBe(1.0);
  });

  it('returns greater than 1.0 after first safe reveal with 1 mine', () => {
    expect(calculateMinesMultiplier(1, 1)).toBeGreaterThan(1.0);
  });

  it('returns greater than 1.0 after first safe reveal with 24 mines', () => {
    expect(calculateMinesMultiplier(24, 1)).toBeGreaterThan(1.0);
  });

  it('grows monotonically as tilesRevealed increases (mineCount=1)', () => {
    let prev = calculateMinesMultiplier(1, 0);
    for (let i = 1; i <= 10; i++) {
      const curr = calculateMinesMultiplier(1, i);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });

  it('grows monotonically as tilesRevealed increases (mineCount=5)', () => {
    let prev = calculateMinesMultiplier(5, 0);
    for (let i = 1; i <= 10; i++) {
      const curr = calculateMinesMultiplier(5, i);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });

  it('multiplier with 24 mines after 1 reveal > multiplier with 1 mine after 1 reveal', () => {
    const highRisk = calculateMinesMultiplier(24, 1);
    const lowRisk = calculateMinesMultiplier(1, 1);
    expect(highRisk).toBeGreaterThan(lowRisk);
  });

  it('returns a very high value when almost all safe tiles revealed with 1 mine (1 mine, 24 reveals)', () => {
    const multiplier = calculateMinesMultiplier(1, 24);
    expect(multiplier).toBeGreaterThan(10.0);
  });

  it('returns a number with at most 2 decimal places', () => {
    const val = calculateMinesMultiplier(3, 5);
    const rounded = Math.round(val * 100) / 100;
    expect(val).toBe(rounded);
  });
});
