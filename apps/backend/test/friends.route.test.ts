import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetDb, createUser } from './helpers.js';

const app = createApp();

function auth(method: 'post' | 'get' | 'delete', path: string, token: string) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

describe('Friends routes', () => {
  beforeEach(resetDb);

  it('rejects unauthenticated access', async () => {
    expect((await request(app).get('/api/friends')).status).toBe(401);
    expect((await request(app).post('/api/friends/requests').send({ username: 'x' })).status).toBe(401);
  });

  it('sends a request that shows as outgoing for sender and incoming for target', async () => {
    const a = await createUser({ username: 'alice' });
    const b = await createUser({ username: 'bob' });

    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    expect(send.status).toBe(201);
    expect(send.body.status).toBe('requested');
    expect(send.body.request.direction).toBe('outgoing');
    expect(send.body.request.user.username).toBe('bob');

    const aReqs = await auth('get', '/api/friends/requests', a.token);
    expect(aReqs.body.outgoing).toHaveLength(1);
    expect(aReqs.body.incoming).toHaveLength(0);

    const bReqs = await auth('get', '/api/friends/requests', b.token);
    expect(bReqs.body.incoming).toHaveLength(1);
    expect(bReqs.body.incoming[0].user.username).toBe('alice');
  });

  it('refuses to friend yourself (400)', async () => {
    const a = await createUser({ username: 'alice' });
    const res = await auth('post', '/api/friends/requests', a.token).send({ username: 'alice' });
    expect(res.status).toBe(400);
  });

  it('404s an unknown username', async () => {
    const a = await createUser({ username: 'alice' });
    const res = await auth('post', '/api/friends/requests', a.token).send({ username: 'nobody_here' });
    expect(res.status).toBe(404);
  });

  it('rejects a duplicate pending request (409)', async () => {
    const a = await createUser({ username: 'alice' });
    await createUser({ username: 'bob' });
    await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    const dup = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    expect(dup.status).toBe(409);
  });

  it('auto-accepts when the target had already requested the sender (mutual intent)', async () => {
    const a = await createUser({ username: 'alice' });
    const b = await createUser({ username: 'bob' });

    await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' }); // A → B pending
    const reverse = await auth('post', '/api/friends/requests', b.token).send({ username: 'alice' }); // B → A
    expect(reverse.status).toBe(200);
    expect(reverse.body.status).toBe('accepted');
    expect(reverse.body.friend.username).toBe('alice');

    // Both now see each other as friends, no pending requests remain.
    const aFriends = await auth('get', '/api/friends', a.token);
    const bFriends = await auth('get', '/api/friends', b.token);
    expect(aFriends.body.friends.map((f: { username: string }) => f.username)).toEqual(['bob']);
    expect(bFriends.body.friends.map((f: { username: string }) => f.username)).toEqual(['alice']);
    expect((await auth('get', '/api/friends/requests', a.token)).body.outgoing).toHaveLength(0);
  });

  it('accepts an incoming request and makes both friends', async () => {
    const a = await createUser({ username: 'alice' });
    const b = await createUser({ username: 'bob' });
    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    const reqId = send.body.request.id as number;

    const accept = await auth('post', `/api/friends/requests/${reqId}/accept`, b.token).send();
    expect(accept.status).toBe(200);
    expect(accept.body.friend.username).toBe('alice');

    expect((await auth('get', '/api/friends', a.token)).body.friends).toHaveLength(1);
    expect((await auth('get', '/api/friends', b.token)).body.friends).toHaveLength(1);
  });

  it('forbids accepting a request addressed to someone else (403)', async () => {
    const a = await createUser({ username: 'alice' });
    await createUser({ username: 'bob' });
    const c = await createUser({ username: 'carol' });
    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    const reqId = send.body.request.id as number;
    const res = await auth('post', `/api/friends/requests/${reqId}/accept`, c.token).send();
    expect(res.status).toBe(403);
  });

  it('declines an incoming request (target only) and clears it', async () => {
    const a = await createUser({ username: 'alice' });
    const b = await createUser({ username: 'bob' });
    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    const reqId = send.body.request.id as number;

    const decline = await auth('post', `/api/friends/requests/${reqId}/decline`, b.token).send();
    expect(decline.status).toBe(204);
    expect((await auth('get', '/api/friends/requests', a.token)).body.outgoing).toHaveLength(0);
    expect((await auth('get', '/api/friends/requests', b.token)).body.incoming).toHaveLength(0);
  });

  it('cancels an outgoing request (sender only)', async () => {
    const a = await createUser({ username: 'alice' });
    const b = await createUser({ username: 'bob' });
    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    const reqId = send.body.request.id as number;

    // The target cannot cancel someone else's outgoing request.
    expect((await auth('delete', `/api/friends/requests/${reqId}`, b.token)).status).toBe(403);
    expect((await auth('delete', `/api/friends/requests/${reqId}`, a.token)).status).toBe(204);
    expect((await auth('get', '/api/friends/requests', a.token)).body.outgoing).toHaveLength(0);
  });

  it('removes an accepted friend from both sides', async () => {
    const a = await createUser({ username: 'alice' });
    const b = await createUser({ username: 'bob' });
    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    await auth('post', `/api/friends/requests/${send.body.request.id}/accept`, b.token).send();

    const remove = await auth('delete', `/api/friends/${b.user.id}`, a.token).send();
    expect(remove.status).toBe(204);
    expect((await auth('get', '/api/friends', a.token)).body.friends).toHaveLength(0);
    expect((await auth('get', '/api/friends', b.token)).body.friends).toHaveLength(0);
  });

  it('rejects re-friending someone you already are friends with (409)', async () => {
    const a = await createUser({ username: 'alice' });
    const b = await createUser({ username: 'bob' });
    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    await auth('post', `/api/friends/requests/${send.body.request.id}/accept`, b.token).send();
    const again = await auth('post', '/api/friends/requests', a.token).send({ username: 'bob' });
    expect(again.status).toBe(409);
  });

  it('searches users with a relationship tag and excludes self', async () => {
    const a = await createUser({ username: 'crypto_owl' });
    const b = await createUser({ username: 'crystal_wave' });
    const c = await createUser({ username: 'crimson_atlas' });
    await createUser({ username: 'zzz_unrelated' });

    // a → friends with b, pending to c
    const send = await auth('post', '/api/friends/requests', a.token).send({ username: 'crystal_wave' });
    await auth('post', `/api/friends/requests/${send.body.request.id}/accept`, b.token).send();
    await auth('post', '/api/friends/requests', a.token).send({ username: 'crimson_atlas' });

    const res = await auth('get', '/api/friends/search?q=cr', a.token);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      (res.body.results as { username: string; relationship: string }[]).map((r) => [r.username, r.relationship]),
    );
    expect(byName['crypto_owl']).toBeUndefined(); // self excluded
    expect(byName['crystal_wave']).toBe('friends');
    expect(byName['crimson_atlas']).toBe('outgoing');
    expect(byName['zzz_unrelated']).toBeUndefined(); // doesn't match prefix

    // From c's side, the same pending request reads as incoming.
    const cRes = await auth('get', '/api/friends/search?q=crypto', c.token);
    const cByName = Object.fromEntries(
      (cRes.body.results as { username: string; relationship: string }[]).map((r) => [r.username, r.relationship]),
    );
    expect(cByName['crypto_owl']).toBe('incoming');
  });
});
