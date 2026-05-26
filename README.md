# Stakeless

A full-stack, real-time **virtual casino** built with TypeScript end to end. Players sign up, get a balance of play-money coins, and gamble across twelve original games plus live multiplayer poker — with live balance updates, a global leaderboard, a tier-progression loyalty system, friends/groups, and an admin console.

> **Stakeless plays for fun, not for funds.** All currency is virtual. There are no deposits, no withdrawals, and no real money anywhere in the system — the name is the point. This is a portfolio / engineering project demonstrating real-time full-stack architecture, not a gambling product.

<!--
Screenshots: drop images into a `docs/` folder and uncomment.
![Dashboard](docs/dashboard.png)
![Roulette](docs/roulette.png)
-->

---

## Highlights

- **Twelve hand-built games**, each with server-authoritative logic and cryptographically secure RNG: **Roulette**, **Blackjack** (multi-hand, split & double), **Mines**, **Plinko**, **Dice**, **Slots**, **Crash**, **Coin Flip**, **Hi-Lo**, **Pump**, **Chicken Road**, and **Rock-Paper-Scissors** — plus real-time multiplayer **Texas Hold'em poker** (bots, private/invite tables, table chat, hand history).
- **Server-authoritative & cheat-resistant** — the client never decides outcomes. RNG runs on the server via Node's `crypto.randomInt`; in Mines the bomb grid is generated and stored server-side and *never* sent to the browser during a live round.
- **Financial integrity by design** — coin balances are stored as `BIGINT` integers (no floating-point money) and every wager runs through a `SELECT … FOR UPDATE` row lock inside a transaction, making concurrent double-spend impossible.
- **Real-time everything** — Socket.IO pushes balance changes and broadcasts a live leaderboard to every connected client.
- **Complete auth suite** — email/password (with password reset), **Sign in with Google** (GSI ID-token flow), short-lived JWT access tokens + rotating httpOnly refresh cookies.
- **Loyalty progression** — six wager-based tiers (Bronze → Obsidian) with one-time level-up rewards and tier-scaled daily bonuses.
- **Admin console** — platform stats, player management, ban/unban, and an audit log, all behind a database-verified role check.
- **Tested** — 100+ unit tests covering game math and wallet logic, plus real-database integration tests driven through the HTTP layer with Supertest.

---

## Tech stack

| Layer | Technology |
|---|---|
| **Language** | TypeScript (strict) across the entire stack |
| **Monorepo** | pnpm workspaces — `apps/backend`, `apps/frontend`, `packages/shared` |
| **Backend** | Node.js, Express, Socket.IO |
| **Database** | PostgreSQL + Drizzle ORM (typed schema & SQL migrations) |
| **Auth** | JWT (`jose`), bcrypt (`bcryptjs`), Google Identity Services, httpOnly refresh cookies |
| **Validation / security** | Zod, Helmet, CORS, `express-rate-limit` |
| **Frontend** | React 19, Vite 6, React Router 7 |
| **State / realtime** | Zustand, `socket.io-client` |
| **Animation** | GSAP (roulette wheel physics), Framer Motion, `sonner` toasts |
| **Email** | Nodemailer (password-reset mail; optional — logs the link to console when SMTP is unset) |
| **Testing** | Vitest, Supertest |

---

## The games

| Game | How the outcome is decided | Notable mechanics |
|---|---|---|
| **Roulette** | `crypto.randomInt(0, 37)` selects a pocket on a European single-zero wheel | Up to 50 simultaneous bets per spin (numbers, colours, odd/even, dozens, columns); GSAP-driven wheel animation |
| **Blackjack** | Server-dealt shoe; dealer hole card hidden until settlement | Multiple pre-deal hands, hit / stand / **double** / **split**, natural blackjack payouts, resumable sessions |
| **Mines** | Server generates and stores the bomb grid; positions never leave the server mid-round | 5×5 grid, 1–24 mines, escalating multiplier, cash-out at any time, refresh-safe sessions |
| **Plinko** | Binomial drop simulation (`rollPlinkoBucket`) — true Plinko odds, not a uniform pick | 8–16 rows, four risk profiles (low → expert) |
| **Dice** | `crypto` roll-under/over against an adjustable target | Instant settle, live win-chance slider, 97% RTP |
| **Slots** | 3×3 grid over 5 paylines (`spinGrid`) | Exact 97% RTP from a closed-form payline model |
| **Crash** | Hidden, server-decided crash point; client never sees it | Live rising curve, manual + auto cash-out over Socket.IO, 97% RTP for any strategy |
| **Coin Flip** | Single fair 50/50 toss | Instant settle, 1.94× on a win |
| **Hi-Lo** | I.i.d. 52-card draws — guess higher / lower | Compounding ladder, a tie loses, cash out any time |
| **Pump** | Hypergeometric balloon with hidden hazards | 4 difficulties; house edge applied once → 97% RTP at every cash-out |
| **Chicken Road** | Hypergeometric lane crossing with hidden cars | 4 difficulties, rising risk, ceilings up to ×3.17M |
| **Rock-Paper-Scissors** | House throws uniformly at random | Win 1.91×, tie = push, 97% RTP |
| **Poker** | Real-time multiplayer Texas Hold'em; in-memory engine | Bots, public/private + invite tables, table chat, hand history, crash-safe seat refunds |

