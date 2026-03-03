import { create } from 'zustand';

export type BetZone =
  | 'red' | 'black' | 'odd' | 'even'
  | 'dozen_1' | 'dozen_2' | 'dozen_3'
  | 'col_1' | 'col_2' | 'col_3'
  | `number_${number}`;

export interface PlacedChip {
  zone: BetZone;
  amount: number;
}

export type GamePhase = 'betting' | 'spinning' | 'result';
export type PocketColor = 'red' | 'black' | 'green';

export interface HistoryEntry {
  pocket: number;
  color: PocketColor;
}

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export function getPocketColor(pocket: number): PocketColor {
  if (pocket === 0) return 'green';
  return RED_NUMBERS.has(pocket) ? 'red' : 'black';
}

interface RouletteState {
  selectedChip: number;
  placedChips: PlacedChip[];
  gamePhase: GamePhase;
  isMuted: boolean;
  history: HistoryEntry[];
  // Actions
  setSelectedChip: (amount: number) => void;
  placeChip: (zone: BetZone) => void;
  undoLast: () => void;
  clearAll: () => void;
  halfBet: () => void;
  doubleBet: () => void;
  rebet: (chips: PlacedChip[]) => void;
  setGamePhase: (phase: GamePhase) => void;
  toggleMute: () => void;
  addToHistory: (pocket: number) => void;
}

export const useRouletteStore = create<RouletteState>()((set) => ({
  selectedChip: Number(localStorage.getItem('selectedChip_roulette')) || 10,
  placedChips: [],
  gamePhase: 'betting',
  isMuted: localStorage.getItem('isMuted_roulette') === 'true',
  history: [],
  setSelectedChip: (amount) => {
    localStorage.setItem('selectedChip_roulette', String(amount));
    set({ selectedChip: amount });
  },
  placeChip: (zone) => set((s) => ({
    placedChips: [...s.placedChips, { zone, amount: s.selectedChip }],
  })),
  undoLast: () => set((s) => ({ placedChips: s.placedChips.slice(0, -1) })),
  clearAll: () => set({ placedChips: [] }),
  halfBet: () => set((s) => ({
    placedChips: s.placedChips.map((c) => ({ ...c, amount: Math.max(1, Math.floor(c.amount / 2)) })),
  })),
  doubleBet: () => set((s) => ({
    placedChips: s.placedChips.map((c) => ({ ...c, amount: c.amount * 2 })),
  })),
  rebet: (chips) => set({ placedChips: chips }),
  setGamePhase: (phase) => set({ gamePhase: phase }),
  toggleMute: () => set((s) => {
    const next = !s.isMuted;
    localStorage.setItem('isMuted_roulette', String(next));
    return { isMuted: next };
  }),
  addToHistory: (pocket) => set((s) => {
    const entry: HistoryEntry = { pocket, color: getPocketColor(pocket) };
    // Keep last 30 entries, newest first
    return { history: [entry, ...s.history].slice(0, 30) };
  }),
}));
