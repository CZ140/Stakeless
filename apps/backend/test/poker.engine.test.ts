// Pure tests for the shared poker engine (hand evaluator, betting math, side
// pots). No DB. Lives in the backend suite because @gambling/shared has no test
// runner of its own (its game math is likewise covered here).
import { describe, it, expect } from 'vitest';
import {
  cardFromString,
  freshDeck,
  rank5,
  evaluateHand,
  compareHands,
  HAND_CATEGORY,
  handCategoryName,
  legalActions,
  buildPots,
  awardPots,
  type Card,
} from '@gambling/shared';

const h = (s: string): Card[] => s.split(' ').map(cardFromString);
const cat = (s: string) => rank5(h(s)).category;

describe('freshDeck', () => {
  it('has 52 unique cards', () => {
    const d = freshDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d.map((c) => `${c.rank}-${c.suit}`)).size).toBe(52);
  });
});

describe('rank5 — categories', () => {
  it('classifies every category', () => {
    expect(cat('As Ks Qs Js Ts')).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
    expect(cat('9h 9c 9s 9d 2c')).toBe(HAND_CATEGORY.QUADS);
    expect(cat('Kh Kc Ks 4d 4c')).toBe(HAND_CATEGORY.FULL_HOUSE);
    expect(cat('Ah Th 7h 4h 2h')).toBe(HAND_CATEGORY.FLUSH);
    expect(cat('9h 8c 7s 6d 5c')).toBe(HAND_CATEGORY.STRAIGHT);
    expect(cat('Qh Qc Qs 9d 2c')).toBe(HAND_CATEGORY.TRIPS);
    expect(cat('Jh Jc 4s 4d 9c')).toBe(HAND_CATEGORY.TWO_PAIR);
    expect(cat('8h 8c Ks 4d 2c')).toBe(HAND_CATEGORY.PAIR);
    expect(cat('Ah Jc 9s 5d 2c')).toBe(HAND_CATEGORY.HIGH_CARD);
  });

  it('treats the wheel A-2-3-4-5 as a 5-high straight, below a 6-high straight', () => {
    expect(cat('Ah 5c 4s 3d 2c')).toBe(HAND_CATEGORY.STRAIGHT);
    const wheel = h('Ah 5c 4s 3d 2c');
    const sixHigh = h('6h 5c 4s 3d 2c');
    expect(compareHands(sixHigh, wheel)).toBe(1);
    // The wheel must NOT read as ace-high.
    const aceHighStraight = h('Ah Kc Qs Jd Tc');
    expect(compareHands(aceHighStraight, wheel)).toBe(1);
  });

  it('the wheel straight flush is the weakest straight flush', () => {
    expect(cat('Ah 5h 4h 3h 2h')).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
    expect(compareHands(h('6h 5h 4h 3h 2h'), h('Ah 5h 4h 3h 2h'))).toBe(1);
  });
});

describe('rank5 — ordering and kickers', () => {
  it('orders categories correctly', () => {
    expect(compareHands(h('2c 2d 2h 2s 3c'), h('Ah Ac Ad Kh Ks'))).toBe(1); // quads > full house
    expect(compareHands(h('2c 3c 4c 5c 7c'), h('Ah Kc Qs Jd Tc'))).toBe(1); // flush > straight
    expect(compareHands(h('Ah Ac Ad 2h 3s'), h('Kh Kc 2d 2s 3c'))).toBe(1); // trips > two pair
  });

  it('breaks ties on kickers', () => {
    // Both a pair of kings; ace kicker beats queen kicker.
    expect(compareHands(h('Kh Kc Ah 5d 2c'), h('Ks Kd Qh 5s 2h'))).toBe(1);
    // Identical hands tie.
    expect(compareHands(h('Kh Kc Ah 5d 2c'), h('Ks Kd As 5h 2s'))).toBe(0);
    // Two pair: higher top pair wins regardless of low pair.
    expect(compareHands(h('Ah Ac 2d 2s 9c'), h('Kh Kc Qd Qs Ac'))).toBe(1);
  });

  it('full house compares trips first then the pair', () => {
    expect(compareHands(h('9h 9c 9s 2d 2c'), h('8h 8c 8s Ad Ac'))).toBe(1);
    expect(compareHands(h('9h 9c 9s Ad Ac'), h('9h 9c 9s 2d 2c'))).toBe(1);
  });
});

describe('evaluateHand — 7-card best-of', () => {
  it('finds the best 5 of 7', () => {
    // Board pair + pocket pair makes a full house using 7 cards.
    expect(evaluateHand(h('Ah Ac Kh Kc Kd 2s 3d')).category).toBe(HAND_CATEGORY.FULL_HOUSE);
    // A flush hidden in 7 cards.
    expect(evaluateHand(h('Ah 2h 9h 4c Kh 7h 8s')).category).toBe(HAND_CATEGORY.FLUSH);
    // A wheel using a low ace among high cards.
    expect(evaluateHand(h('Ah 2c 3d 4s 5h Kd Qc')).category).toBe(HAND_CATEGORY.STRAIGHT);
  });

  it('handCategoryName labels correctly', () => {
    expect(handCategoryName(HAND_CATEGORY.STRAIGHT_FLUSH)).toBe('Straight Flush');
    expect(handCategoryName(HAND_CATEGORY.TWO_PAIR)).toBe('Two Pair');
  });
});

