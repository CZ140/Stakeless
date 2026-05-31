import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { adminLogs } from '../src/db/schema.js';
import { resetDb, createUser, getBalance } from './helpers.js';

const app = createApp();

function bearer(path: string, token: string) {
  return request(app).post(path).set('Authorization', `Bearer ${token}`);
}

describe('POST /api/admin/players/:id/grant — admin balance grant', () => {
  beforeEach(resetDb);

  it('rejects unauthenticated requests with 401', async () => {
    const { user } = await createUser();
    const res = await request(app).post(`/api/admin/players/${user.id}/grant`).send({ amount: 100 });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const { token } = await createUser({ role: 'player' });
    const { user: target } = await createUser();
    const res = await bearer(`/api/admin/players/${target.id}/grant`, token).send({ amount: 100 });
    expect(res.status).toBe(403);
  });

  it('lets an admin top up a player and writes an audit log row', async () => {
    const { user: admin, token } = await createUser({ role: 'admin' });
    const { user: target } = await createUser({ balance: 1000 });

    const res = await bearer(`/api/admin/players/${target.id}/grant`, token).send({ amount: 5000 });
    expect(res.status).toBe(200);
    expect((res.body as { newBalance: number }).newBalance).toBe(6000);
    expect(await getBalance(target.id)).toBe(6000);

    const logs = await db.select().from(adminLogs).where(eq(adminLogs.adminId, admin.id));
    const grant = logs.find((l) => l.action === 'grant_balance');
    expect(grant).toBeDefined();
    expect(grant!.targetUserId).toBe(target.id);
  });

  it('claws back with a negative amount, clamped so balance never goes negative', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: target } = await createUser({ balance: 1000 });

    const res = await bearer(`/api/admin/players/${target.id}/grant`, token).send({ amount: -999_999 });
    expect(res.status).toBe(200);
    expect((res.body as { newBalance: number }).newBalance).toBe(0);
    expect(await getBalance(target.id)).toBe(0);
  });

  it('rejects invalid amounts with 400', async () => {
    const { token } = await createUser({ role: 'admin' });
    const { user: target } = await createUser({ balance: 1000 });

    for (const amount of [0, 2.5, 2_000_000, -2_000_000, 'abc']) {
      const res = await bearer(`/api/admin/players/${target.id}/grant`, token).send({ amount });
      expect(res.status).toBe(400);
    }
    // Balance untouched by any rejected request.
    expect(await getBalance(target.id)).toBe(1000);
  });

  it('returns 404 when the target player does not exist', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await bearer('/api/admin/players/999999/grant', token).send({ amount: 100 });
    expect(res.status).toBe(404);
  });
});
