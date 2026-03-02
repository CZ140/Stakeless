import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

const betSchema = z.object({
  betAmount: z
    .number()
    .int('Bet must be a whole number')
    .min(1, 'Minimum bet is 1 coin'),
  gameType: z.string().min(1).max(50).optional().default('coin_flip'),
});

// validateBet middleware — validates req.body before any balance operation.
// On failure: returns 400 with the first validation error message.
// On success: sets req.body to the parsed/defaulted data and calls next().
// Satisfies GINF-05: bets outside range (< 1) rejected before touching balance.
export function validateBet(req: Request, res: Response, next: NextFunction): void {
  const result = betSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.issues[0]?.message ?? 'Invalid bet parameters',
    });
    return;
  }
  req.body = result.data;
  next();
}
