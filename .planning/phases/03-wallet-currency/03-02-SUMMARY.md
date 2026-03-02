---
phase: 03-wallet-currency
plan: 02
subsystem: ui
tags: [zustand, framer-motion, sonner, react, balance-store, animated-counter, daily-bonus]

# Dependency graph
requires:
  - phase: 03-wallet-currency
    plan: 01
    provides: POST /api/wallet/bonus endpoint, claimDailyBonus service
  - phase: 02-auth-accounts
    provides: AuthContext, apiClient with Bearer token injection, GET /api/auth/me profile endpoint

provides:
  - balanceStore.ts — Zustand v5 store with setBalance(n)/clearBalance() interface
  - BalanceDisplay.tsx — framer-motion spring animated coin counter in header
  - Header.tsx — persistent sticky header with Virtual Casino logo and balance display
  - DailyBonusCard.tsx — claim button or live countdown, toast feedback, API wiring
  - DashboardPage.tsx — home page rendering Header + DailyBonusCard, fetches /auth/me on mount
  - AuthContext.tsx updated — setBalance on session restore and token acquisition, clearBalance on signOut

affects: [04-roulette, 05-plinko, 06-mines, 07-blackjack, 08-anti-cheat-admin]

# Tech tracking
tech-stack:
  added:
    - zustand@5.0.11 — client state management for balance
    - sonner@2.0.7 — toast notifications for bonus claim feedback
    - framer-motion@12.34.4 — spring animation for animated balance counter
  patterns:
    - useBalanceStore.getState().setBalance(n) for out-of-component balance mutations (AuthContext, DashboardPage, DailyBonusCard)
    - useBalanceStore((s) => s.balance) reactive subscription in BalanceDisplay component
    - Zustand v5 double-parens TypeScript pattern: create<State>()((set) => ...)
    - useSpring + useTransform from framer-motion for smooth numeric count-up/down animation
    - prevTokenRef pattern to detect accessToken null→value transition for balance initialization after signIn

key-files:
  created:
    - apps/frontend/src/stores/balanceStore.ts
    - apps/frontend/src/components/BalanceDisplay.tsx
    - apps/frontend/src/components/Header.tsx
    - apps/frontend/src/components/DailyBonusCard.tsx
    - apps/frontend/src/pages/DashboardPage.tsx
  modified:
    - apps/frontend/src/contexts/AuthContext.tsx
    - apps/frontend/src/main.tsx
    - apps/frontend/src/App.tsx
    - apps/frontend/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Zustand v5 double-parens TypeScript pattern required: create<BalanceState>()((set) => ...) — single parens causes TS inference failure in v5"
  - "Balance initialization uses prevTokenRef to detect null→value accessToken transition — avoids double-fetch during mount refresh (mount refresh already fetches /me)"
  - "DashboardPage fetches /api/auth/me on mount for dailyBonusTimestamp — keeps bonus state accurate without prop-drilling from AuthContext"
  - "DailyBonusCard manages its own nextClaimAt state initialized from dailyBonusTimestamp prop — component is self-contained with no global bonus state"
  - "/dashboard and / both render DashboardPage — header links to /dashboard for clean URL, wildcard catch-all still works"

patterns-established:
  - "Pattern: Balance mutations always via useBalanceStore.getState().setBalance(n) outside React components — consistent with Phase 6 WebSocket pattern"
  - "Pattern: Framer Motion spring animation for numeric values — use useSpring + useTransform, never react-countup (React 19 incompatible)"
  - "Pattern: Sonner toast for all user feedback on async actions — import { toast } from 'sonner', call toast.success/toast.error"

requirements-completed: [CURR-02, CURR-03, CURR-04]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 3 Plan 02: Frontend Wallet Layer Summary

**Zustand balance store with framer-motion spring counter in persistent header, daily bonus card with countdown timer, and AuthContext wired to initialize/clear balance on session lifecycle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T17:07:16Z
- **Completed:** 2026-03-02T17:09:52Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created `balanceStore.ts` (Zustand v5) — `setBalance(n)` and `clearBalance()` interface ready for Phase 6 WebSocket balance updates without refactoring
- Built `BalanceDisplay.tsx` with framer-motion `useSpring` + `useTransform` — smooth spring animation (not react-countup, which is React 19 incompatible); displays `🪙 1.25M` format via `Intl.NumberFormat` compact notation
- Built `DailyBonusCard.tsx` with live countdown timer (setInterval every 1s), claim button, and sonner toast feedback for success/429 cooldown/error states
- Wired `AuthContext.tsx` to call `setBalance` after session restore and after sign-in token acquisition, `clearBalance` on sign-out and session expiry
- Installed zustand@5, sonner@2, framer-motion@12 in frontend package

