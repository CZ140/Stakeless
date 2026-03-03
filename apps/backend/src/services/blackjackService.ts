import { randomInt } from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Card {
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
}

export interface BlackjackSessionState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[]; // dealerHand[1] is face-down until dealer turn
  phase: 'player_turn' | 'dealer_turn' | 'settled';
  outcome:
    | 'player_blackjack'
    | 'player_bust'
    | 'dealer_bust'
    | 'player_win'
    | 'dealer_win'
    | 'push'
    | null;
  isDoubled: boolean;
}

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

  // Fisher-Yates shuffle — crypto.randomInt ensures unbiased randomness
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
// Aces start as 11, reduced to 1 if hand would bust.
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

  // Reduce aces from 11 to 1 to avoid busting
  let softAces = aceCount; // aces currently counting as 11
  while (value > 21 && softAces > 0) {
    value -= 10;
    softAces--;
  }

  // isSoft = true if any ace is still counting as 11
  const isSoft = softAces > 0;

  return { value, isSoft };
}

// ─── isBlackjack ──────────────────────────────────────────────────────────────
// Returns true if the hand is a natural blackjack (exactly 2 cards summing to 21).
export function isBlackjack(hand: Card[]): boolean {
  if (hand.length !== 2) return false;
  const { value } = calculateHandValue(hand);
  return value === 21;
}

// ─── dealerPlay ───────────────────────────────────────────────────────────────
// Dealer draws cards until: value >= 17 AND NOT soft 17.
// i.e. stands on hard 17+, stands on soft 18+, hits on soft 17 (A+6).
// Returns a NEW state object (does not mutate input).
export function dealerPlay(state: BlackjackSessionState): BlackjackSessionState {
  // Deep copy to avoid mutating the caller's state
  const newState: BlackjackSessionState = {
    ...state,
    deck: [...state.deck],
    dealerHand: [...state.dealerHand],
  };

  while (true) {
    const { value, isSoft } = calculateHandValue(newState.dealerHand);

    // Dealer stands on hard 17+, and on soft 18+
    // Dealer hits on soft 17 (value === 17 AND isSoft)
    if (value >= 17 && !(isSoft && value === 17)) {
      break;
    }

    // Draw next card from deck
    const card = newState.deck.shift();
    if (!card) break; // No cards left (safety guard)
    newState.dealerHand.push(card);
  }

  return newState;
}

// ─── getOutcome ───────────────────────────────────────────────────────────────
// Determines the hand outcome after both player and dealer have finished.
// Priority: player_blackjack → player_bust → dealer_bust → compare values
export function getOutcome(
  playerHand: Card[],
  dealerHand: Card[],
): 'player_blackjack' | 'player_bust' | 'dealer_bust' | 'player_win' | 'dealer_win' | 'push' {
  const playerResult = calculateHandValue(playerHand);
  const dealerResult = calculateHandValue(dealerHand);

  const playerIsBlackjack = isBlackjack(playerHand);
  const dealerIsBlackjack = isBlackjack(dealerHand);

  // Natural blackjack check — push if dealer also has blackjack
  if (playerIsBlackjack) {
    if (dealerIsBlackjack) return 'push';
    return 'player_blackjack';
  }

  // Player bust (loses regardless of dealer)
  if (playerResult.value > 21) return 'player_bust';

  // Dealer bust (player wins)
  if (dealerResult.value > 21) return 'dealer_bust';

  // Compare values (both <= 21)
  if (playerResult.value > dealerResult.value) return 'player_win';
  if (dealerResult.value > playerResult.value) return 'dealer_win';
  return 'push';
}

// ─── computeProfit ────────────────────────────────────────────────────────────
// Calculates profit to pass to settleBet.
// deductBet already removed the stake, so profit is what gets credited back.
//
// Blackjack (3:2): stake + 1.5× bonus
//   bet=100 → profit=150 → net +50 for player (e.g. 900 → 1050)
// Regular win (1:1): stake returned
//   bet=100 → profit=100 → net 0 (e.g. 900 → 1000)
// Push: stake returned
//   bet=100 → profit=100 → net 0
// Loss/bust: nothing credited
//   bet=100 → profit=0 → net -100
export function computeProfit(outcome: string, betAmount: number): number {
  switch (outcome) {
    case 'player_blackjack':
      // 3:2 payout: stake back + 1.5x bonus (floor for odd amounts)
      return betAmount + Math.floor(betAmount * 0.5);
    case 'player_win':
    case 'dealer_bust':
    case 'push':
      // 1:1 payout: stake returned
      return betAmount;
    case 'player_bust':
    case 'dealer_win':
    default:
      // Loss: nothing credited
      return 0;
  }
}
