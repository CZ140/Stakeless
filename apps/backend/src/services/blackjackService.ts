import { randomInt } from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Card {
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
}

export type BJOutcome =
  | 'player_blackjack'
  | 'player_bust'
  | 'dealer_bust'
  | 'player_win'
  | 'dealer_win'
  | 'push';

// A single player hand. The table can hold several (pre-deal multi-hand and/or
// hands created by splitting). `status` drives the turn state machine:
//   playing    — the active hand can still act
//   stand      — finished, compare vs dealer at settle
//   bust       — finished, lost
//   blackjack  — natural 21 (initial 2-card, NOT from a split) → pays 3:2
export type HandStatus = 'playing' | 'stand' | 'bust' | 'blackjack';

export interface BJHand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  isDoubled: boolean;
  fromSplit: boolean;
  splitAce: boolean; // a hand created by splitting aces — gets exactly one card
  outcome: BJOutcome | null; // set at settlement
  profit: number | null; // gross credited at settlement (stake + winnings)
}

export interface BlackjackSessionState {
  deck: Card[];
  hands: BJHand[];
  activeHandIndex: number; // index into hands of the hand currently in play
  dealerHand: Card[]; // dealerHand[1] is face-down until the dealer turn
  phase: 'player_turn' | 'dealer_turn' | 'settled';
}

// Maximum number of player hands on the table at once (pre-deal hands + splits).
export const MAX_HANDS = 4;
export const MAX_PREDEAL_HANDS = 3;

// ─── Constants ────────────────────────────────────────────────────────────────

const SUITS: Card['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ─── createDeck ───────────────────────────────────────────────────────────────
// Returns a shuffled 52-card deck using Fisher-Yates with crypto.randomInt (GINF-02).
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const temp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = temp;
  }

  return deck;
}

// ─── calculateHandValue ───────────────────────────────────────────────────────
// Returns { value, isSoft } where isSoft=true if any ace counts as 11.
export function calculateHandValue(hand: Card[]): { value: number; isSoft: boolean } {
  let value = 0;
  let aceCount = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aceCount++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }

  let softAces = aceCount;
  while (value > 21 && softAces > 0) {
    value -= 10;
    softAces--;
  }

  return { value, isSoft: softAces > 0 };
}

// ─── isBlackjack ──────────────────────────────────────────────────────────────
// True for a natural blackjack: exactly 2 cards summing to 21.
export function isBlackjack(hand: Card[]): boolean {
  if (hand.length !== 2) return false;
  return calculateHandValue(hand).value === 21;
}

