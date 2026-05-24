import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

// The test env does not set GOOGLE_CLIENT_ID, so the route exercises the
// "not configured" path — which also confirms the endpoint is wired and that
// validation runs before any Google work. (The find-or-create logic is covered
// directly in googleAuth.service.test.ts.)
describe('POST /api/auth/google', () => {
  it('rejects a request with no credential (400)', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  it('returns 503 when Google sign-in is not configured', async () => {
    const res = await request(app).post('/api/auth/google').send({ credential: 'anything' });
    expect(res.status).toBe(503);
  });
});
