import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { gameLogs } from '../src/db/schema.js';
import { resetDb, createUser, getBalance } from './helpers.js';

const app = createApp();

interface Card { rank: number; suit: string }

function auth(method: 'post' | 'get', path: string, token: string) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

// The statistically safer call for a base card: HIGHER when more ranks sit above
// it, else LOWER. Always a playable direction.
function saferDir(rank: number): 'hi' | 'lo' {
  return 14 - rank >= rank - 2 ? 'hi' : 'lo';
}

describe('Hi-Lo routes — money path', () => {
  beforeEach(resetDb);

  it('rejects unauthenticated start', async () => {
    const res = await request(app).post('/api/games/hilo/start').send({ betAmount: 10 });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid bet shape with 400', async () => {
    const { token } = await createUser();
    const res = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects a bet larger than the balance with 402', async () => {
    const { token } = await createUser({ balance: 50 });
    const res = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
    expect(res.status).toBe(402);
  });

  it('starts a round, deducting the bet and revealing the base card', async () => {
    const { user, token } = await createUser({ balance: 1000 });
    const res = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
    expect(res.status).toBe(200);
    const body = res.body as { sessionId: number; currentCard: Card; streak: number; multiplier: number };
    expect(body.sessionId).toBeGreaterThan(0);
    expect(body.currentCard.rank).toBeGreaterThanOrEqual(2);
    expect(body.currentCard.rank).toBeLessThanOrEqual(14);
    expect(body.streak).toBe(0);
    expect(body.multiplier).toBe(1);
    expect(await getBalance(user.id)).toBe(900); // stake deducted up front
  });

  it('rejects a second concurrent round with 409', async () => {
    const { token } = await createUser({ balance: 1000 });
    await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
    const dup = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
    expect(dup.status).toBe(409);
  });

  it('refuses to cash out before any guess', async () => {
    const { token } = await createUser({ balance: 1000 });
    const start = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
    const res = await auth('post', '/api/games/hilo/cashout', token).send({ sessionId: start.body.sessionId });
    expect(res.status).toBe(400);
  });

  it('settles a cash-out consistent with the cumulative multiplier', async () => {
    // Retry rounds until one correct guess lands, then cash out and check invariants.
    const { user, token } = await createUser({ balance: 1_000_000 });
    let cashedOut = false;

    for (let attempt = 0; attempt < 40 && !cashedOut; attempt++) {
      const before = await getBalance(user.id);
      const start = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
      expect(start.status).toBe(200);
      const sessionId = start.body.sessionId as number;
      const card = start.body.currentCard as Card;
      expect(await getBalance(user.id)).toBe(before - 100);

      const guess = await auth('post', '/api/games/hilo/guess', token).send({ sessionId, direction: saferDir(card.rank) });
      expect(guess.status).toBe(200);

      if (guess.body.busted) {
        // Lost the stake; balance unchanged from post-deduct.
        expect(await getBalance(user.id)).toBe(before - 100);
        continue;
      }

      // A correct guess — cash out and verify the payout math.
      const cash = await auth('post', '/api/games/hilo/cashout', token).send({ sessionId });
      expect(cash.status).toBe(200);
      const { payout, newBalance, multiplier, streak } = cash.body as {
        payout: number; newBalance: number; multiplier: number; streak: number;
      };
      expect(streak).toBe(1);
      expect(payout).toBe(Math.floor(100 * multiplier));
      expect(newBalance).toBe(before - 100 + payout);
      expect(await getBalance(user.id)).toBe(newBalance);

      const logs = await db.select().from(gameLogs).where(eq(gameLogs.userId, user.id));
      expect(logs.some((l) => l.gameType === 'hilo')).toBe(true);
      cashedOut = true;
    }

    expect(cashedOut).toBe(true);
  });

  it('busts a round, settling a loss and closing the session', async () => {
    const { user, token } = await createUser({ balance: 1_000_000 });
    const before = await getBalance(user.id);
    const start = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
    const sessionId = start.body.sessionId as number;
    let card = start.body.currentCard as Card;

    // Keep guessing the safer side until the ladder busts (each step < 100%).
    let busted = false;
    for (let i = 0; i < 500 && !busted; i++) {
      const guess = await auth('post', '/api/games/hilo/guess', token).send({ sessionId, direction: saferDir(card.rank) });
      expect(guess.status).toBe(200);
      if (guess.body.busted) busted = true;
      else card = guess.body.nextCard as Card;
    }
    expect(busted).toBe(true);

    // No credit on a bust; balance stays at the post-deduct amount.
    expect(await getBalance(user.id)).toBe(before - 100);

    // The session is closed — resume returns nothing.
    const active = await auth('get', '/api/games/hilo/active-session', token).send();
    expect(active.body.session).toBeNull();

    const logs = await db.select().from(gameLogs).where(eq(gameLogs.userId, user.id));
    expect(logs.some((l) => l.gameType === 'hilo')).toBe(true);
  });

  it('resumes an open round via active-session', async () => {
    const { token } = await createUser({ balance: 1000 });
    const start = await auth('post', '/api/games/hilo/start', token).send({ betAmount: 100 });
    const sessionId = start.body.sessionId as number;

    const active = await auth('get', '/api/games/hilo/active-session', token).send();
    expect(active.status).toBe(200);
    expect(active.body.session.sessionId).toBe(sessionId);
    expect(active.body.session.currentCard).toEqual(start.body.currentCard);
    expect(active.body.session.betAmount).toBe(100);
    expect(active.body.session.streak).toBe(0);
  });
});
