# Phase 3: Wallet & Currency - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The virtual coin economy — users start with coins, earn a daily bonus once per 24 hours, and every bet deduction/credit is atomic with no race condition possible. This phase delivers: WalletService backend with SELECT FOR UPDATE atomicity, starting balance on registration, daily bonus endpoint with 24-hour gate, balance read API, persistent header balance display (React), and the bet deduct/credit pipeline with server-side RNG setup.

Creating/playing actual games is Phase 4+. Leaderboards and WebSocket push are Phase 6. Admin controls are Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Balance header display
- Format: coin icon + abbreviated number — 🪙 1.25M (not full digits, not plain text)
- Position: top-right of the persistent header, always visible on every page
- Change animation: animated count-up (win) / count-down (loss) to new value — not a flash, not silent
- Clickable: yes — links to the player profile/stats page

### Daily bonus UX
- Presentation: prominent card/banner on the dashboard with a large Claim button — hard to miss
- Already-claimed state: countdown timer showing time until next claim (e.g., "Next bonus in 14h 32m")
- Success feedback: simple toast notification — "Bonus claimed! +100 coins"
- Bonus amount: fixed flat amount every day (no streaks, no random range — streak mechanics are a future phase)

### Coin economy values
- Minimum bet: 1 coin (finest granularity)
- Starting balance: 1,000 coins (1,000× minimum bet — comfortable new-player cushion, well above the ≥50 minimum-bet success criterion)
- Daily bonus: 100 coins (10% of starting balance)
- Maximum bet: uncapped — players can bet their entire balance

### Balance refresh strategy
- After a bet resolves: optimistic update from the bet API response — the POST /bet endpoint returns the new balance and the frontend updates the store directly (no polling, no extra roundtrip)
- Frontend state: separate React Context or Zustand store for balance — single responsibility, does not merge into auth state
- Initial balance on page load: included in the GET /api/me response (no separate wallet fetch on startup)
- Phase 6 WebSocket will later push balance updates into the same store without changing the store interface

### Claude's Discretion
- Exact balance store implementation (Context vs Zustand) — pick based on Phase 2 patterns already in the codebase
- Server-side RNG algorithm selection (crypto.randomInt or equivalent)
- Exact animation easing/duration for the count-up/count-down
- Error state handling for failed bet transactions (UI messaging)
- Toast library choice (or custom)

</decisions>

<specifics>
## Specific Ideas

- The animated count-up/count-down on balance change is a key UX moment — should feel satisfying, not jarring
- The daily bonus card should be visually prominent on the dashboard — this is the main engagement loop for returning users
- The balance store needs a clean `setBalance(n)` interface so Phase 6 WebSocket can push updates into it without refactoring

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-wallet-currency*
*Context gathered: 2026-03-02*
