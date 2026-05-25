import { create } from 'zustand';
import type { PublicTableState, PrivateHand, PokerHandResult, PokerTableSummary, Card } from '@gambling/shared';

// Poker UI state: the lobby list, the open table's public state, my private hole
// cards, and the most recent finished-hand result (shown briefly between hands).
interface PokerState {
  lobby: PokerTableSummary[];
  table: PublicTableState | null;
  myHole: Card[] | null; // my two hole cards (from poker:hand, private)
  mySeat: number | null;
  lastResult: PokerHandResult | null;

  setLobby: (lobby: PokerTableSummary[]) => void;
  setTable: (table: PublicTableState | null) => void;
  setHand: (hand: PrivateHand | null) => void;
  setResult: (result: PokerHandResult | null) => void;
  reset: () => void;
}

export const usePokerStore = create<PokerState>()((set) => ({
  lobby: [],
  table: null,
  myHole: null,
  mySeat: null,
  lastResult: null,

  setLobby: (lobby) => set({ lobby }),
  setTable: (table) => set({ table }),
  setHand: (hand) => set(hand ? { myHole: hand.holeCards, mySeat: hand.seatIndex } : { myHole: null, mySeat: null }),
  setResult: (lastResult) => set({ lastResult }),
  reset: () => set({ table: null, myHole: null, mySeat: null, lastResult: null }),
}));
