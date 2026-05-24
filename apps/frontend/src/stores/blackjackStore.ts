import { create } from 'zustand';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { suit: Suit; rank: Rank; }

export type BJGamePhase = 'betting' | 'player_turn' | 'settled';
export type HandStatus = 'playing' | 'stand' | 'bust' | 'blackjack';
export type BJOutcome =
  | 'player_blackjack' | 'player_bust' | 'dealer_bust'
  | 'player_win' | 'dealer_win' | 'push' | null;

export interface BJHandView {
  cards: Card[];
  bet: number;
  value: number;
  status: HandStatus;
  isDoubled: boolean;
  splitAce: boolean;
  outcome: BJOutcome;
  profit: number | null;
}

export interface DealerView {
  upCard: Card | null;
  hand: Card[] | null; // full hand once settled
  value: number | null;
}

// The session view returned by the backend (deal / action / active-session).
export interface BJSessionView {
  sessionId: number;
  phase: 'player_turn' | 'dealer_turn' | 'settled';
  activeHandIndex: number;
  hands: BJHandView[];
  dealer: DealerView;
  canSplit: boolean;
  canDouble: boolean;
  newBalance?: number;
}

const MAX_PREDEAL_HANDS = 3;

interface BlackjackState {
  // Betting config
  betAmount: number;
  handCount: number; // pre-deal hands, 1..MAX_PREDEAL_HANDS

  // Live session
  phase: BJGamePhase;
  sessionId: number | null;
  hands: BJHandView[];
  activeHandIndex: number;
  dealer: DealerView;
  canSplit: boolean;
  canDouble: boolean;

  isMuted: boolean;

  // Actions
  setBetAmount: (n: number) => void;
  incHands: () => void;
  decHands: () => void;
  applyView: (view: BJSessionView) => void;
  reset: () => void;
  toggleMute: () => void;
}

const emptyDealer: DealerView = { upCard: null, hand: null, value: null };

export const useBlackjackStore = create<BlackjackState>()((set) => ({
  betAmount: Number(localStorage.getItem('lastBet_blackjack')) || 10,
  handCount: 1,

  phase: 'betting',
  sessionId: null,
  hands: [],
  activeHandIndex: 0,
  dealer: emptyDealer,
  canSplit: false,
  canDouble: false,

  isMuted: localStorage.getItem('isMuted_blackjack') === 'true',

  setBetAmount: (n) => set({ betAmount: Math.max(1, Math.floor(n)) }),
  incHands: () => set((s) => ({ handCount: Math.min(MAX_PREDEAL_HANDS, s.handCount + 1) })),
  decHands: () => set((s) => ({ handCount: Math.max(1, s.handCount - 1) })),

  applyView: (view) =>
    set({
      phase: view.phase === 'settled' ? 'settled' : 'player_turn',
      sessionId: view.sessionId,
      hands: view.hands,
      activeHandIndex: view.activeHandIndex,
      dealer: view.dealer,
      canSplit: view.canSplit,
      canDouble: view.canDouble,
    }),

  reset: () =>
    set({
      phase: 'betting',
      sessionId: null,
      hands: [],
      activeHandIndex: 0,
      dealer: emptyDealer,
      canSplit: false,
      canDouble: false,
    }),

  toggleMute: () =>
    set((s) => {
      const next = !s.isMuted;
      localStorage.setItem('isMuted_blackjack', String(next));
      return { isMuted: next };
    }),
}));
