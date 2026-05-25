import { create } from 'zustand';
import type { ChickenDifficulty } from '@gambling/shared';

export type ChickenPhase = 'betting' | 'active' | 'result';

export interface ChickenResultData {
  won: boolean;
  payout: number;
  lane: number;
  multiplier: number;
  dead: boolean;
}

// A finished round for the "recent rounds" strip (session-only, newest first).
export interface ChickenRecent {
  won: boolean;
  multiplier: number;
  lanes: number;
}

const lastDifficulty = (localStorage.getItem('lastDifficulty_chicken') as ChickenDifficulty | null) ?? 'medium';

interface ChickenState {
  betAmount: number;
  difficulty: ChickenDifficulty;
  phase: ChickenPhase;
  sessionId: number | null;
  lane: number; // lanes safely crossed
  multiplier: number; // cumulative payout multiplier
  maxLanes: number;
  crossed: boolean; // reached the far side — only cash-out remains
  deadLane: number | null; // lane the chicken died on (for the death marker)
  result: ChickenResultData | null;
  recent: ChickenRecent[]; // finished rounds this session (newest first)

  setBetAmount: (n: number) => void;
  setDifficulty: (d: ChickenDifficulty) => void;
  startRound: (p: { sessionId: number; maxLanes: number }) => void;
  applyAdvance: (p: { lane: number; multiplier: number; crossed: boolean }) => void;
  applyDeath: (p: { lane: number; multiplier: number }) => void;
  applyCashout: (p: { payout: number; multiplier: number; lane: number }) => void;
  restoreSession: (s: {
    sessionId: number;
    difficulty: ChickenDifficulty;
    lane: number;
    multiplier: number;
    maxLanes: number;
    betAmount: number;
  }) => void;
  reset: () => void;
}

export const useChickenStore = create<ChickenState>()((set) => ({
  betAmount: Number(localStorage.getItem('lastBet_chicken')) || 10,
  difficulty: lastDifficulty,
  phase: 'betting',
  sessionId: null,
  lane: 0,
  multiplier: 1,
  maxLanes: 0,
  crossed: false,
  deadLane: null,
  result: null,
  recent: [],

  setBetAmount: (n) => set({ betAmount: Math.max(1, Math.floor(n)) }),
  setDifficulty: (d) => {
    localStorage.setItem('lastDifficulty_chicken', d);
    set({ difficulty: d });
  },

  startRound: ({ sessionId, maxLanes }) =>
    set({ phase: 'active', sessionId, lane: 0, multiplier: 1, maxLanes, crossed: false, deadLane: null, result: null }),

  applyAdvance: ({ lane, multiplier, crossed }) => set({ lane, multiplier, crossed }),

  applyDeath: ({ lane, multiplier }) =>
    set((s) => ({
      phase: 'result',
      deadLane: lane,
      result: { won: false, payout: 0, lane, multiplier, dead: true },
      recent: [{ won: false, multiplier: 0, lanes: lane }, ...s.recent].slice(0, 12),
    })),

  applyCashout: ({ payout, multiplier, lane }) =>
    set((s) => ({
      phase: 'result',
      result: { won: true, payout, lane, multiplier, dead: false },
      recent: [{ won: true, multiplier, lanes: lane }, ...s.recent].slice(0, 12),
    })),

  restoreSession: (s) =>
    set({
      phase: 'active',
      sessionId: s.sessionId,
      difficulty: s.difficulty,
      lane: s.lane,
      multiplier: s.multiplier,
      maxLanes: s.maxLanes,
      crossed: s.lane >= s.maxLanes,
      deadLane: null,
      result: null,
    }),

  reset: () =>
    set({ phase: 'betting', sessionId: null, lane: 0, multiplier: 1, maxLanes: 0, crossed: false, deadLane: null, result: null }),
}));
