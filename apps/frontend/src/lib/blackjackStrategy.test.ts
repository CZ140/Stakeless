import { describe, it, expect } from 'vitest';
import { cardValue, handTotal, decideBlackjack } from './blackjackStrategy';
import type { Card, Rank } from '../stores/blackjackStore';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });

describe('cardValue / handTotal', () => {
  it('values face cards as 10 and aces as 11', () => {
    expect(cardValue('K')).toBe(10);
    expect(cardValue('10')).toBe(10);
    expect(cardValue('A')).toBe(11);
    expect(cardValue('7')).toBe(7);
  });

  it('counts a usable ace as soft', () => {
    expect(handTotal([c('A'), c('7')])).toEqual({ total: 18, soft: true });
  });

  it('demotes the ace to 1 when 11 would bust (hard hand)', () => {
    expect(handTotal([c('A'), c('7'), c('K')])).toEqual({ total: 18, soft: false });
    expect(handTotal([c('K'), c('6')])).toEqual({ total: 16, soft: false });
  });
});

describe('decideBlackjack — hard totals', () => {
  it('hits hard 16 vs dealer 10', () => {
    expect(decideBlackjack([c('10'), c('6')], c('10'), false, false)).toBe('hit');
  });
  it('stands hard 13 vs dealer 6', () => {
    expect(decideBlackjack([c('9'), c('4')], c('6'), false, false)).toBe('stand');
  });
  it('stands on 17+', () => {
    expect(decideBlackjack([c('10'), c('7')], c('A'), true, false)).toBe('stand');
  });
  it('doubles 11 when allowed, hits when not', () => {
    expect(decideBlackjack([c('6'), c('5')], c('10'), true, false)).toBe('double');
    expect(decideBlackjack([c('6'), c('5')], c('10'), false, false)).toBe('hit');
  });
  it('doubles 9 vs 3-6 only', () => {
    expect(decideBlackjack([c('5'), c('4')], c('4'), true, false)).toBe('double');
    expect(decideBlackjack([c('5'), c('4')], c('7'), true, false)).toBe('hit');
  });
});

describe('decideBlackjack — soft totals', () => {
  it('A,7 vs 9 hits; vs 7 stands; vs 5 doubles', () => {
    expect(decideBlackjack([c('A'), c('7')], c('9'), true, false)).toBe('hit');
    expect(decideBlackjack([c('A'), c('7')], c('7'), true, false)).toBe('stand');
    expect(decideBlackjack([c('A'), c('7')], c('5'), true, false)).toBe('double');
  });
  it('A,7 vs 5 stands when doubling is not allowed', () => {
    expect(decideBlackjack([c('A'), c('7')], c('5'), false, false)).toBe('stand');
  });
});

describe('decideBlackjack — pairs', () => {
  it('always splits 8,8 and A,A', () => {
    expect(decideBlackjack([c('8'), c('8')], c('10'), false, true)).toBe('split');
    expect(decideBlackjack([c('A'), c('A')], c('A'), false, true)).toBe('split');
  });
  it('never splits 9,9 vs 7 (stands as hard 18)', () => {
    expect(decideBlackjack([c('9'), c('9')], c('7'), false, true)).toBe('stand');
  });
  it('never splits 5,5 — plays it as hard 10 (double vs 6)', () => {
    expect(decideBlackjack([c('5'), c('5')], c('6'), true, true)).toBe('double');
  });
  it('never splits 10,K (different rank) — stands as 20', () => {
    expect(decideBlackjack([c('10'), c('K')], c('6'), false, true)).toBe('stand');
  });
  it('falls back to total logic when splitting is not allowed', () => {
    expect(decideBlackjack([c('8'), c('8')], c('10'), false, false)).toBe('hit'); // hard 16 vs 10
  });
});
