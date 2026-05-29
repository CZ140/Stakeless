import rateLimit from 'express-rate-limit';

// Applied to: /register, /login, /forgot-password
// Counts only failed attempts (skipSuccessfulRequests: true)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

// gameLimiter — POST cap per minute per IP on all POST /api/games/* routes (ANTI-01).
// The 100ms clickInterval is the hard anti-bot guard (≤10 req/s); this per-minute
// cap is just a far-off backstop against a runaway script. Raised to 1000/min so it
// never bites real play — Plinko's auto mode (up to 500 balls at ~170ms ≈ 350/min)
// used to trip the old 120/min cap after ~20s.
export const gameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Integration tests make many game POSTs from one IP within a minute; the
  // limit itself is verified separately, so skip it under test.
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests. Slow down.' },
});

// socialLimiter — caps friend-request and group-invite/create spam. Applied to
// mutating social POSTs (send request, invite, create group) before requireAuth.
// 60/min/IP is generous for real use but stops a script blasting requests.
export const socialLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Integration tests fire many social POSTs from one IP; the limit is not the
  // thing under test, so skip it under test (mirrors gameLimiter).
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests. Slow down.' },
});
