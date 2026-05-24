import { describe, it, expect } from 'vitest';
import {
  createDeck,
  calculateHandValue,
  isBlackjack,
  dealerPlay,
  getOutcome,
  computeProfit,
  startGame,
  playerHit,
  playerStand,
  playerDouble,
  playerSplit,
  canSplit,
  canDouble,
  settle,
  MAX_HANDS,
  type Card,
  type BJHand,
  type BlackjackSessionState,
} from './blackjackService.js';

const card = (rank: Card['rank'], suit: Card['suit'] = 'spades'): Card => ({ suit, rank });

function makeHand(cards: Card[], bet = 100, over: Partial<BJHand> = {}): BJHand {
  return {
    cards,
    bet,
    status: 'playing',
    isDoubled: false,
    fromSplit: false,
    splitAce: false,
    outcome: null,
    profit: null,
    ...over,
  };
}

function makeState(hands: BJHand[], deck: Card[], dealerHand: Card[]): BlackjackSessionState {
  return { deck, hands, activeHandIndex: 0, dealerHand, phase: 'player_turn' };
}

// ─── createDeck ──────────────────────────────────────────────────────────────

describe('createDeck', () => {
  it('returns 52 unique cards across 4 suits and 13 ranks', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => `${c.suit}-${c.rank}`)).size).toBe(52);
    expect(new Set(deck.map((c) => c.suit)).size).toBe(4);
    expect(new Set(deck.map((c) => c.rank)).size).toBe(13);
  });

  it('produces different orderings on repeated calls', () => {
    const a = createDeck().map((c) => `${c.suit}-${c.rank}`).join(',');
    const b = createDeck().map((c) => `${c.suit}-${c.rank}`).join(',');
    expect(a).not.toBe(b);
  });
});

// ─── calculateHandValue ───────────────────────────────────────────────────────

describe('calculateHandValue', () => {
  it('A + K → 21 soft', () => expect(calculateHandValue([card('A'), card('K')])).toEqual({ value: 21, isSoft: true }));
  it('A + A → 12 soft', () => expect(calculateHandValue([card('A'), card('A')])).toEqual({ value: 12, isSoft: true }));
  it('A + K + 5 → 16 hard', () => expect(calculateHandValue([card('A'), card('K'), card('5')])).toEqual({ value: 16, isSoft: false }));
  it('A + 6 → 17 soft', () => expect(calculateHandValue([card('A'), card('6')])).toEqual({ value: 17, isSoft: true }));
  it('Q + K → 20 hard', () => expect(calculateHandValue([card('Q'), card('K')])).toEqual({ value: 20, isSoft: false }));
});

// ─── isBlackjack ──────────────────────────────────────────────────────────────

describe('isBlackjack', () => {
  it('A + K → true', () => expect(isBlackjack([card('A'), card('K')])).toBe(true));
  it('A + K + 2 → false (3 cards)', () => expect(isBlackjack([card('A'), card('K'), card('2')])).toBe(false));
  it('10 + J → false (no ace)', () => expect(isBlackjack([card('10'), card('J')])).toBe(false));
});

// ─── dealerPlay (dealerHand, deck) ──────────────────────────────────────────────

describe('dealerPlay', () => {
  it('stands on hard 17 — draws nothing', () => {
    const { dealerHand } = dealerPlay([card('10'), card('7')], [card('5'), card('6')]);
    expect(dealerHand).toHaveLength(2);
    expect(calculateHandValue(dealerHand).value).toBe(17);
  });

  it('hits soft 17 (A+6)', () => {
    const { dealerHand } = dealerPlay([card('A'), card('6')], [card('2'), card('K')]);
    expect(dealerHand.length).toBeGreaterThan(2);
  });

  it('stands on soft 18 (A+7)', () => {
    const { dealerHand } = dealerPlay([card('A'), card('7')], [card('2'), card('K')]);
    expect(dealerHand).toHaveLength(2);
  });

  it('hits hard 16 and can bust', () => {
    const { dealerHand } = dealerPlay([card('10'), card('6')], [card('K')]);
    expect(calculateHandValue(dealerHand).value).toBe(26);
  });

  it('does not mutate inputs', () => {
    const hand = [card('10'), card('6')];
    const deck = [card('5')];
    dealerPlay(hand, deck);
    expect(hand).toHaveLength(2);
    expect(deck).toHaveLength(1);
  });
});

// ─── getOutcome ─────────────────────────────────────────────────────────────────

