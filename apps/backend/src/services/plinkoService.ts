import { randomInt } from 'node:crypto';

export type RiskLevel = 'low' | 'medium' | 'high' | 'expert';

// Stake.com-referenced Plinko multiplier tables.
// Structure: PLINKO_MULTIPLIERS[riskLevel][rows] = number[] with (rows+1) elements (symmetric)
// Low risk: gentle curve — small edge boost, center is near 1×
// Medium risk: steeper curve — edges meaningfully higher
// High risk: extreme edges — center is heavily penalized
// Expert risk: even more extreme than High
//
// Bucket counts per row:
//   8 rows → 9 buckets   11 rows → 12 buckets   14 rows → 15 buckets
//   9 rows → 10 buckets  12 rows → 13 buckets   15 rows → 16 buckets
//  10 rows → 11 buckets  13 rows → 14 buckets   16 rows → 17 buckets
export const PLINKO_MULTIPLIERS: Record<RiskLevel, Record<number, number[]>> = {
  low: {
    //            0    1    2    3    4    5    6    7    8
    8:  [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    //         0    1    2    3    4    5    6    7    8    9
    9:  [5.6, 2.0, 1.6, 1.0, 0.7, 0.7, 1.0, 1.6, 2.0, 5.6],
    //          0    1    2    3    4    5    6    7    8    9   10
    10: [8.9, 3.0, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3.0, 8.9],
    //          0    1    2    3    4    5    6    7    8    9   10   11
    11: [8.4, 3.0, 1.9, 1.3, 1.0, 0.7, 0.7, 1.0, 1.3, 1.9, 3.0, 8.4],
    //         0   1    2    3    4    5    6    7    8    9   10   11  12
    12: [15, 4.5, 2, 2, 1.5, 0.75, 0.1, 0.75, 1.5, 2, 2, 4.5, 15],
    //          0    1    2    3    4    5    6    7    8    9   10   11   12   13
    13: [9, 4.5, 3.5, 1, 1, 0.9, 0.9, 0.9, 0.9, 1, 1, 3.5, 4.5, 9],
    //          0    1    2    3    4    5    6    7    8    9   10   11   12   13   14
    14: [8, 4.5, 2.5, 2.5, 1.2, 1.2, 0.75, 0.6, 0.75, 1.2, 1.2, 2.5, 2.5, 4.5, 8],
    //          0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
    15: [15, 8.5, 3.5, 2, 2, 0.9, 0.9, 0.75, 0.75, 0.9, 0.9, 2, 2, 3.5, 8.5, 15],
    //          0   1   2    3    4    5    6    7    8    9   10   11   12   13   14  15  16
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    //          0   1    2    3    4    3    2    1    0  (symmetric)
    8:  [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9:  [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    10: [22, 5, 2.0, 1.4, 0.6, 0.4, 0.6, 1.4, 2.0, 5, 22],
    11: [24, 6, 3.0, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3.0, 6, 24],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    14: [55, 15, 7, 4, 1, 0.8, 0.7, 0.6, 0.7, 0.8, 1, 4, 7, 15, 55],
    15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    16: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8:  [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    9:  [43, 7, 2.0, 0.6, 0.2, 0.2, 0.6, 2.0, 7, 43],
    10: [76, 10, 3.0, 0.9, 0.3, 0.2, 0.3, 0.9, 3.0, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24, 170],
    13: [225, 35, 9.5, 3.5, 0.8, 0.75, 0.05, 0.05, 0.75, 0.8, 3.5, 9.5, 35, 225],
    14: [400, 55, 15, 4.5, 0.7, 0.6, 0.5, 0.3, 0.5, 0.6, 0.7, 4.5, 15, 55, 400],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
  expert: {
    8:  [35, 5, 1, 0.3, 0.2, 0.3, 1, 5, 35],
    9:  [55, 8, 0.7, 0.6, 0.4, 0.4, 0.6, 0.7, 8, 55],
    10: [90, 15, 3.5, 0.5, 0.2, 0.05, 0.2, 0.5, 3.5, 15, 90],
    11: [150, 20, 5.5, 0.5, 0.5, 0.2, 0.2, 0.5, 0.5, 5.5, 20, 150],
    12: [200, 30, 8, 0.8, 0.5, 0.5, 0.25, 0.5, 0.5, 0.8, 8, 30, 200],
    13: [325, 50, 10, 3.5, 1, 0.25, 0.15, 0.15, 0.25, 1, 3.5, 10, 50, 325],
    14: [375, 75, 20, 5.5, 0.6, 0.5, 0.3, 0.2, 0.3, 0.5, 0.6, 5.5, 20, 75, 375],
    15: [750, 125, 30, 7.5, 3, 0.5, 0.15, 0.1, 0.1, 0.15, 0.5, 3, 7.5, 30, 125, 750],
    16: [2000, 200, 40, 10, 4, 0.9, 0.4, 0.15, 0.1, 0.15, 0.4, 0.9, 4, 10, 40, 200, 2000],
  },
};

/**
 * Rolls a landing bucket the way a real Plinko ball lands: at each of the `rows`
 * pegs the ball goes left or right with equal probability, so the bucket index
 * is the count of right-bounces — a Binomial(rows, 0.5) distribution.
 *
 * This is the crux of fair Plinko odds. A uniform pick (randomInt(0, rows+1))
 * would give every bucket the same chance, making the huge edge multipliers
 * (e.g. expert/16 pays 5000× at the edges) wildly likely — ~1/17 each instead
 * of the intended ~1/65536 — which is both "too easy" and hugely +EV. The
 * multiplier tables are calibrated for this binomial distribution.
 *
 * @param rows - Number of peg rows (8–16); bucket is 0..rows.
 */
export function rollPlinkoBucket(rows: number): number {
  let bucket = 0;
  for (let i = 0; i < rows; i++) {
    bucket += randomInt(0, 2); // 0 (left) or 1 (right)
  }
  return bucket;
}

/**
 * Returns the multiplier for the given Plinko configuration.
 * Returns 0 if any parameter is invalid.
 *
 * @param rows        - Number of peg rows (8–16)
 * @param riskLevel   - Risk level string ('low'|'medium'|'high'|'expert')
 * @param bucketIndex - Which bucket (0 = far left, rows = far right)
 */
export function resolvePlinko(rows: number, riskLevel: string, bucketIndex: number): number {
  const table = PLINKO_MULTIPLIERS[riskLevel as RiskLevel];
  if (!table) return 0;

  const buckets = table[rows];
  if (!buckets) return 0;

  if (bucketIndex < 0 || bucketIndex >= buckets.length) return 0;

  return buckets[bucketIndex] ?? 0;
}
