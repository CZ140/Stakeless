import { describe, it, expect } from 'vitest';
import {
  CHICKEN,
  CHICKEN_DIFFICULTIES,
  CHICKEN_DIFFICULTY_IDS,
  chickenConfig,
  chickenMaxLanes,
  chickenSurvivalChance,
  chickenMultiplier,
  type ChickenDifficulty,
} from '@gambling/shared';
import { generateRoad, initialChickenState, applyStep, type ChickenSessionState } from './chickenService.js';

describe('generateRoad', () => {
  it('produces one lane per difficulty road length', () => {
    for (const id of CHICKEN_DIFFICULTY_IDS) {
      expect(generateRoad(id)).toHaveLength(chickenConfig(id).lanes);
    }
  });

  it('the empirical car rate matches the difficulty death chance', () => {
    // Aggregate many roads and check the proportion of car-lanes ≈ deathChance.
    for (const id of CHICKEN_DIFFICULTY_IDS) {
      const q = chickenConfig(id).deathChance;
      let cars = 0;
      let total = 0;
      for (let i = 0; i < 4000; i++) {
        const road = generateRoad(id);
        cars += road.filter(Boolean).length;
        total += road.length;
      }
      expect(cars / total).toBeGreaterThan(q - 0.03);
      expect(cars / total).toBeLessThan(q + 0.03);
    }
  });
});

describe('chickenMultiplier / survival', () => {
  it('is 1× before any lane and grows monotonically', () => {
    for (const id of CHICKEN_DIFFICULTY_IDS) {
      expect(chickenMultiplier(id, 0)).toBe(1);
      let prev = 1;
      for (let n = 1; n <= chickenMaxLanes(id); n++) {
        const m = chickenMultiplier(id, n);
        expect(m).toBeGreaterThan(prev);
        prev = m;
      }
    }
  });

  it('climbs geometrically — the per-lane ratio is the constant 1/(1−q)', () => {
    for (const id of CHICKEN_DIFFICULTY_IDS) {
      const ratio = 1 / (1 - chickenConfig(id).deathChance);
      for (let n = 2; n <= chickenMaxLanes(id); n++) {
        expect(chickenMultiplier(id, n) / chickenMultiplier(id, n - 1)).toBeCloseTo(ratio, 6);
      }
    }
  });

  it('expected return when cashing out after ANY number of lanes is exactly the RTP', () => {
    for (const id of CHICKEN_DIFFICULTY_IDS) {
      for (let n = 1; n <= chickenMaxLanes(id); n++) {
        const ev = chickenSurvivalChance(id, n) * chickenMultiplier(id, n);
        expect(ev).toBeCloseTo(CHICKEN.RTP, 9);
      }
    }
  });
});

describe('applyStep', () => {
  function activeState(difficulty: ChickenDifficulty, road: boolean[]): ChickenSessionState {
    return { difficulty, road, lane: 0, multiplier: 1, status: 'active' };
  }

  it('survives a clear lane: advances and compounds', () => {
    const s = activeState('hard', Array(12).fill(false));
    const r = applyStep(s);
    expect(r.dead).toBe(false);
    expect(s.lane).toBe(1);
    expect(s.status).toBe('active');
    expect(s.multiplier).toBeCloseTo(chickenMultiplier('hard', 1), 9);
  });

  it('dies on a car lane: ends the round, leaving lane/multiplier unchanged', () => {
    const road = Array(12).fill(false);
    road[0] = true; // car in the first lane
    const s = activeState('medium', road);
    const r = applyStep(s);
    expect(r.dead).toBe(true);
    expect(s.status).toBe('dead');
    expect(s.lane).toBe(0);
    expect(s.multiplier).toBe(1);
  });

  it('flags crossing the far side on the final safe lane', () => {
    const s = activeState('daredevil', Array(chickenMaxLanes('daredevil')).fill(false));
    let last: ReturnType<typeof applyStep> | null = null;
    for (let i = 0; i < chickenMaxLanes('daredevil'); i++) last = applyStep(s);
    expect(last!.crossed).toBe(true);
    expect(s.lane).toBe(chickenMaxLanes('daredevil'));
  });

  it('walks a known road: survives then dies at the car', () => {
    const road = Array(15).fill(false);
    road[2] = true; // clear, clear, CAR
    const s = activeState('medium', road);
    expect(applyStep(s).dead).toBe(false);
    expect(applyStep(s).dead).toBe(false);
    expect(s.lane).toBe(2);
    expect(applyStep(s).dead).toBe(true);
    expect(s.lane).toBe(2); // unchanged by the death
    expect(s.status).toBe('dead');
  });

  it('initialChickenState opens an active round with a full hidden road', () => {
    const s = initialChickenState('easy');
    expect(s.status).toBe('active');
    expect(s.lane).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(s.road).toHaveLength(CHICKEN_DIFFICULTIES.easy.lanes);
  });
});

describe('house edge (Monte Carlo)', () => {
  it('average return of a single step-then-cash-out converges to the RTP', () => {
    const id: ChickenDifficulty = 'hard';
    const N = 300_000;
    const payout = chickenMultiplier(id, 1);
    let total = 0;
    for (let i = 0; i < N; i++) {
      const s = initialChickenState(id);
      if (!applyStep(s).dead) total += payout;
    }
    const ev = total / N;
    expect(ev).toBeGreaterThan(0.95);
    expect(ev).toBeLessThan(0.99); // centred on RTP 0.97
    expect(CHICKEN.RTP).toBe(0.97);
  });
});