## Task Commits

Each task was committed atomically:

1. **Task 1: Zustand balance store, AuthContext wiring, and install dependencies** - `760a29d` (feat)
2. **Task 2: Header, BalanceDisplay, DailyBonusCard, DashboardPage, App routing** - `339b142` (feat)

**Plan metadata:** (docs commit — see final_commit below)

## Files Created/Modified

- `apps/frontend/src/stores/balanceStore.ts` — Zustand v5 store: balance, setBalance, clearBalance
- `apps/frontend/src/components/BalanceDisplay.tsx` — framer-motion spring animated coin counter with Intl.NumberFormat compact
- `apps/frontend/src/components/Header.tsx` — sticky header with logo link (/dashboard) and balance display link (/profile)
- `apps/frontend/src/components/DailyBonusCard.tsx` — bonus claim card with countdown, claim button, toast feedback, API wiring to POST /api/wallet/bonus
- `apps/frontend/src/pages/DashboardPage.tsx` — dashboard page fetching /auth/me, rendering Header + DailyBonusCard
- `apps/frontend/src/contexts/AuthContext.tsx` — added setBalance on refresh/token-acquire, clearBalance on signOut/session-expired
- `apps/frontend/src/main.tsx` — added Toaster from sonner (position top-right, richColors)
- `apps/frontend/src/App.tsx` — removed inline HomePage, added DashboardPage at / and /dashboard routes
- `apps/frontend/package.json` — added zustand, sonner, framer-motion dependencies
- `pnpm-lock.yaml` — updated lockfile

## Decisions Made

- Zustand v5 requires double-parens TypeScript pattern (`create<State>()((set) => ...)`) — single parens fails type inference for the store interface.
- Used `prevTokenRef` to detect `null → value` token transition in AuthContext to trigger a `/me` fetch after `signIn` — avoids double-fetching during the mount refresh (which already fetches `/me`).
- `DashboardPage` fetches `/api/auth/me` on mount to get `dailyBonusTimestamp` — this is the cleanest way to pass that value to `DailyBonusCard` without global bonus state or prop-drilling from AuthContext.
- Both `/` and `/dashboard` routes render `DashboardPage` — the header links to `/dashboard` for a clean URL while the wildcard catch-all still redirects unknown paths to `/`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Balance store (`useBalanceStore`) is ready for Phase 6 WebSocket integration — `setBalance(n)` can be called from a WebSocket message handler without any refactoring
- `DailyBonusCard` calls `POST /api/wallet/bonus` (built in Plan 01) — functional end-to-end once DB is running
- DB migration 0001 still pending from Phase 2 — must run `docker compose up -d && pnpm --filter backend db:migrate` before any live testing
- `/profile` route linked from BalanceDisplay will 404/redirect to `/` until Phase 7 (player profile page) — acceptable per plan

## Self-Check: PASSED

- FOUND: apps/frontend/src/stores/balanceStore.ts
- FOUND: apps/frontend/src/components/BalanceDisplay.tsx
- FOUND: apps/frontend/src/components/Header.tsx
- FOUND: apps/frontend/src/components/DailyBonusCard.tsx
- FOUND: apps/frontend/src/pages/DashboardPage.tsx
- FOUND commit 760a29d: feat(03-02): Zustand balance store, AuthContext wiring, and Toaster
- FOUND commit 339b142: feat(03-02): Header, BalanceDisplay, DailyBonusCard, DashboardPage, App routing
- TypeScript typecheck: zero errors (pnpm --filter frontend exec tsc --noEmit)
- useBalanceStore in AuthContext.tsx: present
- clearBalance in AuthContext.tsx: present
- useSpring in BalanceDisplay.tsx: present
- Intl.NumberFormat in BalanceDisplay.tsx: present
- sonner in DailyBonusCard.tsx: present
- Toaster in main.tsx: present
- DashboardPage in App.tsx: present

---
*Phase: 03-wallet-currency*
*Completed: 2026-03-02*
