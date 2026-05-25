import { randomInt } from 'node:crypto';
import { CHICKEN, chickenConfig, chickenMultiplier, type ChickenDifficulty } from '@gambling/shared';

export interface ChickenSessionState {
  difficulty: ChickenDifficulty;
  // Hidden car layout (true = car/death), one entry per lane. NEVER serialized to
  // the client — it would reveal which lanes are safe.
  road: boolean[];
  lane: number; // lanes safely crossed so far
  multiplier: number; // cumulative payout multiplier (house edge applied)
  status: 'active' | 'dead' | 'cashout';
}

// Build the hidden car layout: each of `lanes` lanes is an INDEPENDENT Bernoulli
// trial with probability `deathChance` of holding a car, sampled with a crypto RNG
// (randomInt over a fixed resolution). Independent lanes ⇒ constant per-lane risk.
export function generateRoad(difficulty: ChickenDifficulty): boolean[] {
  const { lanes, deathChance } = chickenConfig(difficulty);
  const threshold = Math.round(deathChance * CHICKEN.RESOLUTION);
  const road: boolean[] = [];
  for (let i = 0; i < lanes; i++) road.push(randomInt(0, CHICKEN.RESOLUTION) < threshold);
  return road;
}

export function initialChickenState(difficulty: ChickenDifficulty): ChickenSessionState {
  return { difficulty, road: generateRoad(difficulty), lane: 0, multiplier: 1, status: 'active' };
}

export interface ChickenResult {
  dead: boolean;
  lane: number; // lanes crossed after this step (unchanged on death)
  multiplier: number; // cumulative after this step (unchanged on death)
  crossed: boolean; // reached the far side (no lanes remain)
}

// Apply one step to the (mutated) state. Reveals the next lane: a car kills the
// chicken (round over), otherwise the step compounds the multiplier. Caller must
// ensure the round is active and the chicken hasn't already crossed the road.
export function applyStep(state: ChickenSessionState): ChickenResult {
  const car = state.road[state.lane]; // the next lane to step into
  if (car === true) {
    state.status = 'dead';
    return { dead: true, lane: state.lane, multiplier: state.multiplier, crossed: false };
  }
  state.lane += 1;
  state.multiplier = chickenMultiplier(state.difficulty, state.lane);
  return { dead: false, lane: state.lane, multiplier: state.multiplier, crossed: state.lane >= state.road.length };
}
