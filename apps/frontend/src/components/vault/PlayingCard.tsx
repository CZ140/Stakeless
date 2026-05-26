import type { Card } from '@gambling/shared';

const SUIT_SYMBOL = ['♣', '♦', '♥', '♠'];
const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

// A single playing card (Refined Vault). `size`: 'sm' (lobby/history), 'md'
// (board/seats, the default) or 'lg' (your hole cards). Pass no card for a
// face-down back. Rank sits top-left with a small suit; a large suit anchors the
// bottom-right corner.
export function PlayingCard({ card, size = 'md' }: { card?: Card | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeCls = size === 'sm' ? ' sm' : size === 'lg' ? ' lg' : '';
  if (!card) return <span className={`pkr-card back${sizeCls}`} aria-hidden="true" />;
  const red = card.suit === 1 || card.suit === 2; // diamonds / hearts
  const glyph = SUIT_SYMBOL[card.suit];
  return (
    <span className={`pkr-card${sizeCls} ${red ? 'red' : 'black'}`}>
      <span className="rank">{RANK_LABEL[card.rank]}</span>
      <span className="suit-sm">{glyph}</span>
      <span className="suit-lg">{glyph}</span>
    </span>
  );
}
