# Deploying Stakeless

A realistic, low-cost runbook to get Stakeless live for **~$0–7/month**.

---

## The architecture decision (why single-origin)

The frontend calls the API with a **relative URL** (`apps/frontend/src/api/client.ts` → `baseURL: '/api'`). So the cheapest, simplest, least-bug-prone deploy is **one always-on service that serves both the API and the built React SPA on the same domain**. That buys us:

- **No CORS** — the hardcoded `localhost:5173` origin in `app.ts` stops mattering.
- **No cross-site cookie breakage** — the `sameSite: 'strict'` refresh cookie just works.
- **One service, one domain, one bill.**

Two hard constraints drive the platform choice:

1. **Poker hand state lives in memory** (`services/poker/manager.ts`) and **Socket.IO needs a persistent connection.** → The backend must be a **single, always-on Node process**. Not serverless, not horizontally scaled.
2. A free tier that **spins down** will reset in-memory poker mid-hand and drop sockets. → Use an always-on instance (or accept this only for a throwaway demo).

---

## Recommended stack (~$7/mo, reliable, ~1–2 hrs)

| Piece | Service | Cost |
|---|---|---|
| Backend **+** SPA (one service) | **Render** Web Service (Starter, always-on) | **$7/mo** |
| Database | **Neon** Postgres (free tier, 0.5 GB) | **$0** |
| DNS / TLS | Provided by the platform | $0 |

**Near-$0 alternatives (more setup):**
- **Fly.io** (small instances fit the free allowance) + Neon — use the Dockerfile below.
- **Oracle Cloud Always-Free** ARM VM — genuinely $0 forever, but signup friction and you manage nginx/systemd/certbot.
- **Hetzner** VPS ~€4.5/mo — full control, most ops work.

**Avoid for this app:** Vercel/Netlify *functions* (serverless kills Socket.IO + in-memory poker); Render's *free* web service (15-min spin-down breaks live games — demo only).

> ⚠️ **Single instance only.** Never scale the backend past 1 instance — the in-memory poker manager cannot be shared across processes. This is fine for launch and well beyond portfolio-level traffic.

---

## Step 1 — Code prep (platform-independent)

Small, surgical changes. **None touch game logic.**

### 1.1 Socket connects to its own origin in production
`apps/frontend/src/socket.ts` is currently hardcoded to `http://localhost:3000`. Replace the `io(...)` target:

```ts
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

export const socket: Socket = io(SOCKET_URL, { /* …existing options unchanged… */ });
```

### 1.2 Express serves the built SPA + trusts the proxy
In `apps/backend/src/app.ts`. Add the imports and, **after** all `app.use('/api/...')` routes are registered:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// near the top of createApp(), before routes:
app.set('trust proxy', 1);                 // REQUIRED: secure cookies + rate-limit IPs behind the platform's TLS proxy
app.use(express.json({ limit: '512kb' })); // (replaces express.json()) also fixes the avatar 413

// …all app.use('/api/...', …) route registrations…

// LAST: serve the SPA in production
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.resolve(__dirname, '../public'); // where the Vite build is copied at deploy time
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}
```

> `trust proxy` is **not optional**. Without it, Express won't set `secure` cookies behind the platform's TLS terminator and login silently fails to persist.

### 1.3 Production start script + dependency fix
We run TypeScript directly with `tsx` (no compile step — this deliberately sidesteps the "shared package has no build" issue). So `tsx` and `drizzle-kit` must be reachable at deploy/runtime.

In `apps/backend/package.json`: **move `tsx` and `drizzle-kit` from `devDependencies` to `dependencies`**, and add:

```json
"scripts": {
  "start": "tsx src/index.ts",
  "db:migrate": "drizzle-kit migrate"
}
```

### 1.4 Postgres SSL
Managed Postgres requires SSL. Simplest: append `?sslmode=require` to `DATABASE_URL`. If you hit a self-signed-cert error, update the pool in `apps/backend/src/db/index.ts`:

```ts
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});
```

### 1.5 Helmet CSP (only if the page is blank / you enable Google sign-in)
`helmet()` runs with a strict default CSP. Same-origin bundled JS/CSS is fine. **If you enable Google sign-in**, the default CSP blocks `accounts.google.com` — add an explicit CSP allowing `https://accounts.google.com` (script) and `data:` (img). You can launch **without** Google sign-in and skip this.

---

## Step 2 — Provision the database (~5 min)

