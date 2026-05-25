import { create } from 'zustand';
import type { HiloCard } from '@gambling/shared';

export type HiloPhase = 'betting' | 'active' | 'result';

export interface HiloResultData {
  won: boolean;
  payout: number;
  streak: number;
  multiplier: number;
}

const HISTORY_LIMIT = 12;

interface HiloState {
  betAmount: number;
  phase: HiloPhase;
  sessionId: number | null;
  currentCard: HiloCard | null; // the base card the next draw is compared against
  history: HiloCard[]; // climbed cards (most recent last)
  streak: number;
  multiplier: number; // cumulative payout multiplier
  lastWin: boolean | null; // outcome of the most recent guess (drives the flip color)
  result: HiloResultData | null;

  setBetAmount: (n: number) => void;
  startRound: (p: { sessionId: number; currentCard: HiloCard }) => void;
  applyWin: (p: { nextCard: HiloCard; multiplier: number; streak: number }) => void;
  applyBust: (p: { nextCard: HiloCard; multiplier: number; streak: number }) => void;
  applyCashout: (p: { payout: number; multiplier: number; streak: number }) => void;
  restoreSession: (s: {
    sessionId: number;
    currentCard: HiloCard;
    history: HiloCard[];
    streak: number;
    multiplier: number;
    betAmount: number;
  }) => void;
  reset: () => void;
}

export const useHiloStore = create<HiloState>()((set) => ({
  betAmount: Number(localStorage.getItem('lastBet_hilo')) || 10,
  phase: 'betting',
  sessionId: null,
  currentCard: null,
  history: [],
  streak: 0,
  multiplier: 1,
  lastWin: null,
  result: null,

  setBetAmount: (n) => set({ betAmount: Math.max(1, Math.floor(n)) }),

  startRound: ({ sessionId, currentCard }) =>
    set({ phase: 'active', sessionId, currentCard, history: [], streak: 0, multiplier: 1, lastWin: null, result: null }),

  // Correct guess: the drawn card becomes the new base; the old base joins history.
  applyWin: ({ nextCard, multiplier, streak }) =>
    set((s) => ({
      history: s.currentCard ? [...s.history, s.currentCard].slice(-HISTORY_LIMIT) : s.history,
      currentCard: nextCard,
      multiplier,
      streak,
      lastWin: true,
    })),

  // Wrong guess (or tie): show the losing card and end the round.
  applyBust: ({ nextCard, multiplier, streak }) =>
    set((s) => ({
      history: s.currentCard ? [...s.history, s.currentCard].slice(-HISTORY_LIMIT) : s.history,
      currentCard: nextCard,
      lastWin: false,
      phase: 'result',
      result: { won: false, payout: 0, streak, multiplier },
    })),

  applyCashout: ({ payout, multiplier, streak }) =>
    set({ phase: 'result', result: { won: true, payout, streak, multiplier } }),

  restoreSession: (s) =>
    set({
      phase: 'active',
      sessionId: s.sessionId,
      currentCard: s.currentCard,
      history: s.history,
      streak: s.streak,
      multiplier: s.multiplier,
      lastWin: null,
      result: null,
    }),

  reset: () =>
    set({ phase: 'betting', sessionId: null, currentCard: null, history: [], streak: 0, multiplier: 1, lastWin: null, result: null }),
}));
