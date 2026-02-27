# Stack Research

**Domain:** Browser-based virtual casino / social gambling platform
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH (core stack verified via web search + npm; versions spot-checked against official npm registry)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS (Jod) | Backend runtime | Current active LTS until April 2027; Express 5 requires Node 18+; v22 adds V8 maglev compiler for better performance |
| Express | 5.x (5.1.0+) | HTTP API server | v5 became the npm default in March 2025; async error propagation built in, removing try/catch boilerplate around every route |
| React | 19.x (19.2.4) | Frontend UI framework | Current stable with concurrent rendering, Actions API for mutations; no reason to stay on 18 for a greenfield project |
| TypeScript | 5.x | Type safety across full stack | Shared types between Express route handlers, Drizzle schemas, and React components eliminate an entire class of runtime bugs |
| PostgreSQL | 16 or 17 | Primary datastore | Chosen explicitly; transactions are mandatory for bet-deduct-credit atomicity; JSONB for future game metadata |

### Database & ORM

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Drizzle ORM | 0.45.x | PostgreSQL schema, queries, migrations | SQL-first TypeScript ORM; ~7.4 KB; generates actual SQL you can audit; Drizzle Kit handles migrations with `drizzle-kit migrate`; zero-overhead vs raw `pg` |
| postgres (pg driver) | `postgres@^3` | PostgreSQL connection pooling | The `postgres` package (not `node-postgres`) pairs natively with Drizzle; tagged-template SQL escape built in; connection pooling via pool config |

**Why Drizzle over Prisma:** Prisma adds a separate query engine binary (~40 MB) and a separate `.prisma` DSL. Drizzle keeps the schema in TypeScript alongside the rest of the codebase, and the generated SQL is readable and auditable — important when bet payouts are calculated in the same transaction layer. Confidence: MEDIUM (multiple 2026 comparison articles agree; official Drizzle + Prisma docs support the trade-off claim).

### WebSockets (Real-Time)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Socket.IO | 4.8.x (4.8.3) | Leaderboard push, balance sync | Rooms + namespaces built in, so a single `io.to('leaderboard').emit()` call broadcasts to all subscribers; automatic reconnect handles browser hibernation; Redis adapter available for horizontal scaling later |
| socket.io-client | 4.8.x | React side of the WebSocket | Matched version with server; hooks-friendly event subscription pattern |

**Why Socket.IO over raw `ws`:** The leaderboard feature requires broadcasting one event to all connected clients. With raw `ws` you maintain a manual client set and iterate it yourself. Socket.IO gives this for free. The extra ~12 KB over raw `ws` is not a concern for a browser casino app. Confidence: MEDIUM (multiple community comparisons; Socket.IO changelog verified via official site).

### Authentication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| jsonwebtoken | 9.0.x (9.0.3) | Sign / verify JWT access tokens | Stable, Auth0-maintained; the `9.x` branch added required algorithm specification (prevents alg:none attacks); pairs cleanly with Express middleware |
| bcrypt | 6.0.x (6.0.0) | Password hashing | Native C binding is 3-5x faster than `bcryptjs` for the same work factor; use cost factor 12 (OWASP 2025 recommendation for bcrypt); v5.0+ patches wrap-around truncation bug on 255+ char passwords |

**Why bcrypt over Argon2id:** Argon2id is technically superior (memory-hard, GPU-resistant). However, bcrypt at cost factor 12-14 remains in OWASP's acceptable list, `bcrypt@6` has no known active vulnerabilities, and the native binding is well-maintained. Switch to Argon2id if the project later needs to align with OWASP's primary recommendation. Confidence: MEDIUM (OWASP guidance + npm advisory data).

**JWT pattern for this project:**
- Access token: 15-minute expiry, `HS256`, stored in memory (not localStorage)
- Refresh token: 7-day expiry, stored in httpOnly cookie
- Admin routes: check `role` claim in JWT payload

### Validation & Security Middleware

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.x | Request body schema validation | Every Express route that accepts user input; define schemas once, reuse types on the frontend via shared `types/` package |
| helmet | 8.1.x | HTTP security headers (CSP, HSTS, etc.) | Apply globally as first middleware; sets 15 security headers with one call |
| cors | 2.8.x | CORS policy | Configure to allow only the React dev origin and production domain |
| express-rate-limit | 8.2.x | Per-IP rate limiting | Apply per-endpoint: `/game/*` routes need tighter limits than `/auth/login`; covers the anti-cheat requirement |

