---
phase: 03-wallet-currency
verified: 2026-03-02T00:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 3: Wallet & Currency — Verification Report

**Phase Goal:** Implement the wallet and currency system — atomic balance mutations, daily bonus, starting balance on registration, and server-side bet pipeline with game logging.
**Verified:** 2026-03-02
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A newly registered user gets balance: 1000 (not 0) from GET /api/auth/me | VERIFIED | `authService.ts:43` — `balance: 1000` in `db.insert(users).values({...})` with CURR-01 comment |
| 2  | POST /api/wallet/bonus exists and requires a valid Bearer token (401 without auth) | VERIFIED | `wallet.ts:14` — `walletRouter.post('/bonus', requireAuth, ...)` |
| 3  | WalletService.deductBet() uses SELECT FOR UPDATE inside db.transaction() | VERIFIED | `walletService.ts:25-31` — `db.transaction(async (tx) => { ... .for('update') })`, confirmed 3 occurrences total |
| 4  | WalletService.settleBet() credits winnings and appends to game_logs in one atomic transaction | VERIFIED | `walletService.ts:67-109` — single `db.transaction()` that updates balance AND `tx.insert(gameLogs)` |
| 5  | Balance displays as coin icon + abbreviated number in the persistent header on every page | VERIFIED | `Header.tsx` renders `<BalanceDisplay />` in sticky header; `BalanceDisplay.tsx:27-29` renders `🪙 <motion.span>{display}</motion.span>` using `Intl.NumberFormat` compact |
| 6  | Balance animates smoothly (spring count-up/count-down) when the value changes | VERIFIED | `BalanceDisplay.tsx:15-22` — `useSpring(balance ?? 0, { mass: 0.8, stiffness: 75, damping: 15 })` + `useEffect` calling `spring.set(balance)` |
| 7  | Clicking the balance display navigates to /profile | VERIFIED | `Header.tsx:26` — `<Link to="/profile">` wrapping `<BalanceDisplay />` |
| 8  | Dashboard shows a prominent DailyBonusCard with Claim button or countdown timer | VERIFIED | `DashboardPage.tsx:52-54` renders `<DailyBonusCard dailyBonusTimestamp={...} />`; card has conditional claim button or countdown display |
| 9  | Claiming the daily bonus shows a toast 'Bonus claimed! +100 coins' and updates balance immediately | VERIFIED | `DailyBonusCard.tsx:75-77` — `useBalanceStore.getState().setBalance(res.data.newBalance)` + `toast.success('Bonus claimed! +100 coins')` |
| 10 | Second claim attempt within 24h shows countdown timer | VERIFIED | `DailyBonusCard.tsx:80-84` — 429 response updates `nextClaimAt`, countdown interval fires every 1s |
| 11 | Balance initializes from GET /api/auth/me on session restore | VERIFIED | `AuthContext.tsx:40-43` — after refresh, chains `.then()` to `apiClient.get('/auth/me')` and calls `setBalance(meRes.data.balance)` |
| 12 | Balance is cleared (null) on sign-out | VERIFIED | `AuthContext.tsx:90` — `signOut` calls `useBalanceStore.getState().clearBalance()` |
| 13 | POST /api/wallet/bet deducts, resolves with crypto.randomInt, credits winnings, logs to game_logs, returns { outcome, profit, newBalance } | VERIFIED | `wallet.ts:43-73` — full pipeline: `validateBet` → `deductBet` → `randomInt(0, 2)` → `settleBet` → `res.json({ outcome, profit, newBalance })` |
| 14 | A bet of 0 or negative is rejected with 400 before any balance change | VERIFIED | `validateBet.ts:4-8` — `z.number().int().min(1, 'Minimum bet is 1 coin')` returns 400 before handler body executes |

