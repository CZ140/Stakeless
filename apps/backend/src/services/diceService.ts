import { randomInt } from 'node:crypto';
import { DICE, diceMultiplier, type DiceDirection } from '@gambling/shared';

// Roll a value in 0.00–99.99 (two-decimal precision) using a crypto-secure RNG,
// matching the rest of the platform (Roulette/Plinko/Mines all use crypto.randomInt).
export function rollDice(): number {
  return randomInt(0, DICE.RESOLUTION) / 100;
}

export interface DiceOutcome {
  win: boolean;
  multiplier: number; // payout multiplier (2-dp), house edge already applied
}

// Resolve a roll against the player's target + direction. The multiplier is the
// shared one (single source of truth), so a win pays floor(bet * multiplier).
export function resolveDice(roll: number, target: number, direction: DiceDirection): DiceOutcome {
  const tt = Math.round(target * 100);
  const rollH = Math.round(roll * 100);
  const win = direction === 'under' ? rollH < tt : rollH >= tt;
  return { win, multiplier: diceMultiplier(target, direction) };
}