### React State Management

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0.x (5.0.11) | Client-side global state | Current user session, coin balance, UI state (active game, modal open); 1.16 KB gzipped, no Provider boilerplate |
| TanStack Query | 5.x (5.90.x) | Server state / API data fetching | Leaderboard data, player profile, game history; handles caching, background refresh, and loading/error states automatically |

**Pattern:** Zustand for things that live in the browser (session, UI); TanStack Query for everything that comes from the API. Do not use Redux — it is overkill for this project's state complexity.

### Frontend UI

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.x | Utility-first styling | Use the new `@tailwindcss/vite` plugin; v4 drops `tailwind.config.js` and PostCSS requirements; `@import "tailwindcss"` in CSS is all that's needed |
| shadcn/ui | latest CLI | Accessible component primitives | Copy-owned components (Dialog, Table, Badge, Progress, Dropdown); built on Radix UI primitives; you control the code, so casino-specific dark theming is straightforward |

**Note on shadcn/ui stability:** The original Radix UI team has shifted focus to Base UI. This has raised long-term questions about the Radix primitives underlying shadcn/ui. For v1 of a learning project this is not a blocker — shadcn/ui components are copy-pasted into your codebase, so you are not dependent on upstream Radix releases once generated. Confidence: MEDIUM.

### Animation (Casino Games)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Motion (formerly Framer Motion) | 12.x (12.34.x) | React animation | Card flip in Blackjack, chip slide, win/lose feedback, UI transitions; declarative `<motion.div>` API integrates cleanly into JSX; GPU-accelerated via hybrid engine |
| GSAP (GreenSock) | 3.x | Complex timeline animation | Use only if Motion proves insufficient for Plinko ball physics or Roulette wheel spin — GSAP excels at timeline-sequenced multi-step animations that require precise easing control |

