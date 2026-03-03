import { create } from 'zustand';

export type MinesGamePhase = 'betting' | 'active' | 'result';

export interface MinesResultData {
  won: boolean;
  payout: number;
  mineGrid: boolean[];  // 25 booleans, true = mine
}

interface MinesState {
  // Config (set before starting)
  betAmount: number;
  mineCount: number;   // 1–24

  // Active round state
  gamePhase: MinesGamePhase;
  sessionId: number | null;
  revealed: number[];       // tile indices revealed safe (not mines)
  tilesRevealed: number;
  multiplier: number;       // current live multiplier
  isMuted: boolean;

  // Result
  result: MinesResultData | null;
  mineGrid: boolean[] | null; // revealed after round ends

  // Actions
  setBetAmount: (n: number) => void;
  setMineCount: (n: number) => void;
  halfBet: () => void;
  doubleBet: () => void;
  startRound: (sessionId: number) => void;
  revealTile: (tileIndex: number, multiplier: number) => void;
  setResult: (result: MinesResultData) => void;
  restoreSession: (session: { sessionId: number; tilesRevealed: number; revealed: number[]; mineCount: number; multiplier: number; betAmount: number }) => void;
  resetToConfig: () => void;
  toggleMute: () => void;
}

export const useMinesStore = create<MinesState>()((set) => ({
  betAmount: Number(localStorage.getItem('lastBet_mines')) || 10,
  mineCount: 3,
  gamePhase: 'betting',
  sessionId: null,
  revealed: [],
  tilesRevealed: 0,
  multiplier: 1.0,
  isMuted: localStorage.getItem('isMuted_mines') === 'true',
  result: null,
  mineGrid: null,

  setBetAmount: (n) => set({ betAmount: Math.max(1, n) }),
  setMineCount: (n) => set({ mineCount: Math.min(24, Math.max(1, n)) }),
  halfBet: () => set((s) => ({ betAmount: Math.max(1, Math.floor(s.betAmount / 2)) })),
  doubleBet: () => set((s) => ({ betAmount: s.betAmount * 2 })),
  startRound: (sessionId) => set({ gamePhase: 'active', sessionId, revealed: [], tilesRevealed: 0, multiplier: 1.0, result: null, mineGrid: null }),
  revealTile: (tileIndex, multiplier) => set((s) => ({
    revealed: [...s.revealed, tileIndex],
    tilesRevealed: s.tilesRevealed + 1,
    multiplier,
  })),
  setResult: (result) => set({ gamePhase: 'result', result, mineGrid: result.mineGrid }),
  restoreSession: (session) => set({
    gamePhase: 'active',
    sessionId: session.sessionId,
    revealed: session.revealed,
    tilesRevealed: session.tilesRevealed,
    multiplier: session.multiplier,
    mineCount: session.mineCount,
    betAmount: session.betAmount,
    result: null,
    mineGrid: null,
  }),
  resetToConfig: () => set({ gamePhase: 'betting', sessionId: null, revealed: [], tilesRevealed: 0, multiplier: 1.0, result: null, mineGrid: null }),
  toggleMute: () => set((s) => {
    const next = !s.isMuted;
    localStorage.setItem('isMuted_mines', String(next));
    return { isMuted: next };
  }),
}));