describe('getOutcome', () => {
  it('player natural beats dealer 20', () => expect(getOutcome([card('A'), card('K')], [card('10'), card('8')])).toBe('player_blackjack'));
  it('both natural → push', () => expect(getOutcome([card('A'), card('K')], [card('A'), card('Q')])).toBe('push'));
  it('dealer natural beats a hit 21 (playerNatural=false)', () =>
    expect(getOutcome([card('7'), card('7'), card('7')], [card('A'), card('K')], false)).toBe('dealer_win'));
  it('player bust', () => expect(getOutcome([card('10'), card('K'), card('5')], [card('10'), card('7')])).toBe('player_bust'));
  it('dealer bust → player wins', () => expect(getOutcome([card('10'), card('8')], [card('10'), card('K'), card('5')])).toBe('dealer_bust'));
  it('higher player wins', () => expect(getOutcome([card('10'), card('K')], [card('10'), card('9')])).toBe('player_win'));
  it('equal → push', () => expect(getOutcome([card('10'), card('K')], [card('10'), card('Q')])).toBe('push'));
});

// ─── computeProfit (corrected payouts) ──────────────────────────────────────────

describe('computeProfit', () => {
  it('blackjack 3:2 → stake + 1.5×: bet 100 → 250', () => expect(computeProfit('player_blackjack', 100)).toBe(250));
  it('blackjack 3:2 floors odd: bet 101 → 101 + 151 = 252', () => expect(computeProfit('player_blackjack', 101)).toBe(252));
  it('win 1:1 → 2×: bet 100 → 200', () => expect(computeProfit('player_win', 100)).toBe(200));
  it('dealer_bust 1:1 → 2×: bet 100 → 200', () => expect(computeProfit('dealer_bust', 100)).toBe(200));
  it('push → stake back: bet 100 → 100', () => expect(computeProfit('push', 100)).toBe(100));
  it('dealer_win → 0', () => expect(computeProfit('dealer_win', 100)).toBe(0));
  it('player_bust → 0', () => expect(computeProfit('player_bust', 100)).toBe(0));
});

// ─── startGame ───────────────────────────────────────────────────────────────────

describe('startGame', () => {
  it('deals 2 cards to each hand and 2 to the dealer', () => {
    const state = startGame([100, 50]);
    expect(state.hands).toHaveLength(2);
    expect(state.hands[0]!.cards).toHaveLength(2);
    expect(state.hands[1]!.cards).toHaveLength(2);
    expect(state.dealerHand).toHaveLength(2);
    expect(state.hands[0]!.bet).toBe(100);
    expect(state.hands[1]!.bet).toBe(50);
  });

  it('first playable hand is active', () => {
    const state = startGame([10]);
    // single hand: either player_turn with active 0, or dealer_turn if it was a natural
    if (state.phase === 'player_turn') expect(state.activeHandIndex).toBe(0);
    else expect(state.hands[0]!.status).toBe('blackjack');
  });
});

// ─── player actions (deterministic via rigged deck) ──────────────────────────────

describe('player actions', () => {
  it('hit adds a card; bust marks the hand and advances', () => {
    const state = makeState([makeHand([card('10'), card('6')])], [card('K')], [card('9'), card('5')]);
    playerHit(state);
    expect(state.hands[0]!.cards).toHaveLength(3);
    expect(state.hands[0]!.status).toBe('bust');
    expect(state.phase).toBe('dealer_turn'); // only hand finished
  });

  it('auto-stands a hand that hits exactly 21', () => {
    const state = makeState([makeHand([card('10'), card('5')])], [card('6')], [card('9'), card('5')]);
    playerHit(state);
    expect(state.hands[0]!.status).toBe('stand');
    expect(calculateHandValue(state.hands[0]!.cards).value).toBe(21);
  });

  it('stand finishes the hand', () => {
    const state = makeState([makeHand([card('10'), card('8')])], [], [card('9'), card('5')]);
    playerStand(state);
    expect(state.hands[0]!.status).toBe('stand');
    expect(state.phase).toBe('dealer_turn');
  });

  it('double draws exactly one card, marks doubled, stands', () => {
    const state = makeState([makeHand([card('5'), card('6')])], [card('9')], [card('9'), card('5')]);
    expect(canDouble(state)).toBe(true);
    playerDouble(state);
    expect(state.hands[0]!.cards).toHaveLength(3);
    expect(state.hands[0]!.isDoubled).toBe(true);
    expect(state.hands[0]!.status).toBe('stand');
  });
});

// ─── split ───────────────────────────────────────────────────────────────────────