**Score:** 14/14 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/services/walletService.ts` | deductBet, settleBet, claimDailyBonus — all SELECT FOR UPDATE | VERIFIED | All three functions use `db.transaction()` + `.for('update')`; 3 lock sites confirmed |
| `apps/backend/src/routes/wallet.ts` | POST /api/wallet/bonus route (requireAuth-gated) | VERIFIED | Route exists at line 14; walletRouter exported |
| `apps/backend/src/app.ts` | walletRouter mounted at /api/wallet | VERIFIED | `app.use('/api/wallet', walletRouter)` at line 32 |
| `apps/backend/src/services/authService.ts` | register() sets balance: 1000 | VERIFIED | Line 43: `balance: 1000, // CURR-01` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/frontend/src/stores/balanceStore.ts` | Zustand store with balance: number\|null, setBalance(n), clearBalance() | VERIFIED | Zustand v5 double-parens pattern; exports `useBalanceStore` |
| `apps/frontend/src/components/Header.tsx` | Persistent header with BalanceDisplay top-right | VERIFIED | Sticky header, imports and renders `<BalanceDisplay />`; linked to /profile |
| `apps/frontend/src/components/BalanceDisplay.tsx` | Framer Motion spring animated coin counter | VERIFIED | `useSpring`, `useTransform`, `motion.span`, `Intl.NumberFormat` compact present |
| `apps/frontend/src/components/DailyBonusCard.tsx` | Bonus claim card with Claim button / countdown / toast feedback | VERIFIED | Countdown via `setInterval`, claim calls `/wallet/bonus`, toast on success and 429 |
| `apps/frontend/src/pages/DashboardPage.tsx` | Home page with DailyBonusCard, fetches /auth/me | VERIFIED | Fetches `/auth/me` on mount, passes `dailyBonusTimestamp` to `DailyBonusCard` |
| `apps/frontend/src/contexts/AuthContext.tsx` | setBalance on session restore and signIn; clearBalance on signOut | VERIFIED | setBalance called in mount refresh chain AND in `null→value` token transition effect; clearBalance in signOut and session-expired handler |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/routes/wallet.ts` | POST /api/wallet/bet endpoint added | VERIFIED | Route at line 43: `walletRouter.post('/bet', requireAuth, validateBet, ...)` |
| `apps/backend/src/middleware/validateBet.ts` | Express middleware validating betAmount is integer >= 1 | VERIFIED | Zod schema with `.int().min(1)`, returns 400 on failure |
| `packages/shared/src/index.ts` | BetRequest and BetResponse shared types | VERIFIED | Both interfaces exported at lines 19 and 24 |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `routes/wallet.ts` | `services/walletService.ts` | `import claimDailyBonus` | WIRED | Line 5: `import { claimDailyBonus, deductBet, settleBet } from '../services/walletService.js'` |
| `app.ts` | `routes/wallet.ts` | `app.use('/api/wallet', walletRouter)` | WIRED | Lines 7 and 32 of app.ts |
| `walletService.ts` | `db/schema.ts` | `.for('update')` inside `db.transaction()` | WIRED | 3 confirmed `.for('update')` calls, 0 instances of `noWait`/`skipLocked` |

### Plan 02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `AuthContext.tsx` | `balanceStore.ts` | `useBalanceStore.getState().setBalance(data.balance)` | WIRED | Lines 43 and 57 call `setBalance`; line 71 and 90 call `clearBalance` |
| `Header.tsx` | `BalanceDisplay.tsx` | `renders <BalanceDisplay />` | WIRED | Line 2 imports, line 27 renders `<BalanceDisplay />` |
| `DailyBonusCard.tsx` | `balanceStore.ts` | `useBalanceStore.getState().setBalance(newBalance)` | WIRED | Line 75: `useBalanceStore.getState().setBalance(res.data.newBalance)` |

### Plan 03 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `routes/wallet.ts` | `services/walletService.ts` | `deductBet` and `settleBet` in bet handler | WIRED | Lines 49 and 57 call both functions inside the /bet handler |
| `routes/wallet.ts` | `middleware/validateBet.ts` | `validateBet` on POST /bet route | WIRED | Line 4 imports, line 43 places it as middleware |
| `services/walletService.ts` | `db/schema.ts` | `settleBet` inserts `gameLogs` row | WIRED | Lines 2 and 99-106: imports `gameLogs` and `tx.insert(gameLogs).values(...)` |

---

## Requirements Coverage

| Requirement | Description | Source Plan | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CURR-01 | New users receive starting balance (~50-100 min bets) | 03-01 | SATISFIED | `authService.ts:43` — `balance: 1000` (1000 min bets at 1 coin each) |
| CURR-02 | User can claim daily bonus once per 24h from dashboard | 03-02 | SATISFIED | `DailyBonusCard.tsx` + `/api/wallet/bonus` with 24h cooldown enforcement |
| CURR-03 | Balance visible in persistent header/sidebar on every page | 03-02 | SATISFIED | `Header.tsx` is rendered inside `DashboardPage`; sticky positioning ensures always-visible |
| CURR-04 | Balance updates after each game round without page refresh | 03-02 | SATISFIED | `useBalanceStore.getState().setBalance(n)` called after bonus claim and dashboard fetch; store is reactive |
| GINF-01 | All games deduct bet before play begins | 03-01, 03-03 | SATISFIED | `deductBet()` called before `randomInt` in `/bet` handler; `INSUFFICIENT_FUNDS` → 402 |
| GINF-02 | Game outcomes use cryptographically secure RNG (server-side only) | 03-03 | SATISFIED | `randomInt` from `node:crypto` used; `Math.random()` in `authService.ts` is username generation — not game resolution code |
| GINF-03 | Winnings credited after outcome resolved server-side | 03-01, 03-03 | SATISFIED | `settleBet()` credits `profit` to balance inside `db.transaction()` |
| GINF-04 | Every round logs: UserID, GameType, BetAmount, Outcome, Profit, Timestamp | 03-01, 03-03 | SATISFIED | `walletService.ts:99-106` — `tx.insert(gameLogs).values({ userId, gameType, betAmount, outcome, profit, balanceAfter })` with `createdAt` defaulting to `now()` |
| GINF-05 | Minimum/maximum bet limits enforced before play | 03-03 | SATISFIED | `validateBet.ts` rejects `betAmount < 1` with 400 before handler body; `deductBet` also validates `betAmount >= MIN_BET` (defence-in-depth) |

**All 9 Phase 3 requirements satisfied.**

No orphaned requirements detected — REQUIREMENTS.md traceability table lists exactly CURR-01..04 and GINF-01..05 as Phase 3, matching the requirement IDs declared across all three plans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Assessment |
|------|------|---------|----------|------------|
| `BalanceDisplay.tsx` | 24 | `return null` | Info | Guard for `balance === null` initial state — intentional, not a stub |
| `DailyBonusCard.tsx` | 33, 39 | `return null` | Info | Guard in `computeNextClaimAt` helper — pure function, not a stub |
| `authService.ts` | 13 | `Math.random()` | Info | Used for username suffix derivation only — not game resolution code; GINF-02 explicitly noted this in SUMMARY-03 |

No blockers or warnings found. All `return null` instances are valid guards, not implementation stubs.

---

## Human Verification Required

### 1. Balance Animation Quality

**Test:** Log in with a freshly registered account. Place a bet (requires DB running). Observe the header balance counter after the bet resolves.
**Expected:** Balance smoothly animates up or down using a spring transition (not an instant snap).
**Why human:** Cannot verify animation visual quality from file content alone; framer-motion wiring is present but rendering behaviour requires a browser.

### 2. DailyBonusCard Countdown Accuracy

**Test:** Claim a daily bonus. Observe the countdown timer display. Wait 60 seconds and confirm the countdown value decreases correctly.
**Expected:** Countdown shows e.g. "23h 59m" and ticks down every second. Format switches to "Xm Xs" format when under 1 hour.
**Why human:** setInterval countdown logic is present in code; visual rendering and accuracy require runtime observation.

### 3. Balance Clears on Sign-Out

**Test:** Sign in, observe balance displayed. Click sign out. Sign in as a different user.
**Expected:** No stale balance from previous user appears between logout and next login (balance should be null/hidden between sessions).
**Why human:** Requires session lifecycle testing across two browser login sessions.

### 4. POST /api/wallet/bet Concurrency (10 simultaneous requests)

**Test:** With a balance of 1000 and betAmount=1000, fire 10 concurrent POST /api/wallet/bet requests.
**Expected:** Exactly 1 returns 200, 9 return 402 INSUFFICIENT_FUNDS — no double-spend.
**Why human:** SELECT FOR UPDATE logic is verified in code; proving atomicity under real concurrent load requires a running DB and load testing tool (e.g. curl --parallel or Artillery).

---

## Additional Notes

- `Math.random()` appears in `authService.ts:13` for username suffix generation only. This is not game resolution code and is GINF-02 compliant per the plan's documented decision.
- CURR-03 ("balance visible on every page") is technically satisfied for all routes that render `DashboardPage`. However, non-dashboard pages (e.g. `/login`, `/register`) do not render `Header`. This is correct behaviour — the header is only meaningful post-authentication — but worth noting for future authenticated pages added in Phases 4-7.
- The TypeScript compile passes with zero errors for both `backend` and `frontend` packages (verified via `pnpm --filter <pkg> exec tsc --noEmit`).
- All 10 commits documented across the three SUMMARY files have been confirmed present in the git log (`078520b`, `882b376`, `760a29d`, `339b142`, `87d4277`, `e5b8ae2`).

---

_Verified: 2026-03-02_
_Verifier: Claude (gsd-verifier)_
