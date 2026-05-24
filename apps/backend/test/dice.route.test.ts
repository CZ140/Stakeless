import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { diceMultiplier, diceWinChance } from '@gambling/shared';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { gameLogs } from '../src/db/schema.js';
import { resetDb, createUser, getBalance } from './helpers.js';

const app = createApp();

function bearer(path: string, token: string) {
  return request(app).post(path).set('Authorization', `Bearer ${token}`);
}

describe('POST /api/games/dice/bet — money path', () => {
  beforeEach(resetDb);

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/games/dice/bet')
      .send({ betAmount: 10, target: 50, direction: 'under' });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid bet shape with 400', async () => {
    const { token } = await createUser();
    const res = await bearer('/api/games/dice/bet', token).send({ betAmount: 10, direction: 'under' });
    expect(res.status).toBe(400);
  });

  it('rejects a target whose win chance is out of range with 400', async () => {
    const { token } = await createUser();
    // under 99 → 99% win chance (above the 95% cap)
    const tooLikely = await bearer('/api/games/dice/bet', token).send({ betAmount: 10, target: 99, direction: 'under' });
    expect(tooLikely.status).toBe(400);
    // under 1 → 1% win chance (below the 2% floor)
    const tooRare = await bearer('/api/games/dice/bet', token).send({ betAmount: 10, target: 1, direction: 'under' });
    expect(tooRare.status).toBe(400);
  });

  it('rejects a bet larger than the balance with 402', async () => {
    const { token } = await createUser({ balance: 50 });
    const res = await bearer('/api/games/dice/bet', token).send({ betAmount: 100, target: 50, direction: 'under' });
    expect(res.status).toBe(402);
  });

  it('settles to a balance consistent with the reported outcome', async () => {
    const { user, token } = await createUser({ balance: 1000 });
    const betAmount = 100;
    const target = 50;
    const direction = 'under' as const;

    const res = await bearer('/api/games/dice/bet', token).send({ betAmount, target, direction });
    expect(res.status).toBe(200);

    const body = res.body as {
      roll: number; win: boolean; multiplier: number; winChance: number; profit: number; newBalance: number;
    };

    // Odds/multiplier match the shared math.
    expect(body.multiplier).toBe(diceMultiplier(target, direction));
    expect(body.winChance).toBeCloseTo(diceWinChance(target, direction), 10);

    // Net profit is exactly the win payout or the lost stake.
    const expectedProfit = body.win ? Math.floor(betAmount * body.multiplier) - betAmount : -betAmount;
    expect(body.profit).toBe(expectedProfit);
    expect(body.newBalance).toBe(1000 + expectedProfit);

    // The DB is the source of truth and agrees with the response.
    expect(await getBalance(user.id)).toBe(body.newBalance);

    // The round was logged.
    const logs = await db.select().from(gameLogs).where(eq(gameLogs.userId, user.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.gameType).toBe('dice');
  });

  it('honours the win when it lands (roll-under 95 ≈ 95% to win)', async () => {
    // Not deterministic, but over a handful of high-chance bets at least one win
    // proves the credit path; each bet independently keeps the balance invariant.
    const { user, token } = await createUser({ balance: 100_000 });
    let sawWin = false;
    let expectedBalance = 100_000;
    for (let i = 0; i < 12 && !sawWin; i++) {
      const res = await bearer('/api/games/dice/bet', token).send({ betAmount: 100, target: 95, direction: 'under' });
      expect(res.status).toBe(200);
      expectedBalance += res.body.profit as number;
      if (res.body.win) sawWin = true;
      expect(await getBalance(user.id)).toBe(expectedBalance);
    }
    expect(sawWin).toBe(true);
  });
});
