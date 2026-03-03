import { randomInt } from 'node:crypto';

export interface MinesSessionState {
  mineCount: number;
  grid: boolean[];       // 25 elements, true = mine
  revealed: number[];    // safe tile indices revealed so far
  tilesRevealed: number;
  multiplier: number;
  status: 'active' | 'cashout' | 'exploded';
}

/**
 * Generates a 25-element boolean array with exactly mineCount true values.
 * Uses Fisher-Yates shuffle seeded by crypto.randomInt for provable fairness (GINF-02).
 */
export function generateMineGrid(mineCount: number): boolean[] {
  const grid: boolean[] = Array(25).fill(false);
  for (let i = 0; i < mineCount; i++) grid[i] = true;
  // Fisher-Yates shuffle using crypto.randomInt
  for (let i = 24; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [grid[i], grid[j]] = [grid[j]!, grid[i]!];
  }
  return grid;
}

/**
 * Calculates the multiplier after `tilesRevealed` safe reveals with `mineCount` mines
 * in a 25-tile grid. Uses hypergeometric compound formula with 0.97 house factor.
 *
 * Formula: multiply by (totalTiles - i) / (totalSafe - i) for each reveal i=0..n-1,
 * then apply 0.97 house factor and round to 2 decimal places.
 *
 * - Returns 1.0 before any reveal (tilesRevealed === 0)
 * - Grows monotonically as tilesRevealed increases
 * - Higher mineCount → higher multiplier for same tilesRevealed
 */
export function calculateMinesMultiplier(mineCount: number, tilesRevealed: number): number {
  if (tilesRevealed === 0) return 1.0;
  const totalSafe = 25 - mineCount;
  let multiplier = 1.0;
  for (let i = 0; i < tilesRevealed; i++) {
    multiplier *= (25 - i) / (totalSafe - i);
  }
  return Math.round(multiplier * 0.97 * 100) / 100;
}
