// Chicken (a.k.a. "Chicken Road") — a lane-crossing cash-out ladder. The chicken
// crosses a busy road one lane at a time; each safe lane compounds the payout
// multiplier and the player cashes out any time. Stepping into a lane with a car
// ends the round and loses the whole stake. Shared by the backend (settlement)
// and the frontend (live multiplier + the per-lane multiplier preview). The
// crypto RNG (the hidden car layout) lives backend-only in chickenService.ts.
//
// Model (independent lanes — contrast Pump's depleting balloon): every lane is an
// INDEPENDENT Bernoulli trial with a fixed death chance `q` set by difficulty, so
// the per-lane risk is CONSTANT (it never rises as you progress) and the
// multiplier climbs GEOMETRICALLY. Surviving n lanes has probability
//   P(survive n) = (1 − q)^n
// and the payout multiplier applies the house edge ONCE to the fair odds:
//   mult(n) = RTP / (1 − q)^n.
// So the expected return when cashing out after ANY n ≥ 1 lanes is exactly the
// RTP (0.97) — the edge is fully front-loaded and each further lane is a fair
// (EV-neutral) gamble, matching Pump/Mines. Difficulty trades a higher per-lane
// death chance for a faster climb (and a shorter road).

export type ChickenDifficulty = 'easy' | 'medium' | 'hard' | 'daredevil';

export interface ChickenDifficultyConfig {
  id: ChickenDifficulty;
  label: string;
  deathChance: number; // q — constant per-lane probability of a car (0..1)
  lanes: number; // road length: most lanes the chicken can cross
}

export const CHICKEN = {
  RTP: 0.97, // 97% return-to-player (3% house edge) — matches the rest of the lineup
  MAX_MULTIPLIER: 1_000_000, // safety cap
  RESOLUTION: 1_000_000, // crypto Bernoulli denominator (see chickenService.generateRoad)
} as const;

// Difficulties: death chance 10% / 20% / 35% / 55%, ceilings (= RTP / (1−q)^lanes)
// ≈ 8× / 27.6× / 170× / 1281×. First-lane multiplier ≈ 1.08× / 1.21× / 1.49× / 2.16×.
export const CHICKEN_DIFFICULTIES: Record<ChickenDifficulty, ChickenDifficultyConfig> = {
  easy:      { id: 'easy',      label: 'Easy',      deathChance: 0.10, lanes: 20 },
  medium:    { id: 'medium',    label: 'Medium',    deathChance: 0.20, lanes: 15 },
  hard:      { id: 'hard',      label: 'Hard',      deathChance: 0.35, lanes: 12 },
  daredevil: { id: 'daredevil', label: 'Daredevil', deathChance: 0.55, lanes: 9 },
};

export const CHICKEN_DIFFICULTY_IDS: ChickenDifficulty[] = ['easy', 'medium', 'hard', 'daredevil'];

export function isChickenDifficulty(v: unknown): v is ChickenDifficulty {
  return typeof v === 'string' && v in CHICKEN_DIFFICULTIES;
}

export function chickenConfig(d: ChickenDifficulty): ChickenDifficultyConfig {
  return CHICKEN_DIFFICULTIES[d];
}

// Road length — the most lanes the chicken can cross before reaching the far side.
export function chickenMaxLanes(d: ChickenDifficulty): number {
  return chickenConfig(d).lanes;
}

// Probability the NEXT lane has a car — constant for the whole road (independent
// lanes). Kept as a function for symmetry with the other ladder games.
export function chickenDeathChance(d: ChickenDifficulty): number {
  return chickenConfig(d).deathChance;
}

// Probability of surviving `lanes` consecutive lanes from the start.
export function chickenSurvivalChance(d: ChickenDifficulty, lanes: number): number {
  if (lanes <= 0) return 1;
  return Math.pow(1 - chickenConfig(d).deathChance, lanes);
}

// Cumulative payout multiplier after `lanes` safely crossed (house edge applied
// once). lanes = 0 → 1×. Full precision — round only for display.
export function chickenMultiplier(d: ChickenDifficulty, lanes: number): number {
  if (lanes <= 0) return 1;
  const p = chickenSurvivalChance(d, lanes);
  if (p <= 0) return CHICKEN.MAX_MULTIPLIER;
  return Math.min(CHICKEN.MAX_MULTIPLIER, CHICKEN.RTP / p);
}
