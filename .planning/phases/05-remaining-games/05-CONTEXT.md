# Phase 5: Remaining Games - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the three remaining v1 games — Plinko (stateless), Mines (session state), and Blackjack (multi-step session) — in complexity order. All three inherit the shared infrastructure established in Phase 4: ChipRack (10/50/100/500/Max chips), Half/Double/last-bet prefill, win/loss sound system, HowToPlayModal, ResultOverlay, and the dark theme. No new shared infrastructure is added in this phase.

Leaderboards, WebSocket push, and player profiles are Phase 6+.

</domain>

<decisions>
## Implementation Decisions

### Plinko — Animation
- Deterministic path animation — server picks the final bucket; frontend pre-computes a plausible zig-zag path through the pegs and animates the ball along it
- No physics engine (no Matter.js or Rapier) — keeps the build light; a convincing animated path is sufficient
- Ball must visibly travel through the peg field before landing in the final slot (PLNK-02)

### Plinko — Board Configuration
- Row count: slider from 8 to 16 rows (all integer values between 8 and 16 inclusive)
- Board redraws live as the slider moves — number of pegs and buckets updates immediately
- Risk levels: Low / Medium / High / Expert (matching Stake.com's four-level system)
- Risk level + row count together determine the multiplier distribution for the buckets
- Multiplier table: use Stake.com's published payout tables as reference for all four risk levels across all row counts

### Plinko — Session Model
- Stateless (like Roulette): client sends { betAmount, rows, riskLevel }; server resolves bucket and returns { bucket, multiplier, profit, newBalance }
- No server-side session required

### Mines — Grid & Configuration
- Fixed 5×5 grid (25 tiles) — not configurable
- Mine count: player selects 1–24 mines before starting (full range, like Stake.com)
- At 24 mines: only 1 safe tile — high risk, high reward

### Mines — Gameplay & Session
- Round start: client sends { betAmount, mineCount } → server generates mine grid server-side, stores in game_sessions table, returns sessionId only (grid hidden)
- Tile click: client sends { sessionId, row, col } → server validates coordinates, returns { hit: boolean, gem: boolean, currentMultiplier, tilesRevealed }
- Cash out: client sends { sessionId } → server returns { payout, newBalance, mineGrid } (reveal full grid on cashout)
- Mine hit: server returns { hit: true, mineGrid } — round ends, bet lost, full grid revealed
- Cash Out button: visually prominent during active round, displays live multiplier value (MINE-04)

### Mines — Mid-Round Page Refresh
- Board restores seamlessly from server state — no prompt, no confirmation
- Already-revealed tiles show gem icons, unrevealed tiles remain clickable
- Cash Out button reactivates with the current multiplier
- Backend endpoint: GET /api/games/mines/active-session → returns current board state (revealed tiles only, mine positions still hidden)

### Blackjack — Rules
- Standard casino rules: dealer stands on soft 17
- Natural blackjack pays 3:2 (1.5× the bet amount)
- Double down: allowed on any first two cards (no restriction to 9/10/11)
- No split action (deferred to v2 per GAME-V2-04)
- No insurance
- Standard 52-card deck; shuffled between hands

### Blackjack — Card Visuals
- Simple styled cards: clean white/red card faces, suit symbols (♠ ♥ ♦ ♣), rank text
- CSS-only implementation — no card imagery needed
- Cards animate on deal (CSS flip or slide-in animation)
- Hand totals displayed for both player and dealer (BJK-04)
- Dealer's second card is face-down until dealer turn begins

### Blackjack — Session & Disconnect
- Multi-step session stored in game_sessions table: deal → player turn → dealer turn → settled
- If user navigates away or disconnects with an active hand: server auto-completes the player's hand using basic strategy (hit on hard ≤16, stand on hard 17+, hit on soft ≤17, double not triggered by auto-play)
- On return to the Blackjack page with an unresolved session: show the completed hand result immediately

### Cross-Game Consistency
- No history sidebar for Plinko, Mines, or Blackjack — history is Phase 6+ (leaderboards/stats)
- Sound system: reuse Roulette's two tones — win chime and loss low tone — for all three games
- Mute toggle persists per-game in localStorage (same pattern as Roulette's `isMuted_roulette`)
- Each game gets its own Zustand store (plinkoStore, minesStore, blackjackStore) following the rouletteStore pattern

### Claude's Discretion
- Exact multiplier bucket values for each Plinko risk level / row combination (use Stake.com tables as reference)
- Plinko ball path generation algorithm (random left/right at each row, weighted toward center for realism)
- Mines multiplier formula (standard provably fair formula: `(25 - mines) / (25 - mines - tilesRevealed)` compound growth)
- Blackjack basic strategy table completeness (edge cases like soft hands, pairs — follow standard basic strategy chart)
- CSS card flip/deal animation details
- Exact visual layout of Plinko board (peg spacing, bucket sizing, multiplier labels below buckets)
- localStorage key naming for mute state per game

</decisions>

<specifics>
## Specific Ideas

- "Like Stake does" — Stake.com is the explicit reference for Plinko risk levels + row counts and Mines mine-count range. Match Stake's UX patterns where possible.
- Mines Cash Out button must display the live multiplier value (e.g. "Cash Out 2.45×") and be visually prominent — user called this out explicitly (MINE-04)
- Blackjack auto-play on disconnect should be silent and instant — user returns to see the resolved hand, not a loading state
- Plinko board redraws live as the row slider moves — the board should feel responsive to the configuration controls

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChipRack.tsx`: plug in directly — accepts `onSpin`/`disabled`/`spinDisabled`/`totalBet`/`showingResult` props; works for all three games with minimal adaptation
- `HowToPlayModal.tsx`: reuse for all three games — accepts `isOpen`/`onClose` props
- `ResultOverlay.tsx`: reuse for Plinko and Blackjack end-of-round summary; Mines has its own mine-reveal moment but can use overlay for final result
- `useGameSounds` hook: reuse win/loss sounds — same `{ playWin, playLoss }` API, same `isMuted` pattern
- `Header.tsx`: import directly into each game page — already includes balance display + Sign Out
- `GameCard.tsx` + `DashboardPage.tsx`: flip `available: false → true` and add routes for all three games when built
- `requireAuth` middleware: wire into all new game routes
- `deductBet` + `settleBet` (walletService): Plinko uses the same stateless pattern as Roulette; Mines uses deductBet on round start, settleBet on cashout/mine-hit; Blackjack uses deductBet on deal, settleBet on hand resolution
- `gamesRouter` (`apps/backend/src/routes/games.ts`): add new routes to the existing router — `/plinko/bet`, `/mines/start`, `/mines/tile`, `/mines/cashout`, `/mines/active-session`, `/blackjack/deal`, `/blackjack/hit`, `/blackjack/stand`, `/blackjack/double`
- `game_sessions` table: already in schema (Phase 1) — used for Mines and Blackjack server-side state
- `balanceStore.getState().setBalance(newBalance)`: call after each resolved round to update header balance

### Established Patterns
- `crypto.randomInt` for all RNG — never `Math.random()` (GINF-02)
- `db.transaction() + .for('update')` for all balance mutations
- `deductBet` before play starts, `settleBet` after outcome determined — applies to all three games
- Dark theme: `#0d0d1a` page background, `#1a1a2e` card/panel background, `#7c3aed` accent/buttons, `#e0d7ff` primary text, `#718096` secondary text
- Zustand store per game, colocated in `apps/frontend/src/stores/`
- localStorage for mute state and last-bet prefill (key: `lastBet_{game}`)
- Game phase state machine: `'betting' | 'active' | 'result'` (Mines adds `'active'` for in-progress round)
- `apiClient` for all frontend → backend calls

### Integration Points
- `DashboardPage.tsx`: set `available: true` and add routes for plinko, mines, blackjack in the GAMES array
- `App.tsx`: add three new protected routes (`/games/plinko`, `/games/mines`, `/games/blackjack`)
- `apps/backend/src/app.ts`: gamesRouter already registered — new routes added to existing router file
- `game_sessions` table: Mines rounds and Blackjack hands both use this table for server-side state persistence

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-remaining-games*
*Context gathered: 2026-03-03*