Every single-player round follows the same money pipeline:

```
validate (Zod) → deductBet (locked tx) → resolve outcome (server RNG)
              → settleBet (locked tx + game log) → reconcile tier → emit balance:update
```

---

## Architecture

```
gambling-website/                 (pnpm monorepo)
├── apps/
│   ├── backend/                  Express API + Socket.IO
│   │   └── src/
│   │       ├── routes/           auth, games, wallet, leaderboard, profile, admin, health
│   │       ├── services/         game resolvers, wallet (atomic money), auth, google, email, tiers
│   │       ├── middleware/       requireAuth, requireAdmin, rate limiting, validation, anti-spam
│   │       ├── socket/           auth handshake + leaderboard broadcast
│   │       └── db/               Drizzle schema + SQL migrations
│   └── frontend/                 React 19 + Vite SPA
│       └── src/
│           ├── pages/            game pages, dashboard, auth, profile, leaderboard, admin
│           ├── components/       shared UI + the "Vault" design system
│           ├── stores/           Zustand stores (per game + balance + leaderboard)
│           └── contexts/         AuthContext
└── packages/
    └── shared/                   types + tier table shared by backend and frontend
```

**Design decisions worth calling out:**

- **Single source of truth for money & tiers.** Coin math lives only in `walletService.ts`; the tier ladder lives only in `packages/shared/tiers.ts` and is imported by both server (rewards, daily bonus) and client (badges, progress UI) — no duplicated thresholds.
- **Defense in depth on game routes.** Each `POST` game endpoint is wrapped in `rateLimiter → clickInterval (anti-spam) → requireAuth` *before* any money moves, and validated with a Zod schema.
- **Admin trust is never taken from the token.** The `requireAdmin` middleware re-reads the user's role from the database on every request, so a stale or tampered JWT can't grant admin access.
- **Google accounts link, not collide.** `POST /api/auth/google` verifies the ID token with `jose`, then finds-or-creates-or-links by Google `sub` / email and issues the *same* session a password login would (`password_hash` is nullable for social-only accounts).

### Selected API surface

| Method & path | Purpose |
|---|---|
| `POST /api/auth/register` · `/login` · `/google` | Account creation & the three sign-in paths |
| `GET/PATCH /api/auth/me` | Read / edit own profile (username, avatar colour or image) |
| `POST /api/auth/refresh` · `/logout` | Rotate refresh cookie / revoke session |
| `POST /api/auth/forgot-password` · `/reset-password` | Emailed password reset |
| `POST /api/games/roulette/bet` · `/plinko/bet` | One-shot wagers |
| `POST /api/games/mines/{start,tile,cashout}` | Stateful Mines round |
| `POST /api/games/blackjack/{deal,action}` | Stateful Blackjack round |
| `POST /api/wallet/bonus` | Claim the tier-scaled daily bonus |
| `GET /api/leaderboard` | Top players (also broadcast live over Socket.IO) |
| `GET /api/admin/*` | Stats, players, history, ban/unban (admin only) |

---

## Getting started

### Prerequisites

- **Node.js 20+** and **pnpm**
- **PostgreSQL** — or just Docker (a `docker-compose.yml` is included)

### 1. Install

```bash
pnpm install
```

### 2. Start a database

```bash
docker compose up -d        # starts Postgres 16 on localhost:5432
```

### 3. Configure environment

```bash
cp .env.example .env                                  # backend (repo root)
cp apps/frontend/.env.example apps/frontend/.env      # frontend
```

Then edit `.env` and set a real `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Everything else has working local defaults. Email (verification / reset) is optional — point `SMTP_*` at a [Mailtrap](https://mailtrap.io) sandbox to see those mails. **Sign in with Google** is hidden until you set a real OAuth Web client ID in *both* `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend) — the same public client ID from the Google Cloud console.

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Start both apps

```bash
pnpm dev          # backend on :3000, frontend on :5173
```

Open **http://localhost:5173**, register an account, and play.

---

## Testing

```bash
pnpm --filter backend test        # Vitest: game math, wallet logic, route integration
pnpm typecheck                    # strict type check across all three packages
```

Game-resolution math (roulette payouts, blackjack hand values, Mines multipliers, Plinko buckets, streak/tier logic) is covered by fast unit tests. The wallet and auth/profile flows are covered by integration tests that hit the real Express app and a real PostgreSQL database through Supertest, so the money path is exercised end to end.

---

## Roadmap

The current build is a shipped v1.0. Candidate features for the next milestone include additional games (Slots, a CS:GO-style case spinner, Crash, Dice, Hi-Lo, Coin Flip), a multiplayer Poker table, in-app chat and friends, and a player-facing bet-history view.

---

## License & disclaimer

This project is for educational and portfolio purposes. It simulates casino games with **virtual, valueless currency only** — it does not facilitate real-money gambling in any form.
