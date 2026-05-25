import type { Card } from '@gambling/shared';

const SUIT_SYMBOL = ['♣', '♦', '♥', '♠'];
const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

// A single playing card. `size`: 'sm' (board/seats) or 'lg' (your hole cards).
// Pass no card to render a face-down back.
export function PlayingCard({ card, size = 'sm' }: { card?: Card | null; size?: 'sm' | 'lg' }) {
  if (!card) return <span className={`pkr-card back ${size}`} aria-hidden="true" />;
  const red = card.suit === 1 || card.suit === 2; // diamonds / hearts
  return (
    <span className={`pkr-card ${size}${red ? ' red' : ''}`}>
      <span className="pkr-card-rank">{RANK_LABEL[card.rank]}</span>
      <span className="pkr-card-suit">{SUIT_SYMBOL[card.suit]}</span>
    </span>
  );
}
