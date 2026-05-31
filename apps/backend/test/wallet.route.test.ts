import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetDb, createUser, getBalance } from './helpers.js';

const app = createApp();

function bearer(path: string, token: string) {
  return request(app).post(path).set('Authorization', `Bearer ${token}`);
}

const HOUR = 60 * 60 * 1000;

// ─── Daily bonus + streak ───────────────────────────────────────────────────
describe('POST /api/wallet/bonus — tier bonus + consecutive-day streak', () => {
  beforeEach(resetDb);

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/wallet/bonus');
    expect(res.status).toBe(401);
  });

  it('credits the base tier bonus at streak 1 on a first claim', async () => {
    const { user, token } = await createUser({ balance: 1000, totalWagered: 0 });
    const res = await bearer('/api/wallet/bonus', token);
    expect(res.status).toBe(200);
    const body = res.body as { amount: number; streak: number; newBalance: number };
    expect(body.streak).toBe(1);
    expect(body.amount).toBe(100); // Bronze base × 1
    expect(body.newBalance).toBe(1100);
    expect(await getBalance(user.id)).toBe(1100);
  });

  it('advances the streak and scales the bonus when claimed on time', async () => {
    // Claimed 25h ago (cooldown elapsed, still inside the 48h streak window) at day 3.
    const { user, token } = await createUser({
      balance: 1000,
      totalWagered: 0,
      bonusStreak: 3,
      lastBonusClaimedAt: new Date(Date.now() - 25 * HOUR),
    });
    const res = await bearer('/api/wallet/bonus', token);
    expect(res.status).toBe(200);
    const body = res.body as { amount: number; streak: number };
    expect(body.streak).toBe(4);
    expect(body.amount).toBe(400); // 100 base × 4
    expect(await getBalance(user.id)).toBe(1400);
  });

  it('caps the streak multiplier (day 8 still pays 7×)', async () => {
    const { token } = await createUser({
      balance: 0,
      totalWagered: 0,
      bonusStreak: 7,
      lastBonusClaimedAt: new Date(Date.now() - 25 * HOUR),
    });
    const res = await bearer('/api/wallet/bonus', token);
    const body = res.body as { amount: number; streak: number };
    expect(body.streak).toBe(8);
    expect(body.amount).toBe(700); // 100 base × min(8, 7)
  });

  it('resets the streak to 1 when a claim lapses past the reset window', async () => {
    const { token } = await createUser({
      balance: 0,
      totalWagered: 0,
      bonusStreak: 5,
      lastBonusClaimedAt: new Date(Date.now() - 49 * HOUR), // > 48h → streak dead
    });
    const res = await bearer('/api/wallet/bonus', token);
    const body = res.body as { amount: number; streak: number };
    expect(body.streak).toBe(1);
    expect(body.amount).toBe(100);
  });

  it('rejects a claim still inside the 24h cooldown with 429', async () => {
    const { token } = await createUser({
      lastBonusClaimedAt: new Date(Date.now() - 1 * HOUR),
    });
    const res = await bearer('/api/wallet/bonus', token);
    expect(res.status).toBe(429);
    expect((res.body as { msUntilNext: number }).msUntilNext).toBeGreaterThan(0);
  });
});

// ─── Rakeback ─────────────────────────────────────────────────────────────────
describe('POST /api/wallet/rakeback — wager-based cashback', () => {
  beforeEach(resetDb);

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/wallet/rakeback');
    expect(res.status).toBe(401);
  });

  it('returns 409 when no wager has accrued', async () => {
    const { token } = await createUser({ totalWagered: 0 });
    const res = await bearer('/api/wallet/rakeback', token);
    expect(res.status).toBe(409);
  });

  it('credits 1% of accrued wager and advances the watermark so it can only be claimed once', async () => {
    const { user, token } = await createUser({ balance: 1000, totalWagered: 10_000 });

    const first = await bearer('/api/wallet/rakeback', token);
    expect(first.status).toBe(200);
    const body = first.body as { amount: number; newBalance: number };
    expect(body.amount).toBe(100); // floor(10000 × 0.01)
    expect(body.newBalance).toBe(1100);
    expect(await getBalance(user.id)).toBe(1100);

    // Nothing new wagered since → second claim has nothing to give.
    const second = await bearer('/api/wallet/rakeback', token);
    expect(second.status).toBe(409);
    expect(await getBalance(user.id)).toBe(1100);
  });
});
