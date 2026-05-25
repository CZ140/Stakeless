import { describe, it, expect } from 'vitest';
import { cardFromString, type Card } from '@gambling/shared';
import { PokerTable, type TableConfig } from './table.js';

const cfg: TableConfig = { id: 1, name: 'Test', smallBlind: 5, bigBlind: 10, maxSeats: 6 };

function makeTable(stacks: number[]): PokerTable {
  const t = new PokerTable({ ...cfg });
  stacks.forEach((stack, i) => t.seatPlayer(i, { userId: i + 1, username: `p${i}`, avatarColor: null, isBot: false, stack }));
  return t;
}

const deck = (cards: string): Card[] => cards.split(' ').map(cardFromString);

// Total chips across all seats — conserved across a completed hand (rake = 0).
function totalChips(t: PokerTable): number {
  return t.occupiedSeats().reduce((sum, s) => sum + s.stack, 0);
}

// Auto-play passively: the acting seat checks if it can, else calls, until the
// hand reaches showdown (or a guard trips).
function playPassive(t: PokerTable): void {
  for (let guard = 0; guard < 100; guard++) {
    if (t.actingIndex === null) return;
    const seat = t.actingIndex;
    const la = t.legalFor(seat);
    t.applyAction(seat, la.canCheck ? { type: 'check' } : { type: 'call' });
  }
  throw new Error('playPassive did not terminate');
}

describe('PokerTable — hand setup', () => {
  it('posts blinds, deals two cards each, and sets the first actor (3-handed)', () => {
    const t = makeTable([1000, 1000, 1000]);
    expect(t.startHand()).toBe(true);
    const st = t.toPublicState();
    expect(st.street).toBe('preflop');
    expect(st.buttonIndex).toBe(0);
    // SB=1 posts 5, BB=2 posts 10.
    expect(st.seats[1]!.committedThisStreet).toBe(5);
    expect(st.seats[2]!.committedThisStreet).toBe(10);
    // Each dealt player holds two hole cards.
    for (let i = 0; i < 3; i++) expect(t.privateHandFor(i + 1)!.holeCards).toHaveLength(2);
    // UTG (seat after BB) acts first.
    expect(st.actingSeat).toBe(0);
    expect(st.board).toHaveLength(0);
    expect(totalChips(t)).toBe(2985); // 3000 minus the 15 in posted blinds
  });

  it('heads-up: the button is the small blind and acts first preflop', () => {
    const t = makeTable([1000, 1000]);
    t.startHand();
    const st = t.toPublicState();
    expect(st.buttonIndex).toBe(0);
    expect(st.seats[0]!.committedThisStreet).toBe(5); // button posts SB
    expect(st.seats[1]!.committedThisStreet).toBe(10); // other posts BB
    expect(st.actingSeat).toBe(0); // SB/button acts first preflop heads-up
  });

  it('refuses to start with fewer than two funded players', () => {
    const t = makeTable([1000]);
    expect(t.canStartHand()).toBe(false);
    expect(t.startHand()).toBe(false);
  });
});

describe('PokerTable — uncontested pot', () => {
  it('awards the blinds to the last player standing when everyone folds', () => {
    const t = makeTable([1000, 1000, 1000]);
    t.startHand();
    // UTG(0) folds, SB(1) folds → BB(2) wins uncontested.
    t.applyAction(0, { type: 'fold' });
    t.applyAction(1, { type: 'fold' });
    const st = t.toPublicState();
    expect(st.street).toBe('showdown');
    expect(t.lastResult!.showdown).toBe(false);
    expect(t.lastResult!.winners).toEqual([2]);
    expect(st.seats[2]!.stack).toBe(1005); // 1000 - 10 BB + 15 pot
    expect(st.seats[1]!.stack).toBe(995); // lost the SB
    expect(totalChips(t)).toBe(3000);
  });
});

describe('PokerTable — showdown', () => {
  it('runs out the board and awards the pot to the best hand', () => {
    // Deal order (button=0, SB=1, BB=2; deal starts at SB clockwise 1,2,0 twice):
    //   seat1: deck[0],deck[3]   seat2: deck[1],deck[4]   seat0: deck[2],deck[5]
    //   board: deck[6..10]
    // Give seat0 trip aces (As Ah + Ad on board); seats 1/2 junk.
    const d = deck('2c 4d As 3c 5d Ah Ad Kc Qh 7s 9c');
    const t = makeTable([1000, 1000, 1000]);
    t.startHand(d);
    playPassive(t); // everyone calls/checks down to showdown

    const st = t.toPublicState();
    expect(st.street).toBe('showdown');
    expect(st.board).toHaveLength(5);
    expect(t.lastResult!.showdown).toBe(true);
    expect(t.lastResult!.winners).toEqual([0]);
    // Each put in 10; pot 30; seat0 nets +20.
    expect(st.seats[0]!.stack).toBe(1020);
    expect(st.seats[0]!.revealedCards).toBeDefined(); // shown at showdown
    expect(totalChips(t)).toBe(3000);
  });
});

describe('PokerTable — raising', () => {
  it('a raise sets the current bet and min-raise and reopens the action', () => {
    const t = makeTable([1000, 1000, 1000]);
    t.startHand();
    // UTG(0) raises to 30.
    t.applyAction(0, { type: 'raise', amount: 30 });
    let st = t.toPublicState();
    expect(st.seats[0]!.committedThisStreet).toBe(30);
    expect(st.actingSeat).toBe(1); // action moves on
    const la1 = t.legalFor(1);
    expect(la1.callAmount).toBe(25); // SB has 5 in, owes 25
    expect(la1.minRaiseTo).toBe(50); // 30 + last raise size 20
    // SB(1) folds, BB(2) calls 20 more → heads-up to the flop.
    t.applyAction(1, { type: 'fold' });
    t.applyAction(2, { type: 'call' });
    st = t.toPublicState();
    expect(st.street).toBe('flop');
    expect(st.board).toHaveLength(3);
    // Play it out, then chips are conserved once the hand settles.
    playPassive(t);
    expect(t.toPublicState().street).toBe('showdown');
    expect(totalChips(t)).toBe(3000);
  });
});

describe('PokerTable — all-in run-out + side pot', () => {
  it('runs the board to the river when players are all-in and conserves chips', () => {
    const t = makeTable([40, 1000, 1000]);
    t.startHand();
    // UTG(0, the short stack) shoves; SB(1) calls; BB(2) calls.
    const la0 = t.legalFor(0);
    t.applyAction(0, { type: 'raise', amount: la0.maxRaiseTo }); // all-in 40
    expect(t.toPublicState().seats[0]!.status).toBe('allin');
    // SB and BB just call the 40.
    t.applyAction(1, { type: 'call' });
    t.applyAction(2, { type: 'call' });
    // Now seats 1 & 2 are not all-in; they may still bet the side pot. Check it down.
    playPassive(t);
    const st = t.toPublicState();
    expect(st.street).toBe('showdown');
    expect(st.board).toHaveLength(5);
    expect(totalChips(t)).toBe(2040); // 40 + 1000 + 1000, conserved
  });
});
