# Milestones

## v1.0 MVP (Shipped: 2026-03-06)

**Phases completed:** 11 phases, 29 plans
**Timeline:** 2026-02-27 → 2026-03-06 (8 days)
**Codebase:** ~9,465 lines TypeScript | 199 files | 149 commits

**Delivered:** Full-stack virtual casino platform with four playable games, live leaderboards, player profiles, and an admin panel — 53/53 v1 requirements satisfied.

**Key accomplishments:**
- pnpm monorepo scaffold with PostgreSQL/Drizzle schema (5 tables, BIGINT balance), Express + React/Vite, shared TypeScript types
- Secure auth: bcrypt registration, JWT (15-min access + 7-day refresh httpOnly cookie), password reset via email, token revocation
- Atomic virtual coin economy using SELECT-FOR-UPDATE transactions; real-time balance push via Socket.IO WebSocket
- Four complete casino games: Roulette (GSAP animated wheel), Plinko (Galton board SVG animation), Mines (server-side grid state), Blackjack (multi-step session, dealer AI soft-17)
- Live leaderboards via Socket.IO 7-second broadcast (balance / wagered / profit tabs); public player profile pages with Recharts history charts
- Role-gated admin panel with player inspector, ban/unban with immediate session invalidation, audit log; server-side rate limiting (30 req/min) and bot-detection (100ms click interval) on all game routes

**Known Tech Debt:**
- No VALIDATION.md files exist in any phase (Nyquist wave-0 coverage not established)
- SUMMARY frontmatter missing requirements_completed for: AUTH-01, GINF-02/04/05, BJK-01/03, PLNK-01/02/03, ANTI-01/02/03 (doc-only gaps — all verified implemented)
- POST /api/wallet/bet demo endpoint has no frontend consumer (dead code, harmless)
- GINF-07 localStorage read-back not independently verified for Mines/Blackjack stores
- LDR-04: leaderboard lags 0–7s behind game resolution (accepted design spec)
- Profile link transiently absent ~100ms after login while /auth/me populates username

---

