import { randomInt } from 'node:crypto';
import { freshDeck, type Card } from '@gambling/shared';

// Crypto-secure Fisher–Yates shuffle (matches the RNG approach in the other game
// services). The shuffle lives backend-only — the shared poker module is RNG-free.
export function shuffledDeck(): Card[] {
  const d = freshDeck();
  for (let i = d.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const tmp = d[i]!;
    d[i] = d[j]!;
    d[j] = tmp;
  }
  return d;
}
