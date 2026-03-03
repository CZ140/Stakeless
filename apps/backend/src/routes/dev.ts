import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export const devRouter: IRouter = Router();

// POST /api/dev/add-balance
// Dev-only endpoint — adds coins to the authenticated user's balance.
// Body: { amount?: number } — defaults to 1000.
devRouter.post('/add-balance', requireAuth, async (req, res) => {
  const amount = Number((req.body as { amount?: unknown }).amount ?? 1000);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    res.status(400).json({ error: 'amount must be a positive number ≤ 1,000,000' });
    return;
  }

  const [updated] = await db
    .update(users)
    .set({ balance: sql`${users.balance} + ${amount}` })
    .where(eq(users.id, req.user!.id))
    .returning({ newBalance: users.balance });

  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ newBalance: updated.newBalance, added: amount });
});
