import { create } from 'zustand';
import { diceTargetBounds, type DiceDirection } from '@gambling/shared';

export interface DiceResult {
  roll: number;
  win: boolean;
  multiplier: number;
  profit: number;
  target: number;
  direction: DiceDirection;
}

// Clamp the target into the valid band for the current direction (integer steps).
function clampTarget(target: number, direction: DiceDirection): number {
  const { min, max } = diceTargetBounds(direction);
  return Math.min(max, Math.max(min, Math.round(target)));
}

interface DiceState {
  betAmount: number;
  target: number; // 0–100 threshold the roll is compared against
  direction: DiceDirection;
  isMuted: boolean;
  rolling: boolean;
  lastResult: DiceResult | null;
  setBetAmount: (n: number) => void;
  setTarget: (n: number) => void;
  setDirection: (d: DiceDirection) => void;
  toggleMute: () => void;
  setRolling: (b: boolean) => void;
  setLastResult: (r: DiceResult | null) => void;
}

export const useDiceStore = create<DiceState>()((set) => ({
  betAmount: Number(localStorage.getItem('lastBet_dice')) || 10,
  target: 50,
  direction: 'under',
  isMuted: localStorage.getItem('isMuted_dice') === 'true',
  rolling: false,
  lastResult: null,
  setBetAmount: (n) => set({ betAmount: Math.max(1, Math.floor(n)) }),
  setTarget: (n) => set((s) => ({ target: clampTarget(n, s.direction) })),
  // Switching direction re-clamps the target so the win chance stays in range.
  setDirection: (d) => set((s) => ({ direction: d, target: clampTarget(s.target, d) })),
  toggleMute: () =>
    set((s) => {
      const next = !s.isMuted;
      localStorage.setItem('isMuted_dice', String(next));
      return { isMuted: next };
    }),
  setRolling: (b) => set({ rolling: b }),
  setLastResult: (r) => set({ lastResult: r }),
}));