describe('legalActions — no-limit betting math', () => {
  const bb = 10;

  it('lets you check when nothing is owed', () => {
    const la = legalActions({ stack: 1000, currentBet: 0, committedThisStreet: 0, minRaise: bb, bigBlind: bb });
    expect(la.canCheck).toBe(true);
    expect(la.canCall).toBe(false);
    expect(la.canRaise).toBe(true);
    expect(la.minRaiseTo).toBe(10); // bet at least one big blind
  });

  it('computes the call amount and min full-raise facing a bet', () => {
    // Facing a raise to 30, having already put in the BB of 10.
    const la = legalActions({ stack: 1000, currentBet: 30, committedThisStreet: 10, minRaise: 20, bigBlind: bb });
    expect(la.canCheck).toBe(false);
    expect(la.callAmount).toBe(20); // 30 - 10
    expect(la.minRaiseTo).toBe(50); // currentBet 30 + last raise 20
    expect(la.maxRaiseTo).toBe(1010); // shove = committed 10 + stack 1000
  });

  it('caps a call at the stack (all-in call) and forbids raising when short', () => {
    const la = legalActions({ stack: 15, currentBet: 100, committedThisStreet: 0, minRaise: 50, bigBlind: bb });
    expect(la.callAmount).toBe(15); // all-in for less
    expect(la.canRaise).toBe(false);
  });

  it('allows a short all-in raise below a full raise', () => {
    // Stack only reaches 40 total this street, less than a full raise to 50.
    const la = legalActions({ stack: 30, currentBet: 30, committedThisStreet: 10, minRaise: 20, bigBlind: bb });
    expect(la.maxRaiseTo).toBe(40);
    expect(la.minRaiseTo).toBe(40); // clamped to the shove
    expect(la.canRaise).toBe(true);
  });
});

describe('buildPots — side pots', () => {
  it('makes one pot when everyone matched', () => {
    const pots = buildPots([
      { seat: 0, committed: 100, folded: false },
      { seat: 1, committed: 100, folded: false },
      { seat: 2, committed: 100, folded: true },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0]!.amount).toBe(300);
    expect(pots[0]!.eligibleSeats.sort()).toEqual([0, 1]); // folded seat funds but can't win
  });

  it('builds a main + side pot for unequal all-ins', () => {
    // Seat0 all-in 50, seat1 and seat2 put in 200 each.
    const pots = buildPots([
      { seat: 0, committed: 50, folded: false },
      { seat: 1, committed: 200, folded: false },
      { seat: 2, committed: 200, folded: false },
    ]);
    // Main pot 50*3 = 150 (all three eligible); side pot 150*2 = 300 (seats 1,2).
    expect(pots).toHaveLength(2);
    expect(pots[0]!.amount).toBe(150);
    expect(pots[0]!.eligibleSeats.sort()).toEqual([0, 1, 2]);
    expect(pots[1]!.amount).toBe(300);
    expect(pots[1]!.eligibleSeats.sort()).toEqual([1, 2]);
  });
});

describe('awardPots', () => {
  it('awards the whole pot to the best hand', () => {
    const pots = [{ amount: 300, eligibleSeats: [0, 1] }];
    const scores = new Map([
      [0, evaluateHand(h('Ah Ac Kh Kc Kd 2s 3d')).score],
      [1, evaluateHand(h('Ah 2h 9h 4c Kh 7h 8s')).score],
    ]);
    const w = awardPots(pots, scores);
    expect(w.get(0)).toBe(300); // full house beats flush
    expect(w.get(1)).toBeUndefined();
  });

  it('splits a tied pot and assigns the odd chip by order', () => {
    const pots = [{ amount: 101, eligibleSeats: [0, 1] }];
    const scores = new Map([
      [0, evaluateHand(h('Ah Ac Kh Qh Jd 2s 3d')).score],
      [1, evaluateHand(h('As Ad Ks Qs Jc 2h 3h')).score],
    ]); // identical pair of aces, K-Q-J kickers → tie
    const w = awardPots(pots, scores, [1, 0]);
    expect(w.get(0)).toBe(50);
    expect(w.get(1)).toBe(51); // odd chip to seat 1 (first in order)
  });

  it('awards a side pot independently of the main pot', () => {
    // Seat 0 (short all-in) wins the main; seat 1 wins the side.
    const pots = [
      { amount: 150, eligibleSeats: [0, 1, 2] },
      { amount: 300, eligibleSeats: [1, 2] },
    ];
    const scores = new Map([
      [0, evaluateHand(h('Ah Ac Ad As Kd 2s 3d')).score], // quad aces — best
      [1, evaluateHand(h('Kh Kc Ks Kd Qd 2h 3h')).score], // quad kings
      [2, evaluateHand(h('2h 2c 7s 9d Jd 4s 5d')).score], // pair
    ]);
    const w = awardPots(pots, scores);
    expect(w.get(0)).toBe(150); // wins main only (not eligible for side)
    expect(w.get(1)).toBe(300); // wins side pot
    expect(w.get(2)).toBeUndefined();
  });
});