// Blackjack value of a single rank (used for split-pair matching).
function rankValue(rank: Card['rank']): number {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K', '10'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

// ─── dealerPlay ───────────────────────────────────────────────────────────────
// Dealer draws until value >= 17 AND not soft 17 (hits soft 17). Pure: returns a
// new dealer hand + remaining deck, never mutates inputs.
export function dealerPlay(
  dealerHand: Card[],
  deck: Card[],
): { dealerHand: Card[]; deck: Card[] } {
  const hand = [...dealerHand];
  const rest = [...deck];

  while (true) {
    const { value, isSoft } = calculateHandValue(hand);
    if (value >= 17 && !(isSoft && value === 17)) break;
    const card = rest.shift();
    if (!card) break;
    hand.push(card);
  }

  return { dealerHand: hand, deck: rest };
}

// ─── getOutcome ───────────────────────────────────────────────────────────────
// Compares a finished (non-bust) player hand against the dealer hand.
// `playerNatural` distinguishes an initial 2-card blackjack (pays 3:2) from a
// 21 made by hitting or from a split — split 21s are NOT naturals.
export function getOutcome(
  playerHand: Card[],
  dealerHand: Card[],
  playerNatural = isBlackjack(playerHand),
): BJOutcome {
  const dealerNatural = isBlackjack(dealerHand);
  const playerValue = calculateHandValue(playerHand).value;
  const dealerValue = calculateHandValue(dealerHand).value;

  if (playerValue > 21) return 'player_bust';

  // Naturals resolve first.
  if (playerNatural || dealerNatural) {
    if (playerNatural && dealerNatural) return 'push';
    if (playerNatural) return 'player_blackjack';
    return 'dealer_win'; // dealer natural beats any non-natural (even a hit 21)
  }

  if (dealerValue > 21) return 'dealer_bust';
  if (playerValue > dealerValue) return 'player_win';
  if (dealerValue > playerValue) return 'dealer_win';
  return 'push';
}

// ─── computeProfit ────────────────────────────────────────────────────────────
// Gross amount credited back via settleBet. deductBet already removed the stake,
// so this is stake + winnings:
//   blackjack (3:2): stake + 1.5×        → net +1.5× bet
//   win (1:1):       stake + 1×  (= 2×)  → net +1× bet
//   push:            stake               → net 0
//   loss/bust:       nothing             → net -bet
export function computeProfit(outcome: BJOutcome | string, betAmount: number): number {
  switch (outcome) {
    case 'player_blackjack':
      return betAmount + Math.floor(betAmount * 1.5);
    case 'player_win':
    case 'dealer_bust':
      return betAmount * 2;
    case 'push':
      return betAmount;
    case 'player_bust':
    case 'dealer_win':
    default:
      return 0;
  }
}

// ─── Multi-hand engine ──────────────────────────────────────────────────────────

function newHand(cards: Card[], bet: number, fromSplit: boolean, splitAce: boolean): BJHand {
  return { cards, bet, status: 'playing', isDoubled: false, fromSplit, splitAce, outcome: null, profit: null };
}

// Auto-finish a hand the player can no longer (or need not) act on: bust at >21,
// auto-stand at 21, split-ace hands stand after their single card.
function autoResolveHand(hand: BJHand): void {
  if (hand.status !== 'playing') return;
  const { value } = calculateHandValue(hand.cards);
  if (value > 21) hand.status = 'bust';
  else if (value === 21) hand.status = 'stand';
  else if (hand.splitAce && hand.cards.length >= 2) hand.status = 'stand';
}

// Move activeHandIndex to the next hand still 'playing'. If none remain, the
// player turn is over → dealer_turn.
function advance(state: BlackjackSessionState): void {
  for (let i = state.activeHandIndex; i < state.hands.length; i++) {
    if (state.hands[i]!.status === 'playing') {
      state.activeHandIndex = i;
      return;
    }
  }
  state.phase = 'dealer_turn';
}

// ─── startGame ──────────────────────────────────────────────────────────────────
// Deals two cards to each player hand and to the dealer. Marks naturals and sets
// the first playable hand active (or dealer_turn if everyone has a natural).
export function startGame(bets: number[]): BlackjackSessionState {
  const deck = createDeck();
  const hands: BJHand[] = bets.map((bet) => newHand([], bet, false, false));

  // Deal in casino order: one card to each hand, then dealer, repeat.
  for (let round = 0; round < 2; round++) {
    for (const hand of hands) hand.cards.push(deck.shift()!);
  }
  const dealerHand = [deck.shift()!, deck.shift()!];

  for (const hand of hands) {
    if (isBlackjack(hand.cards)) hand.status = 'blackjack';
  }

  const state: BlackjackSessionState = {
    deck,
    hands,
    activeHandIndex: 0,
    dealerHand,
    phase: 'player_turn',
  };
  advance(state);
  return state;
}

// ─── Player actions ───────────────────────────────────────────────────────────
// Each mutates and returns `state`. Callers must already hold the active hand
// (state.phase === 'player_turn') and, for double/split, have deducted the extra
// stake. They auto-resolve the hand and advance the turn.

export function playerHit(state: BlackjackSessionState): BlackjackSessionState {
  const hand = state.hands[state.activeHandIndex]!;
  hand.cards.push(state.deck.shift()!);
  autoResolveHand(hand);
  advance(state);
  return state;
}

export function playerStand(state: BlackjackSessionState): BlackjackSessionState {
  state.hands[state.activeHandIndex]!.status = 'stand';
  advance(state);
  return state;
}

export function playerDouble(state: BlackjackSessionState): BlackjackSessionState {
  const hand = state.hands[state.activeHandIndex]!;
  hand.isDoubled = true;
  hand.cards.push(state.deck.shift()!);
  if (calculateHandValue(hand.cards).value > 21) hand.status = 'bust';
  else hand.status = 'stand'; // exactly one card on a double
  advance(state);
  return state;
}

export function playerSplit(state: BlackjackSessionState): BlackjackSessionState {
  const idx = state.activeHandIndex;
  const hand = state.hands[idx]!;
  const [c0, c1] = hand.cards as [Card, Card];
  const ace = c0.rank === 'A';

  const h1 = newHand([c0], hand.bet, true, ace);
  const h2 = newHand([c1], hand.bet, true, ace);
  // Each split hand immediately draws its second card.
  h1.cards.push(state.deck.shift()!);
  h2.cards.push(state.deck.shift()!);
  autoResolveHand(h1);
  autoResolveHand(h2);

  state.hands.splice(idx, 1, h1, h2);
  advance(state);
  return state;
}

// ─── Capability checks (for the active hand) ────────────────────────────────────

export function canSplit(state: BlackjackSessionState): boolean {
  if (state.phase !== 'player_turn') return false;
  const hand = state.hands[state.activeHandIndex];
  if (!hand || hand.status !== 'playing') return false;
  if (hand.cards.length !== 2) return false;
  if (hand.splitAce) return false; // never resplit aces
  if (state.hands.length >= MAX_HANDS) return false;
  return rankValue(hand.cards[0]!.rank) === rankValue(hand.cards[1]!.rank);
}

export function canDouble(state: BlackjackSessionState): boolean {
  if (state.phase !== 'player_turn') return false;
  const hand = state.hands[state.activeHandIndex];
  if (!hand || hand.status !== 'playing') return false;
  if (hand.splitAce) return false; // can't act on a one-card split ace
  return hand.cards.length === 2;
}

// ─── settle ───────────────────────────────────────────────────────────────────
// Plays the dealer (once, if any hand survived) and resolves every hand's outcome
// + gross profit. Returns the same state with phase 'settled'.
export function settle(state: BlackjackSessionState): BlackjackSessionState {
  const anyAlive = state.hands.some((h) => h.status !== 'bust');
  if (anyAlive) {
    const played = dealerPlay(state.dealerHand, state.deck);
    state.dealerHand = played.dealerHand;
    state.deck = played.deck;
  }

  for (const hand of state.hands) {
    const effectiveBet = hand.bet * (hand.isDoubled ? 2 : 1);
    let outcome: BJOutcome;
    if (hand.status === 'bust') {
      outcome = 'player_bust';
    } else {
      const playerNatural = hand.status === 'blackjack';
      outcome = getOutcome(hand.cards, state.dealerHand, playerNatural);
    }
    hand.outcome = outcome;
    hand.profit = computeProfit(outcome, effectiveBet);
  }

  state.phase = 'settled';
  return state;
}

// Sum of gross profit credited across all hands (for emitting one balance update).
export function totalProfit(state: BlackjackSessionState): number {
  return state.hands.reduce((sum, h) => sum + (h.profit ?? 0), 0);
}
