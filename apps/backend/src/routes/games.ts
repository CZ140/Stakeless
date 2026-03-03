import { Router, type IRouter } from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { deductBet, settleBet } from '../services/walletService.js';
import { resolveRouletteBets } from '../services/rouletteService.js';

export const gamesRouter: IRouter = Router();

// European wheel pocket sequence (clockwise from 12 o'clock, pocket 0 at top)
const WHEEL_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20,
  14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const betZoneSchema = z.union([
  z.literal('red'),
  z.literal('black'),
  z.literal('odd'),
  z.literal('even'),
  z.literal('dozen_1'),
  z.literal('dozen_2'),
  z.literal('dozen_3'),
  z.literal('col_1'),
  z.literal('col_2'),
  z.literal('col_3'),
  z.string().regex(/^number_([0-9]|[12][0-9]|3[0-6])$/, 'Invalid number bet zone'),
]);

const rouletteBetSchema = z.object({
  bets: z
    .array(z.object({ zone: betZoneSchema, amount: z.number().int().min(1) }))
    .min(1, 'At least one bet required')
    .max(50, 'Too many simultaneous bets'),
});

// POST /api/games/roulette/bet
// Pipeline: validate bets → deduct total → crypto.randomInt(0,37) → resolve → settle → log
// Returns 200 { winningPocket, profit, newBalance }
// Returns 400 on invalid bet shape/zone
// Returns 402 on INSUFFICIENT_FUNDS
// Returns 500 on unexpected error
gamesRouter.post('/roulette/bet', requireAuth, async (req, res) => {
  const parsed = rouletteBetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid bets' });
    return;
  }

  const userId = req.user!.id;
  const { bets } = parsed.data;
  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

  try {
    // Deduct total bet atomically before resolution (GINF-01)
    await deductBet(userId, totalBet, 'roulette');

    // Resolve outcome — crypto.randomInt(0, 37) selects pocket index (GINF-02, ROUL-01)
    const winningPocketIndex = randomInt(0, 37);
    const winningPocket = WHEEL_SEQUENCE[winningPocketIndex]!;

    // Calculate net profit from all placed bets
    const profit = resolveRouletteBets(winningPocket, bets);

    // Settle and log — outcome is pocket number string only (varchar 50 limit) (GINF-03, GINF-04)
    const { newBalance } = await settleBet(
      userId,
      profit,
      totalBet,
      String(winningPocket),
      'roulette',
    );

    res.json({ winningPocket, profit, newBalance });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'INSUFFICIENT_FUNDS') {
      res.status(402).json({ error: 'Insufficient funds' });
      return;
    }
    if (code === 'BET_TOO_SMALL') {
      res.status(400).json({ error: 'Bet amount too small' });
      return;
    }
    console.error('[games] roulette bet error:', err);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});
