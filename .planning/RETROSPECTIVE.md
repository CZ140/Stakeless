# Retrospective: Virtual Casino Platform

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-06
**Phases:** 11 | **Plans:** 29 | **Timeline:** 8 days (2026-02-27 → 2026-03-06)

### What Was Built

- pnpm monorepo scaffold with PostgreSQL/Drizzle, Express backend, React/Vite frontend
- Secure auth with JWT refresh token rotation, bcrypt, email-based password reset
- Atomic virtual coin economy (SELECT-FOR-UPDATE) with real-time Socket.IO balance push
- Four complete casino games: Roulette (GSAP wheel), Plinko (Galton board SVG), Mines (server-side grid), Blackjack (multi-step session, dealer AI)
- Live leaderboards via Socket.IO broadcast; public profile pages with Recharts charts
- Role-gated admin panel with player inspector, ban/unban, audit log; rate limiting + bot-detection middleware

### What Worked

- **Complexity ordering for games:** Roulette (stateless) → Plinko (stateless) → Mines (session) → Blackjack (multi-step) built reusable patterns incrementally. Each game could reuse the wallet, logging, and bet infrastructure proven by the previous.
- **Decimal phases for gap closure:** Inserting phases 3.1, 5.1, and 5.2 without renumbering kept the roadmap coherent. Each inserted phase had a clear, scoped goal (one file to fix, one doc to write).
- **Hard phase ordering constraint:** Foundation → Auth → Wallet → Games → Leaderboards → Profile → Admin. No phase was blocked by an unfinished dependency.
- **Milestone audit before archiving:** Running `/gsd:audit-milestone` surfaced 3 real blockers (missing VERIFICATION.md, Blackjack API defect, broken Header link) that would have shipped as bugs. The second audit confirmed all closures.
- **SELECT FOR UPDATE for balance atomicity:** Chose the right concurrency model in Phase 3; never revisited it through Phases 4–8. All 11 game settlement paths used `settleBet()` from the same service.

### What Was Inefficient

- **ROADMAP.md checkbox staleness:** Phase 3.1, 5.1, 5.2 checkbox markers ([ ] vs [x]) fell out of sync during development and required cleanup at audit time. A live checkbox update after each plan would prevent this.
- **SUMMARY frontmatter requirements_completed gaps:** 12 requirements had verified implementations but were missing from SUMMARY frontmatter. Writing the frontmatter inline during execution would avoid discovery at audit time.
- **Duplicate admin audit docs:** An audit file was created twice (2026-03-03 and 2026-03-06) because gap closure phases were added after the first audit. The second audit superseded the first but both needed manual reconciliation.
- **Phase 8 plan count inflation:** Phase 8 had 5 plans (3 primary + 2 gap closures). The gap closure plans (08-04, 08-05) could have been folded into 08-02 at planning time since they addressed the same subsystem.

### Patterns Established

- **Game service pattern:** Pure resolver function (no side effects) + route handler that calls `deductBet → resolver → settleBet → io.emit('balance:update')`. All four games follow this exactly.
- **Zustand v5 double-parens pattern:** `create<State>()((set) => ...)` — documented in STATE.md decisions to prevent confusion in future sessions.
- **Decimal phase insertion:** Decimal phases (N.1, N.2) for urgent gap-closure work that doesn't warrant a new integer phase.
- **gameLimiter before requireAuth:** Rate-limit middleware applied before auth to reject bots before consuming DB resources.
- **AdminRoute probes backend:** Admin role gating in React uses a live `/api/admin/stats` probe rather than trusting JWT payload — consistent with backend DB-verified role check.

### Key Lessons

- **Run the audit early, not just at the end.** The first audit (2026-03-03) found blockers midway through Phase 5. If it had run after Phase 4, the rouletteStore bug and missing VERIFICATION.md would have been caught before Phase 5 built on top of them.
- **Write SUMMARY frontmatter `requirements_completed` during execution, not retroactively.** The 12 doc-only gaps all came from plans written without this field being populated at the time.
- **Socket.IO cannot attach to an already-listening Express server.** Phase 6 switched from `app.listen()` to `http.createServer(app)` + Socket.IO attach. Document this in Phase 6 context for next projects using the same stack.
- **Framer Motion v12 incompatible with React 19 for countup animations.** Used `useSpring + useTransform` from Framer Motion instead of react-countup. Good to document for balance display re-use in v2.

### Cost Observations

- Sessions: ~20+ sessions across 8 days
- Model: claude-sonnet-4-6 (balanced profile)
- Notable: Parallel plan execution within phases consistently faster than sequential; wave-based execution used throughout Phases 4–8

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 11 |
| Plans | 29 |
| Timeline (days) | 8 |
| LOC (TypeScript) | ~9,465 |
| Requirements satisfied | 53/53 |
| Gap-closure phases inserted | 3 |
| Blockers found at audit | 3 (all closed) |