1. Create a free **Neon** project → copy the connection string (includes `?sslmode=require`).
2. Apply the schema (you're on migration `0010`):
   ```bash
   DATABASE_URL="<neon-url>" pnpm --filter backend db:migrate
   ```

---

## Step 3 — Deploy

### Option A — Render (no Dockerfile needed)
1. Push to GitHub → Render → **New Web Service** → point at the repo.
2. **Build command:**
   ```
   pnpm install && pnpm --filter frontend build && cp -r apps/frontend/dist apps/backend/public
   ```
3. **Start command:**
   ```
   pnpm --filter backend start
   ```
4. **Pre-deploy command:**
   ```
   pnpm --filter backend db:migrate
   ```
5. Set the **environment variables** (see the table below).
6. Deploy → open the URL → register → play.

### Option B — Fly.io / VPS / any container host (Dockerfile)
Create `Dockerfile` at the repo root:

```dockerfile
FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install deps (copy manifests first for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Copy source, then build the SPA into the backend's public dir
COPY . .
RUN pnpm --filter frontend build && cp -r apps/frontend/dist apps/backend/public

ENV NODE_ENV=production
EXPOSE 3000
# Migrate then start (safe for a single instance)
CMD ["sh", "-c", "pnpm --filter backend db:migrate && pnpm --filter backend start"]
```

> If you want **Google sign-in baked into the build**, pass `VITE_GOOGLE_CLIENT_ID` as a Docker build `ARG`/`ENV` *before* the `frontend build` line — Vite inlines `VITE_*` vars at build time.

For Fly: `fly launch` (it detects the Dockerfile), attach Neon via the `DATABASE_URL` secret, `fly secrets set ...` for the rest, ensure `min_machines_running = 1` in `fly.toml` (always-on).

---

## Environment variables

| Var | Where | Value |
|---|---|---|
| `NODE_ENV` | backend | `production` |
| `DATABASE_URL` | backend | Neon connection string (with `?sslmode=require`) |
| `JWT_SECRET` | backend | ≥32 chars — `openssl rand -hex 32` (enforced by `env.ts`) |
| `FRONTEND_URL` | backend | Your own deployed URL (single-origin), e.g. `https://stakeless.onrender.com` |
| `PORT` | backend | Usually injected by the platform; defaults to 3000 |
| `GOOGLE_CLIENT_ID` | backend | *(optional)* OAuth Web client ID; route 503s when unset |
| `VITE_GOOGLE_CLIENT_ID` | **build time** | *(optional)* same client ID; also add the prod URL to Google Console authorized origins |
| `VITE_SOCKET_URL` | build time | *(optional)* leave unset for single-origin; only set when splitting frontend/backend |
| `SMTP_*` | backend | *(optional)* password-reset email; logs the link to console when unset |

---

## Step 4 — Launch-day smoke test

- [ ] Register + log in, **refresh the page → stay logged in** (proves `secure` cookie + `trust proxy` + cookie path)
- [ ] Place a bet on an instant game → balance updates
- [ ] Open **Crash** → the live socket curve moves and settles (proves WebSockets end-to-end)
- [ ] Sit at a **poker** table → state pushes (proves the persistent process + in-memory engine)

---

## Operational notes & troubleshooting

- **A restart/redeploy abandons live hands — and that's handled.** `TableManager.refundAllSeats()` runs on boot and returns parked poker chips; Crash rounds settle from the DB session. A redeploy is money-safe; it only interrupts anyone mid-hand.
- **Login doesn't persist after refresh** → missing `app.set('trust proxy', 1)` (Step 1.2) or the platform isn't terminating TLS / serving HTTPS.
- **Blank page, console shows CSP errors** → configure Helmet CSP (Step 1.5).
- **`tsx: command not found` on deploy** → `tsx`/`drizzle-kit` still in `devDependencies` and the platform pruned dev deps (Step 1.3).
- **DB connection error / `self-signed certificate`** → add `?sslmode=require` or the `ssl` pool option (Step 1.4).
- **Avatar upload fails for larger images** → `express.json({ limit: '512kb' })` (Step 1.2).
- **Logs:** for launch, the platform's log tail is enough. Structured logging (pino) + error tracking (Sentry) are tracked in `THE_NEXT_STEP.md` as a follow-up, not a launch blocker.

---

## Cost & time summary

- **Time:** ~1–2 hours, most of it the Step 1 code prep.
- **Money:** **$7/mo** (Render Starter) + **$0** (Neon) is the reliable floor; **near-$0** on Fly/Oracle with more setup.
- **Code changes:** 4 small, low-risk edits + a build/copy step. **Zero game-logic changes.**