**Recommendation:** Start with Motion for all animations. GSAP has a slightly more complex API and a separate plugin ecosystem. Only bring in GSAP if the Plinko ball path or roulette wheel spin requires true timeline control (e.g., ball bouncing off pegs with easing curves that don't map cleanly to CSS transitions). Confidence: HIGH for Motion; MEDIUM for the GSAP conditional.

### Data Visualization (Player Profiles)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | 3.7.x | Balance-over-time and wagered-per-day charts | Built on D3 + React, fully declarative; 3.6 M weekly downloads, stable API; adequate for moderate dataset sizes (daily/weekly coin history per user) |

**Note:** Recharts performance degrades with very large datasets (each point = one SVG node). For player profile charts showing daily snapshots this is not a concern. If the admin dashboard later needs charts over millions of records, switch to Chart.js or Victory for canvas rendering. Confidence: MEDIUM.

### RNG / Game Math

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js built-in `crypto` module | Node 22 stdlib | Cryptographically secure random numbers | `crypto.randomInt(min, max)` is a CSPRNG backed by the OS entropy pool; no third-party dependency required; never use `Math.random()` for game outcomes |

**RNG Pattern for each game:**
```typescript
import { randomInt } from 'node:crypto';

// Roulette: European wheel 0-36
const pocket = randomInt(0, 37); // 0 inclusive, 37 exclusive

// Blackjack: draw from shuffled deck (Fisher-Yates with crypto.randomInt)
// Plinko: determine row drops with randomInt(0,2) per peg row
// Mines: sample mine positions using crypto.randomInt without replacement
```

All game outcome calculation must occur server-side and be logged before the result is returned to the client. The client must never be trusted to report a game result. Confidence: HIGH (`crypto.randomInt` is Node.js stdlib, documented at nodejs.org).

**Why NOT `Math.random()`:** It uses an unseeded linear congruential PRNG; its output can be reverse-engineered from a sequence of observed values. For a virtual casino, even without real money, predictable outcomes undermine the game. Confidence: HIGH.

### Development Toolchain

| Tool | Version/Config | Purpose | Notes |
|------|---------------|---------|-------|
| Vite | 6.x | Frontend build tool + dev server | `npm create vite@latest` with `react-ts` template; HMR under 100 ms |
| TypeScript | 5.x | Type checking | `strict: true` in `tsconfig.json`; share types between frontend and backend via a `packages/types/` workspace or a `shared/` folder |
| ESLint | 9.x (flat config) | Linting | Use `eslint.config.js` (new flat config format); add `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks` |
| Prettier | 3.x | Code formatting | Add `eslint-config-prettier` to turn off ESLint formatting rules that conflict |
| Vitest | 3.x | Unit + integration testing | Fastest option for Vite-based projects; API mirrors Jest; use for game math unit tests (RNG outcome distributions), Express route integration tests |
| Supertest | 7.x | HTTP integration testing | Test Express routes without spinning up a live server; pairs with Vitest |
| Husky + lint-staged | latest | Pre-commit hooks | Run ESLint + Prettier on staged files before commit |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `Math.random()` for game outcomes | PRNG is predictable; a determined player could reconstruct the seed from observed outputs | `crypto.randomInt()` from Node.js stdlib |
| Sequelize ORM | Outdated TypeScript support; verbose association API; not type-safe out of the box; has been in maintenance mode | Drizzle ORM |
| TypeORM | Decorators-based design conflicts with strict TypeScript; historically poor PostgreSQL migration reliability | Drizzle ORM |
| Redux Toolkit | Excessive boilerplate for this project's state complexity; RTK Query duplicates TanStack Query's role | Zustand + TanStack Query |
| `localStorage` for JWT storage | XSS attack reads the entire localStorage; casino balance theft is the obvious target | Memory (access token) + httpOnly cookie (refresh token) |
| `bcrypt-nodejs` | Unmaintained since 2014; known vulnerabilities | `bcrypt@6` (native) |
| `ws` (raw WebSocket) | Requires manual client tracking, manual reconnect, manual room management | Socket.IO 4.x |
| Prisma | Requires separate query engine binary (~40 MB), separate `.prisma` DSL; heavier cold start | Drizzle ORM |
| `express@4` | Still works, but async errors require manual try/catch in every route; v5 is now the npm default | `express@5` |
| GSAP as the primary animation library | Heavier API, separate plugin ecosystem; overkill unless you need complex timeline sequencing | Motion (framer-motion) for standard animations |
| Mongoose / MongoDB | NoSQL is wrong for transactional bet deduct/credit logic that requires ACID guarantees | PostgreSQL + Drizzle |

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| ORM | Drizzle ORM | Prisma | If you want a GUI schema editor (Prisma Studio) and team prefers the Prisma DSL |
| WebSockets | Socket.IO | raw `ws` | If you have 50K+ concurrent connections and can justify the extra implementation work |
| Animation | Motion 12 | GSAP | If you need multi-step timeline control for Plinko physics or roulette wheel sequences |
| Password hashing | bcrypt 6 | argon2 | If aligning to OWASP primary recommendation; slightly more complex setup (native binding) |
| State management | Zustand | Jotai | Both are fine; Zustand has larger community; Jotai is better for fine-grained atom-level reactivity |
| Charts | Recharts | Chart.js | If you need canvas rendering for large datasets in the admin dashboard |
| Testing | Vitest | Jest 30 | Jest if the team already has a Jest config; Vitest for new Vite projects |
| Auth tokens | jsonwebtoken | jose | `jose` has better algorithm coverage and ES module support; choose it if you later need RS256 or asymmetric signing |

---

## Installation

```bash
# --- Backend (Node/Express API) ---

# Core
npm install express socket.io jsonwebtoken bcrypt zod drizzle-orm postgres

# Security middleware
npm install helmet cors express-rate-limit

# Dev dependencies
npm install -D typescript ts-node @types/node @types/express @types/jsonwebtoken @types/bcrypt \
  vitest supertest @types/supertest drizzle-kit eslint prettier \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-config-prettier husky lint-staged

# --- Frontend (React/Vite) ---

# Create project
npm create vite@latest client -- --template react-ts

# Navigate into client dir, then:
npm install react react-dom socket.io-client \
  zustand @tanstack/react-query \
  motion \
  recharts \
  tailwindcss @tailwindcss/vite \
  zod

# shadcn/ui (CLI-based, adds components to your codebase)
npx shadcn@latest init

# Dev dependencies (frontend)
npm install -D @types/react @types/react-dom \
  vitest @testing-library/react @testing-library/user-event \
  eslint eslint-plugin-react-hooks prettier eslint-config-prettier \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Express 5.x | Node.js 18+ (use 22 LTS) | Express 5 dropped Node < 18 |
| Drizzle ORM 0.45.x | postgres 3.x driver | Do not mix with `pg` (node-postgres); pick one driver |
| Socket.IO 4.8.x | Node.js 10+ (effectively 18+) | Server and client versions must match major version |
| Motion 12.x | React 18+ | React 19 fully supported |
| Tailwind CSS 4.x | Vite 6 with `@tailwindcss/vite` | v4 drops PostCSS pipeline; do not use v3 PostCSS config with v4 |
| Zustand 5.x | React 18+ | React 19 supported |
| TanStack Query 5.x | React 18+ | React 19 supported; v5 removed deprecated v4 API surface |
| bcrypt 6.x | Node.js 18+ | Requires node-gyp native compilation; ensure build tools installed (Python, C++ compiler) |

---

## Stack Patterns by Variant

**For local development:**
- Use Docker Compose with a PostgreSQL 16 container
- Use a `.env` file for `DATABASE_URL`, `JWT_SECRET`, `PORT`
- Run backend with `tsx watch src/index.ts` (tsx = ts-node replacement, faster)

**For the Admin Panel:**
- Same React app, protected routes gated by `role: 'admin'` JWT claim
- No separate frontend app needed at v1 scale
- Admin API routes under `/api/admin/*` with role-checking middleware

**For game state (real-time balance sync):**
- After a game round resolves, emit `balance:update` via Socket.IO to the player's socket room (keyed by userId)
- Do NOT poll the REST API for balance; the Socket.IO event is the update mechanism
- Leaderboard: broadcast `leaderboard:update` to all clients in the `leaderboard` room after any bet settles

**For game math (server-side only):**
```typescript
// Every game endpoint pattern:
// 1. Validate bet amount (Zod + server check: balance >= bet)
// 2. Deduct bet from balance (within a DB transaction)
// 3. Calculate outcome with crypto.randomInt
// 4. Credit winnings (within same DB transaction)
// 5. Insert row into Bets table (same transaction)
// 6. Commit
// 7. Emit balance:update via Socket.IO
// 8. Return result to client
```

---

## Sources

- npm registry (socket.io) — Socket.IO 4.8.3 confirmed latest; https://www.npmjs.com/package/socket.io
- npm registry (drizzle-orm) — 0.45.1 confirmed latest; https://www.npmjs.com/package/drizzle-orm
- npm registry (motion) — 12.34.3 confirmed latest; https://www.npmjs.com/package/motion
- npm registry (recharts) — 3.7.0 confirmed latest; https://www.npmjs.com/package/recharts
- npm registry (zustand) — 5.0.11 confirmed latest; https://www.npmjs.com/package/zustand
- npm registry (@tanstack/react-query) — 5.90.21 confirmed latest; https://www.npmjs.com/package/@tanstack/react-query
- npm registry (jsonwebtoken) — 9.0.3 confirmed latest; https://www.npmjs.com/package/jsonwebtoken
- npm registry (bcrypt) — 6.0.0 confirmed latest; https://www.npmjs.com/package/bcrypt
- npm registry (bcryptjs) — 3.0.3 confirmed latest; https://www.npmjs.com/package/bcryptjs
- npm registry (helmet) — 8.1.0 confirmed latest; https://www.npmjs.com/package/helmet
- npm registry (express-rate-limit) — 8.2.1 confirmed latest; https://www.npmjs.com/package/express-rate-limit
- Express 5 official blog — v5.1.0 became npm default March 2025; https://expressjs.com/2025/03/31/v5-1-latest-release.html
- React blog — React 19.2.0 stable; https://react.dev/blog/2025/10/01/react-19-2
- Tailwind CSS v4 announcement; https://tailwindcss.com/blog/tailwindcss-v4
- Node.js release schedule — Node 22 active LTS until 2027-04-30; https://nodejs.org/en/about/previous-releases
- Bytebase: Drizzle vs Prisma 2026; https://www.bytebase.com/blog/drizzle-vs-prisma/ — MEDIUM confidence
- LogRocket: Best React animation libraries 2026; https://blog.logrocket.com/best-react-animation-libraries/ — MEDIUM confidence
- Node.js crypto.randomInt docs; https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback — HIGH confidence
- OWASP Password Storage Cheat Sheet (bcrypt cost factor guidance) — MEDIUM confidence
- Vitest vs Jest 2026 comparison; https://www.sitepoint.com/vitest-vs-jest-2026-migration-benchmark/ — MEDIUM confidence
- shadcn/ui GitHub; https://github.com/shadcn-ui/ui — HIGH confidence (component ownership model)

---
*Stack research for: Browser-based virtual casino platform (React + Node/Express + PostgreSQL)*
*Researched: 2026-02-27*