describe('split', () => {
  it('canSplit only for equal-rank 2-card hands under the hand cap', () => {
    expect(canSplit(makeState([makeHand([card('8'), card('8')])], [card('2'), card('3')], [card('9'), card('5')]))).toBe(true);
    expect(canSplit(makeState([makeHand([card('8'), card('9')])], [card('2')], [card('9'), card('5')]))).toBe(false);
    // 10 and K are both value 10 → splittable (standard casino)
    expect(canSplit(makeState([makeHand([card('10'), card('K')])], [card('2'), card('3')], [card('9'), card('5')]))).toBe(true);
  });

  it('split makes two hands, each drawing a second card', () => {
    const state = makeState([makeHand([card('8'), card('8')])], [card('3'), card('2')], [card('9'), card('5')]);
    playerSplit(state);
    expect(state.hands).toHaveLength(2);
    expect(state.hands[0]!.cards).toEqual([card('8'), card('3')]);
    expect(state.hands[1]!.cards).toEqual([card('8'), card('2')]);
    expect(state.hands.every((h) => h.fromSplit)).toBe(true);
    expect(state.activeHandIndex).toBe(0);
  });

  it('split aces draw one card each and auto-stand; cannot resplit aces', () => {
    const state = makeState([makeHand([card('A'), card('A')])], [card('9'), card('5')], [card('9'), card('5')]);
    playerSplit(state);
    expect(state.hands).toHaveLength(2);
    expect(state.hands[0]!.splitAce).toBe(true);
    expect(state.hands[0]!.status).toBe('stand');
    expect(state.hands[1]!.status).toBe('stand');
    expect(state.phase).toBe('dealer_turn'); // both auto-stood
  });

  it('respects MAX_HANDS', () => {
    const hands = Array.from({ length: MAX_HANDS }, () => makeHand([card('8'), card('8')]));
    const state = makeState(hands, [card('2'), card('3')], [card('9'), card('5')]);
    expect(canSplit(state)).toBe(false);
  });
});

// ─── settle (multi-hand) ──────────────────────────────────────────────────────────

describe('settle', () => {
  it('resolves each hand independently vs one dealer hand', () => {
    // Hand A: 20 (wins vs dealer 17). Hand B: bust. Dealer: 10+7 = 17, stands.
    const handA = makeHand([card('10'), card('K')], 100, { status: 'stand' });
    const handB = makeHand([card('10'), card('K'), card('5')], 50, { status: 'bust' });
    const state: BlackjackSessionState = {
      deck: [],
      hands: [handA, handB],
      activeHandIndex: 2,
      dealerHand: [card('10'), card('7')],
      phase: 'dealer_turn',
    };
    settle(state);
    expect(state.phase).toBe('settled');
    expect(state.hands[0]!.outcome).toBe('player_win');
    expect(state.hands[0]!.profit).toBe(200); // 1:1 on bet 100
    expect(state.hands[1]!.outcome).toBe('player_bust');
    expect(state.hands[1]!.profit).toBe(0);
  });

  it('a 2-card 21 that is NOT a natural (split) pays 1:1, not 3:2', () => {
    const hand = makeHand([card('A'), card('K')], 100, { status: 'stand', fromSplit: true });
    const state: BlackjackSessionState = {
      deck: [],
      hands: [hand],
      activeHandIndex: 1,
      dealerHand: [card('10'), card('9')], // 19, stands
      phase: 'dealer_turn',
    };
    settle(state);
    expect(state.hands[0]!.outcome).toBe('player_win');
    expect(state.hands[0]!.profit).toBe(200); // 1:1 — split 21 is not a blackjack
  });

  it('natural blackjack hand pays 3:2', () => {
    const hand = makeHand([card('A'), card('K')], 100, { status: 'blackjack' });
    const state: BlackjackSessionState = {
      deck: [],
      hands: [hand],
      activeHandIndex: 1,
      dealerHand: [card('10'), card('9')],
      phase: 'dealer_turn',
    };
    settle(state);
    expect(state.hands[0]!.outcome).toBe('player_blackjack');
    expect(state.hands[0]!.profit).toBe(250); // 3:2
  });

  it('doubled hand settles on the doubled stake', () => {
    const hand = makeHand([card('5'), card('6'), card('9')], 100, { status: 'stand', isDoubled: true }); // 20
    const state: BlackjackSessionState = {
      deck: [],
      hands: [hand],
      activeHandIndex: 1,
      dealerHand: [card('10'), card('7')], // 17
      phase: 'dealer_turn',
    };
    settle(state);
    expect(state.hands[0]!.outcome).toBe('player_win');
    expect(state.hands[0]!.profit).toBe(400); // 1:1 on doubled bet (effectiveBet 200 → 2×)
  });

  it('does not draw for the dealer when every hand busted', () => {
    const hand = makeHand([card('10'), card('K'), card('5')], 100, { status: 'bust' });
    const state: BlackjackSessionState = {
      deck: [card('2'), card('3')],
      hands: [hand],
      activeHandIndex: 1,
      dealerHand: [card('10'), card('6')], // 16 — would normally hit, but all busted
      phase: 'dealer_turn',
    };
    settle(state);
    expect(state.dealerHand).toHaveLength(2); // dealer did not draw
    expect(state.hands[0]!.outcome).toBe('player_bust');
  });
});
