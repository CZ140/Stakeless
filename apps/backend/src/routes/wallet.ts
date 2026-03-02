import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { claimDailyBonus } from '../services/walletService.js';

export const walletRouter: IRouter = Router();

// POST /api/wallet/bonus
// Requires a valid Bearer token (requireAuth middleware).
// Returns 200 { newBalance, nextClaimAt } on success.
// Returns 429 { error, msUntilNext } if the 24h cooldown has not elapsed.
// Returns 500 on unexpected errors.
walletRouter.post('/bonus', requireAuth, async (req, res) => {
  try {
    const { newBalance, nextClaimAt } = await claimDailyBonus(req.user!.id);
    res.json({ newBalance, nextClaimAt });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'BONUS_NOT_READY') {
      const msUntilNext = (err as { msUntilNext?: number }).msUntilNext;
      res.status(429).json({ error: 'Bonus not available yet', msUntilNext });
      return;
    }
    console.error('[wallet] bonus error:', err);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});
