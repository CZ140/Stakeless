# Phase 5: Remaining Games - Research

**Researched:** 2026-03-03
**Domain:** Casino game implementation — Plinko (stateless), Mines (session state), Blackjack (multi-step session)
**Confidence:** HIGH (architecture patterns draw directly from existing codebase; multiplier tables are MEDIUM from community sources cross-referenced)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plinko — Animation**
- Deterministic path animation — server picks the final bucket; frontend pre-computes a plausible zig-zag path through the pegs and animates the ball along it
- No physics engine (no Matter.js or Rapier) — keeps the build light; a convincing animated path is sufficient
- Ball must visibly travel through the peg field before landing in the final slot (PLNK-02)

**Plinko — Board Configuration**
- Row count: slider from 8 to 16 rows (all integer values between 8 and 16 inclusive)
- Board redraws live as the slider moves — number of pegs and buckets updates immediately
- Risk levels: Low / Medium / High / Expert (matching Stake.com's four-level system)
- Risk level + row count together determine the multiplier distribution for the buckets
- Multiplier table: use Stake.com's published payout tables as reference for all four risk levels across all row counts

**Plinko — Session Model**
- Stateless (like Roulette): client sends { betAmount, rows, riskLevel }; server resolves bucket and returns { bucket, multiplier, profit, newBalance }
- No server-side session required

**Mines — Grid & Configuration**
- Fixed 5×5 grid (25 tiles) — not configurable
- Mine count: player selects 1–24 mines before starting (full range, like Stake.com)
- At 24 mines: only 1 safe tile — high risk, high reward

**Mines — Gameplay & Session**
- Round start: client sends { betAmount, mineCount } → server generates mine grid server-side, stores in game_sessions table, returns sessionId only (grid hidden)
- Tile click: client sends { sessionId, row, col } → server validates coordinates, returns { hit: boolean, gem: boolean, currentMultiplier, tilesRevealed }
- Cash out: client sends { sessionId } → server returns { payout, newBalance, mineGrid } (reveal full grid on cashout)
- Mine hit: server returns { hit: true, mineGrid } — round ends, bet lost, full grid revealed
- Cash Out button: visually prominent during active round, displays live multiplier value (MINE-04)

**Mines — Mid-Round Page Refresh**
- Board restores seamlessly from server state — no prompt, no confirmation
- Already-revealed tiles show gem icons, unrevealed tiles remain clickable
- Cash Out button reactivates with the current multiplier
- Backend endpoint: GET /api/games/mines/active-session → returns current board state (revealed tiles only, mine positions still hidden)

**Blackjack — Rules**
- Standard casino rules: dealer stands on soft 17
- Natural blackjack pays 3:2 (1.5× the bet amount)
- Double down: allowed on any first two cards (no restriction to 9/10/11)
- No split action (deferred to v2 per GAME-V2-04)
- No insurance
- Standard 52-card deck; shuffled between hands

**Blackjack — Card Visuals**
- Simple styled cards: clean white/red card faces, suit symbols (♠ ♥ ♦ ♣), rank text
- CSS-only implementation — no card imagery needed
- Cards animate on deal (CSS flip or slide-in animation)
- Hand totals displayed for both player and dealer (BJK-04)
- Dealer's second card is face-down until dealer turn begins

**Blackjack — Session & Disconnect**
- Multi-step session stored in game_sessions table: deal → player turn → dealer turn → settled
- If user navigates away or disconnects with an active hand: server auto-completes the player's hand using basic strategy (hit on hard ≤16, stand on hard 17+, hit on soft ≤17, double not triggered by auto-play)
- On return to the Blackjack page with an unresolved session: show the completed hand result immediately

**Cross-Game Consistency**
- No history sidebar for Plinko, Mines, or Blackjack — history is Phase 6+
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

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLNK-01 | User can select bet amount, risk level (Low/Medium/High), and row count before dropping | Plinko store + config panel pattern documented; slider 8-16 rows |
| PLNK-02 | Ball animation follows a plausible physical path through pegs to the final slot | Deterministic path algorithm (pre-compute L/R at each row) documented in Architecture Patterns |
| PLNK-03 | Final slot determines payout multiplier; winnings applied after animation completes | Stateless backend pattern identical to Roulette; multiplier tables researched |
| MINE-01 | User can select bet amount and number of mines before starting a round | Mines store + config panel pattern; mineCount 1-24 |
| MINE-02 | User clicks tiles; safe tile reveals gem and increases multiplier; mine tile ends round | Session state machine: betting → active → result documented |
| MINE-03 | User can cash out at any point during active round | POST /mines/cashout endpoint pattern documented; settleBet integration |
| MINE-04 | Cash Out button visually prominent, displays current multiplier value | UI pattern: live multiplier in button label ("Cash Out 2.45×") documented |
| MINE-05 | Mine grid state stored server-side; client sends tile coordinates, server validates and returns outcome | game_sessions table already in schema; JSON state encoding pattern documented |
| BJK-01 | User can play Blackjack single-player vs dealer AI | Full session lifecycle (deal → player turn → dealer turn → settled) documented |
| BJK-02 | User can Hit, Stand, or Double Down | Three endpoints: /hit, /stand, /double; action lock during dealer turn documented |
| BJK-03 | Game uses standard 52-card deck; dealer stands on soft 17 | Deck representation, shuffle, hand value calculation documented; soft 17 rule included |
| BJK-04 | Cards animate on deal; hand totals displayed for player and dealer | CSS flip animation pattern; Framer Motion slide-in alternative; hand total algorithm |
</phase_requirements>

---

## Summary

Phase 5 delivers three games in complexity order: Plinko (stateless, like Roulette), Mines (single session with mid-round state), and Blackjack (multi-step session with dealer AI). All three games inherit the full Phase 4 shared infrastructure without modification — ChipRack, HowToPlayModal, ResultOverlay, useGameSounds, Header, requireAuth, deductBet/settleBet are drop-in reuse.

The primary technical challenges are: (1) Plinko's deterministic path animation — pre-computing a convincing L/R path through pegs given a known final bucket, then animating it with CSS transitions; (2) Mines' session state management — the game_sessions table already exists with a JSON `state` column, so the pattern is store-and-retrieve; and (3) Blackjack's multi-step server state machine with automatic hand completion on disconnect. All three pattern onto systems already built.

The most important constraint is that ChipRack is tightly coupled to rouletteStore (it calls `useRouletteStore` directly inside the component). For Plinko/Mines/Blackjack, either ChipRack must be refactored to accept a store prop, or each game page must provide an adapter layer. This is the single highest-risk reuse assumption from CONTEXT.md and must be resolved in Wave 0 of planning.

**Primary recommendation:** Build in order Plinko → Mines → Blackjack. Each game follows the same three-file pattern: `{game}Store.ts`, `{game}Service.ts`, `{Game}Page.tsx`. Add routes to games.ts and App.tsx last.

---

## Standard Stack

### Core (all already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | Component framework | Project standard |
| Zustand | ^5.0.11 | Per-game state store | Project standard; rouletteStore is the template |
| Framer Motion | ^12.34.4 | Card animations, overlays | Already used in ResultOverlay, HowToPlayModal |
| GSAP | ^3.14.2 | Plinko ball path animation | Already installed; smoother than CSS transitions for path animation |
| @gsap/react | ^2.1.2 | React integration for GSAP | Already installed |
| Zod | ^3.22.0 | Request validation | Project standard; used in all game routes |
| Drizzle ORM | ^0.45.0 | DB queries / transactions | Project standard; game_sessions table already in schema |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` randomInt | built-in | Server-side RNG | All game outcome generation (GINF-02) |
| `framer-motion` AnimatePresence | included | ResultOverlay, card deal slide-in | For Plinko result overlay and Blackjack card deal |
| Web Audio API | browser built-in | Win/loss sounds | useGameSounds hook already handles this |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GSAP for Plinko animation | CSS `transition` / `@keyframes` | CSS is simpler but animating along a computed path with variable speed per segment is much cleaner in GSAP's `.to()` timeline |
| Framer Motion for card deal | CSS `@keyframes` rotateY | Both work; Framer Motion is already imported so use it — pure CSS `rotateY` is also fine and avoids an import |
| game_sessions JSON state | separate columns per game | JSON in `state` column (already in schema) avoids migrations; correct choice for v1 |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended File Structure for Phase 5

```
apps/frontend/src/
├── pages/
│   ├── PlinkoPage.tsx          # new — Plinko game page
│   ├── MinesPage.tsx           # new — Mines game page
│   └── BlackjackPage.tsx       # new — Blackjack game page
├── stores/
│   ├── plinkoStore.ts          # new — follows rouletteStore pattern
│   ├── minesStore.ts           # new — includes sessionId, revealedTiles
│   └── blackjackStore.ts       # new — includes hand state, session
└── components/
    ├── PlinkoBoard.tsx         # new — renders pegs, buckets, animates ball
    ├── MinesGrid.tsx           # new — 5x5 tile grid
    └── BlackjackTable.tsx      # new — dealer + player hands, action buttons

apps/backend/src/
├── routes/
│   └── games.ts               # extend existing — add all new routes
└── services/
    ├── plinkoService.ts        # new — bucket resolution, multiplier lookup
    ├── minesService.ts         # new — grid generation, tile validation, cashout
    └── blackjackService.ts    # new — deck, hand value, dealer AI, session CRUD
```

### Pattern 1: Stateless Game (Plinko — mirrors Roulette)

**What:** Client sends bet params → server generates outcome atomically → returns result. No server state between rounds.
**When to use:** Plinko (outcome is single-shot, no mid-round decisions)

```typescript
// apps/backend/src/routes/games.ts — add after roulette route
const plinkoSchema = z.object({
  betAmount: z.number().int().min(1),
  rows: z.number().int().min(8).max(16),
  riskLevel: z.enum(['low', 'medium', 'high', 'expert']),
});

gamesRouter.post('/plinko/bet', requireAuth, async (req, res) => {
  const parsed = plinkoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid params' });
    return;
  }
  const { betAmount, rows, riskLevel } = parsed.data;
  const userId = req.user!.id;

  try {
    await deductBet(userId, betAmount, 'plinko');

    // Resolve: pick bucket index (0 to rows inclusive = rows+1 buckets)
    const bucket = resolvePlinkoBucket(rows); // crypto.randomInt weighted by binomial distribution
    const multiplier = PLINKO_MULTIPLIERS[riskLevel][rows][bucket];
    const profit = Math.floor(betAmount * multiplier) - betAmount; // net profit (negative on loss)

    const { newBalance } = await settleBet(
      userId,
      Math.max(0, profit + betAmount), // settleBet adds back; profit = winnings - stake
      betAmount,
      `bucket_${bucket}`,
      'plinko',
    );

    res.json({ bucket, multiplier, profit, newBalance });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'INSUFFICIENT_FUNDS') { res.status(402).json({ error: 'Insufficient funds' }); return; }
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});
```

**Note on settleBet:** The existing `settleBet` takes `profit` as net winnings to add back. For a losing Plinko bet (multiplier < 1): `deductBet` already took the full stake; `settleBet` must add back `Math.floor(betAmount * multiplier)` (the partial return). For a winning bet: add back `Math.floor(betAmount * multiplier)`. The `profit` param to `settleBet` is the amount credited back to balance. Review carefully — the roulette pattern uses `profit = totalWinnings` (zero on full loss, positive on win). Plinko with <1x multipliers returns a partial stake, so the `profit` param = `Math.floor(betAmount * multiplier)`.

### Pattern 2: Session State Game (Mines)

**What:** Round start creates a row in `game_sessions`; each tile click reads and mutates that row; cashout/mine-hit completes the row.
**When to use:** Mines (player makes sequential decisions mid-round)

```typescript
// Session state shape stored as JSON in game_sessions.state
interface MinesSessionState {
  mineCount: number;
  minePositions: number[];          // flat indices 0-24; hidden from client until end
  revealedTiles: number[];          // flat indices of revealed safe tiles
  tilesRevealed: number;
  currentMultiplier: number;
  status: 'active' | 'cashed_out' | 'hit_mine';
}

// POST /api/games/mines/start
gamesRouter.post('/mines/start', requireAuth, async (req, res) => {
  const parsed = minesStartSchema.safeParse(req.body);
  // ... validate
  const { betAmount, mineCount } = parsed.data;

  // Generate mine positions server-side using crypto.randomInt
  const minePositions = generateMinePositions(mineCount); // 25 tiles, pick mineCount positions

  const state: MinesSessionState = {
    mineCount,
    minePositions,
    revealedTiles: [],
    tilesRevealed: 0,
    currentMultiplier: 1.0,
    status: 'active',
  };

  await deductBet(userId, betAmount, 'mines');

  const [session] = await db.insert(gameSessions).values({
    userId,
    gameType: 'mines',
    state: JSON.stringify(state),
    betAmount,
  }).returning();

  res.json({ sessionId: session.id }); // grid positions NOT returned
});

// POST /api/games/mines/tile
gamesRouter.post('/mines/tile', requireAuth, async (req, res) => {
  const { sessionId, tileIndex } = parsed.data; // tileIndex = row*5+col, 0-24

  const session = await getActiveSession(userId, sessionId);
  const state: MinesSessionState = JSON.parse(session.state);

  if (state.minePositions.includes(tileIndex)) {
    // Mine hit — end round, no payout
    state.status = 'hit_mine';
    await finalizeSession(session.id, state, 0, session.betAmount, 'mine_hit');
    res.json({ hit: true, mineGrid: state.minePositions });
  } else {
    // Safe tile — update multiplier
    state.revealedTiles.push(tileIndex);
    state.tilesRevealed++;
    state.currentMultiplier = calculateMinesMultiplier(state.mineCount, state.tilesRevealed);
    await db.update(gameSessions).set({ state: JSON.stringify(state), updatedAt: new Date() })
      .where(eq(gameSessions.id, session.id));
    res.json({ hit: false, gem: true, currentMultiplier: state.currentMultiplier, tilesRevealed: state.tilesRevealed });
  }
});
```

### Pattern 3: Multi-Step Session (Blackjack)

**What:** Session progresses through explicit phases: `'dealing' | 'player_turn' | 'dealer_turn' | 'settled'`. Each endpoint checks current phase and validates the action is legal.
**When to use:** Blackjack (player and dealer take turns; actions are phase-gated)

```typescript
interface BlackjackSessionState {
  deck: Card[];                    // remaining deck (already-dealt cards removed)
  playerHand: Card[];
  dealerHand: Card[];              // dealerHand[1] is face-down during player_turn
  phase: 'player_turn' | 'dealer_turn' | 'settled';
  result: 'win' | 'loss' | 'push' | 'blackjack' | null;
  payout: number;                  // 0 until settled
}

// POST /api/games/blackjack/deal — start new hand
// POST /api/games/blackjack/hit  — player hits
// POST /api/games/blackjack/stand — player stands → triggers dealer_turn
// POST /api/games/blackjack/double — player doubles (doubles bet, takes exactly one card, stands)
```

**Disconnect auto-complete:** On GET /blackjack/active-session, if session phase = 'player_turn', run autoPlayBasicStrategy() server-side, which applies: hit on hard ≤16, stand on hard 17+, hit on soft ≤17. Return the completed result immediately. This runs silently — no client-side prompt.

### Pattern 4: Plinko Path Animation (Deterministic)

**What:** Given final bucket index (0 = far left, rows = far right), pre-compute a sequence of L/R decisions at each peg row that leads to that bucket. Animate ball along computed waypoints.

**Algorithm:**
```typescript
// The bucket index after N rows equals the number of "right" decisions made.
// To land in bucket B after R rows: need exactly B right-turns out of R.
// Strategy: shuffle a list of B right-turns and (R-B) left-turns, then assign to rows.
function computePath(rows: number, bucket: number): ('L' | 'R')[] {
  const decisions: ('L' | 'R')[] = [
    ...Array(bucket).fill('R'),
    ...Array(rows - bucket).fill('L'),
  ];
  // Fisher-Yates shuffle using crypto.getRandomValues for randomness
  for (let i = decisions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // client-side — visual only, not RNG for outcome
    [decisions[i], decisions[j]] = [decisions[j]!, decisions[i]!];
  }
  return decisions;
}

// Then convert to pixel waypoints for GSAP timeline animation
function pathToWaypoints(decisions: ('L' | 'R')[], rows: number, boardGeometry: BoardGeometry) {
  const waypoints = [{ x: boardGeometry.dropX, y: boardGeometry.topY }];
  let x = boardGeometry.dropX;
  for (let row = 0; row < rows; row++) {
    x += decisions[row] === 'R' ? boardGeometry.pegSpacingX / 2 : -boardGeometry.pegSpacingX / 2;
    waypoints.push({ x, y: boardGeometry.topY + (row + 1) * boardGeometry.rowHeight });
  }
  return waypoints;
}
```

**GSAP animation using computed waypoints:**
```typescript
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
// Note: MotionPathPlugin requires GSAP Club or use staggered .to() calls instead

// Simpler approach: staggered .to() calls for each segment
const tl = gsap.timeline({ onComplete: onBallLanded });
waypoints.forEach((wp, i) => {
  if (i === 0) return;
  tl.to(ballRef.current, {
    x: wp.x,
    y: wp.y,
    duration: 0.12,   // ~120ms per row
    ease: 'power1.in',
  });
});
```

### Pattern 5: Blackjack Card Value Calculation

```typescript
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type Suit = 'S' | 'H' | 'D' | 'C';
interface Card { rank: Rank; suit: Suit; faceDown?: boolean; }

function cardValue(rank: Rank): number {
  if (rank === 'A') return 11; // handled separately
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function handValue(hand: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.faceDown) continue; // skip face-down dealer card in display
    if (card.rank === 'A') { aces++; total += 11; }
    else total += cardValue(card.rank);
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10; // convert ace from 11 to 1
    aces--;
    if (aces === 0) soft = false;
  }
  return { total, soft };
}

// Natural blackjack: two-card hand totaling 21
function isNaturalBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand).total === 21;
}
```

### Pattern 6: Dealer Auto-Play Basic Strategy (on disconnect)

```typescript
// Applied server-side when session is abandoned mid-hand
// Dealer stands on soft 17 (locked decision)
function dealerAutoComplete(state: BlackjackSessionState): BlackjackSessionState {
  // Step 1: Auto-play player hand first (if still in player_turn)
  while (state.phase === 'player_turn') {
    const { total, soft } = handValue(state.playerHand);
    if (total > 21) break; // bust
    if (total >= 17 && !soft) break; // stand on hard 17+
    if (total >= 18 && soft) break;  // stand on soft 18+
    // hit on hard ≤16, soft ≤17
    state.playerHand.push(state.deck.pop()!);
  }
  state.phase = 'dealer_turn';

  // Step 2: Reveal dealer hole card, run dealer turn
  // Dealer: hit until hard 17+ or soft 18+
  while (true) {
    const { total, soft } = handValue(state.dealerHand);
    if (total > 21) break; // dealer bust
    if (total >= 17 && !soft) break; // stand (dealer stands on soft 17 = locked rule)
    if (total >= 18 && soft) break;
    state.dealerHand.push(state.deck.pop()!);
  }
  state.phase = 'settled';
  state.result = resolveHandResult(state.playerHand, state.dealerHand);
  return state;
}
```

### Pattern 7: Mines Multiplier Formula

The standard provably fair formula for Mines (99% RTP, matching Stake.com):

```typescript
// compound growth: each safe tile pick multiplies the current multiplier
// Formula: product of (totalTiles - i) / (safeTiles - i) for i = 0..tilesRevealed-1, then × 0.99
function calculateMinesMultiplier(mineCount: number, tilesRevealed: number): number {
  const totalTiles = 25;
  const safeTiles = totalTiles - mineCount;
  let multiplier = 1.0;
  for (let i = 0; i < tilesRevealed; i++) {
    multiplier *= (totalTiles - i) / (safeTiles - i);
  }
  multiplier *= 0.99; // house edge (99% RTP)
  return Math.round(multiplier * 100) / 100; // round to 2 decimal places
}

// Examples:
// 3 mines, 1 gem:  25/22 * 0.99 = 1.13×
// 3 mines, 5 gems: (25/22) * (24/21) * (23/20) * (22/19) * (21/18) * 0.99 ≈ 2.10×
// 24 mines, 1 gem: 25/1 * 0.99 = 24.75× (one safe tile, extreme risk)
```

### Pattern 8: Mines Mine Position Generation

```typescript
import { randomInt } from 'node:crypto';

function generateMinePositions(mineCount: number): number[] {
  // Fisher-Yates partial shuffle: pick mineCount unique positions from 0-24
  const indices = Array.from({ length: 25 }, (_, i) => i);
  for (let i = 0; i < mineCount; i++) {
    const j = i + randomInt(0, 25 - i); // crypto.randomInt — never Math.random()
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices.slice(0, mineCount).sort((a, b) => a - b);
}
```

### Pattern 9: Plinko Bucket Resolution (Server)

```typescript
// Bucket follows binomial distribution: crypto.randomInt for each of the 'rows' decisions
// Equivalent to simulating the actual ball path on the server
function resolvePlinkoBucket(rows: number): number {
  let bucket = 0;
  for (let i = 0; i < rows; i++) {
    bucket += randomInt(0, 2); // 0=left, 1=right
  }
  return bucket; // 0 to rows inclusive
}
```

### Pattern 10: Mines Active Session Restore

```typescript
// GET /api/games/mines/active-session
// Returns active session data with revealed tiles (but NOT mine positions)
gamesRouter.get('/mines/active-session', requireAuth, async (req, res) => {
  const session = await db
    .select()
    .from(gameSessions)
    .where(and(
      eq(gameSessions.userId, req.user!.id),
      eq(gameSessions.gameType, 'mines'),
      isNull(gameSessions.completedAt),
    ))
    .limit(1);

  if (!session[0]) { res.json({ session: null }); return; }

  const state: MinesSessionState = JSON.parse(session[0].state);
  res.json({
    sessionId: session[0].id,
    mineCount: state.mineCount,
    revealedTiles: state.revealedTiles,
    currentMultiplier: state.currentMultiplier,
    betAmount: session[0].betAmount,
  });
  // NOTE: minePositions deliberately excluded
});
```

### Pattern 11: Zustand Store (Mines as template — most complex)

```typescript
// apps/frontend/src/stores/minesStore.ts
// Zustand v5 double-parens pattern (project standard from STATE.md decision)
import { create } from 'zustand';

export type MinesPhase = 'config' | 'active' | 'result';

interface MinesState {
  mineCount: number;
  betAmount: number;
  sessionId: number | null;
  revealedTiles: number[];        // flat indices 0-24 that are safe
  mineTiles: number[];            // populated only on game over
  tilesRevealed: number;
  currentMultiplier: number;
  gamePhase: MinesPhase;
  isMuted: boolean;
  // actions
  setMineCount: (n: number) => void;
  setBetAmount: (n: number) => void;
  startRound: (sessionId: number, mineCount: number) => void;
  revealTile: (tileIndex: number, multiplier: number) => void;
  hitMine: (mineGrid: number[]) => void;
  cashOut: (mineGrid: number[]) => void;
  restoreSession: (session: ActiveSessionData) => void;
  resetToConfig: () => void;
  toggleMute: () => void;
}
```

### ChipRack Coupling Issue (CRITICAL)

The existing `ChipRack.tsx` calls `useRouletteStore()` directly inside the component. This means it cannot be used as-is for Plinko/Mines/Blackjack which have their own stores.

**Resolution options (planner must choose):**

1. **Refactor ChipRack to accept store actions as props** — cleanest, but modifies Phase 4 code. Props: `selectedChip`, `setSelectedChip`, `halfBet`, `doubleBet`, `isMuted`, `toggleMute`. Rebet logic stays game-specific (passed in as prop or excluded).

2. **Create new SimpleChipRack per game** — avoids touching Phase 4 code. Copies ChipRack structure but uses local props. More files but zero regression risk.

3. **Create GenericChipRack that accepts a store interface** — intermediate; define a `ChipRackStore` interface, adapt rouletteStore to satisfy it.

**Recommendation:** Option 1 — refactor ChipRack to use props for store-sourced values. The roulette rebet logic is roulette-specific; pass `onRebet` as an optional prop. This eliminates duplication.

**Note for Mines:** Mines does NOT use ChipRack the same way as Roulette/Plinko. During an active round, the bet amount is locked (no chip selection). ChipRack shows only in the config phase, and is hidden during `active` and `result` phases.

### Anti-Patterns to Avoid

- **Revealing mine positions to client before round ends:** Never include `minePositions` in the tile-click response. Only include on cashout or mine-hit.
- **Using Math.random() for mine generation or bucket selection:** Always use `randomInt` from `node:crypto` (GINF-02).
- **Blocking the dealer turn on Blackjack:** Dealer play is synchronous server-side — do not add artificial delays server-side; let the frontend animate it.
- **Storing card state in frontend only:** All Blackjack card state lives in game_sessions; the frontend is just rendering server state.
- **Allowing tile clicks after round ends:** Validate `state.status === 'active'` on every tile endpoint call, reject otherwise.
- **Forgetting to mark game_sessions.completedAt:** Mines and Blackjack must set `completedAt` on the session when the round ends; this is what `active-session` endpoints use to filter.
- **Zustand v5 single-parens pattern:** Use `create<State>()((set) => ...)` — double parens. Single parens causes TS inference failure (STATE.md decision: Phase 03-wallet-currency P02).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plinko bucket probability weighting | Custom weighted random function | `crypto.randomInt(0,2)` per row, sum = bucket | Binomial distribution naturally emerges from per-peg coin flip; no manual weighting needed |
| Mines multiplier math | Custom formula | Standard formula: `∏(totalTiles-i)/(safeTiles-i) × 0.99` | Proven provably fair formula used by Stake.com and all major crypto casinos |
| Blackjack hand total | Custom parser | `handValue()` function with ace reduction loop | Ace as 11→1 reduction logic has edge cases (multiple aces, bust detection) — use the documented pattern |
| Session concurrency | Per-game locking | `db.transaction() + .for('update')` | Project standard; already used in walletService — extend same pattern to game_sessions reads |
| Card shuffle | Fisher-Yates with Math.random | Fisher-Yates with `crypto.randomInt` | Required by GINF-02; `Math.random()` is predictable |
| CSS card flip | External animation library | Framer Motion `rotateY` or pure CSS `@keyframes rotateY` | Framer Motion already imported; no new dependency needed |

**Key insight:** All three games' core math is well-established (binomial for Plinko, compound probability for Mines, standard card game rules for Blackjack). The implementation challenge is state management and UI, not the mathematics.

---

## Common Pitfalls

### Pitfall 1: settleBet profit semantics for multipliers < 1 (Plinko)

**What goes wrong:** Plinko with a low multiplier like 0.5x returns a partial stake. If `profit` is calculated as `betAmount * multiplier - betAmount` (negative), passing this negative value to `settleBet` credits nothing back and logs a loss incorrectly.
**Why it happens:** `settleBet` adds `profit` to the balance; a negative profit would subtract from balance again (double-deduct).
**How to avoid:** `profit` param to `settleBet` = the total amount to credit back = `Math.floor(betAmount * multiplier)`. For a 2x win: credit back `betAmount * 2`. For 0.5x: credit back `Math.floor(betAmount * 0.5)`. For 0x (total loss): credit back `0`.
**Warning signs:** Balance going doubly negative after low-multiplier Plinko drops.

### Pitfall 2: Stale game_sessions — orphaned active sessions

**What goes wrong:** Player starts a Mines or Blackjack round, gets an error mid-request, and the session is stuck in `active` state. Future calls to `start` or `deal` create duplicate sessions. `active-session` restore returns the corrupt session.
**Why it happens:** If `deductBet` succeeds but session insert fails (or vice versa), the state is inconsistent.
**How to avoid:** Wrap `deductBet` + `db.insert(gameSessions)` in the same transaction. If session creation fails, `deductBet` is rolled back. Only one active session per user per game type should be enforced (check before inserting).
**Warning signs:** User complains of "phantom" active sessions; balance deducted without a game starting.

### Pitfall 3: ChipRack coupled to rouletteStore

**What goes wrong:** Importing `ChipRack` in PlinkoPage throws an error or silently reads/writes to rouletteStore state instead of plinkoStore.
**Why it happens:** `ChipRack.tsx` has `import { useRouletteStore }` hardcoded.
**How to avoid:** Refactor ChipRack in Wave 1 (before Plinko implementation) to accept props for store-sourced values. Test that rouletteStore still works after refactor.
**Warning signs:** Bet amount changes in Plinko also affect Roulette's chip selection.

### Pitfall 4: Blackjack natural blackjack payout (3:2)

**What goes wrong:** Natural blackjack (two-card 21) pays 3:2 = 1.5× the bet. If the general win path pays `betAmount * 2` (even money), natural blackjack is underpaid.
**Why it happens:** Win detection doesn't distinguish natural blackjack from a regular 21.
**How to avoid:** Detect `isNaturalBlackjack(playerHand)` before the general win check. Also check `isNaturalBlackjack(dealerHand)` — if both have blackjack, it's a push.
**Warning signs:** Player reports 2x payout on two-card 21.

### Pitfall 5: Double-down bet deduction

**What goes wrong:** On double, the player doubles their bet and receives exactly one more card. The extra bet amount must be deducted from balance at the time of the double action, not at deal time.
**Why it happens:** `deductBet` is only called at deal time; the double action forgets to deduct the additional bet.
**How to avoid:** POST /blackjack/double calls `deductBet(userId, session.betAmount, 'blackjack')` again (doubling the total at risk). Store the doubled bet in session state.
**Warning signs:** Player doubles for "free" — extra chips not removed from balance.

### Pitfall 6: Plinko board not redrawing on slider change

**What goes wrong:** Changing the row count slider re-renders the board DOM but the peg/bucket layout is stale because the board dimensions were computed once on mount.
**Why it happens:** Board geometry calculated with `useEffect([])` (empty dep array) instead of `useEffect([rows])`.
**How to avoid:** Derive peg positions from `rows` as computed state, not cached on mount. `useMemo(() => computeBoardLayout(rows), [rows])`.
**Warning signs:** 8-row board shows 12-row peg layout after slider move.

### Pitfall 7: Mines tileIndex validation

**What goes wrong:** Client sends `tileIndex: -1` or `tileIndex: 25` or a tile that was already revealed. Server must validate all three cases.
**Why it happens:** Frontend bug or malicious request bypasses UI validation.
**How to avoid:** Server validates: `tileIndex >= 0 && tileIndex < 25 && !state.revealedTiles.includes(tileIndex)`. Return 400 on invalid.
**Warning signs:** Revealed tiles can be clicked again, potentially changing multiplier.

---

## Code Examples

Verified patterns from existing codebase:

### Existing rouletteStore Template for New Stores

```typescript
// Source: apps/frontend/src/stores/rouletteStore.ts (confirmed in project)
// All new stores MUST use Zustand v5 double-parens pattern:
export const usePlinkoStore = create<PlinkoState>()((set) => ({
  // ...state
}));
// Single parens: create<State>((set) => ...) — WRONG in Zustand v5, causes TS failure
```

### game_sessions Schema (Confirmed in codebase)

```typescript
// Source: apps/backend/src/db/schema.ts (confirmed)
export const gameSessions = pgTable('game_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  gameType: varchar('game_type', { length: 50 }).notNull(),
  state: text('state').notNull(), // JSON-encoded game state
  betAmount: bigint('bet_amount', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),  // null = active
});
// No status column — use completedAt IS NULL to check active status
```

### deductBet / settleBet Usage Pattern (Confirmed)

```typescript
// Source: apps/backend/src/routes/games.ts (roulette example, confirmed)
// Pattern: deduct → resolve → settle in same request handler
await deductBet(userId, totalBet, 'plinko');    // throws INSUFFICIENT_FUNDS
// ... resolve outcome ...
const { newBalance } = await settleBet(
  userId,
  profitToCredit,   // amount added back to balance (0 on total loss)
  betAmount,        // for logging
  outcomeString,    // varchar(50) max
  'plinko',
);
```

### CSS Card Flip Animation (Blackjack deal)

```typescript
// Using Framer Motion (already installed in project)
// Source: Framer Motion docs + existing ResultOverlay.tsx pattern
import { motion } from 'framer-motion';

// Card component with flip reveal
function Card({ rank, suit, faceDown }: CardProps) {
  return (
    <motion.div
      style={{ perspective: '600px', width: '60px', height: '90px' }}
    >
      <motion.div
        initial={{ rotateY: faceDown ? 180 : 0 }}
        animate={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}
      >
        {/* Front face */}
        <div style={{ backfaceVisibility: 'hidden', position: 'absolute', ... }}>
          {rank}{suit}
        </div>
        {/* Back face */}
        <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', ... }}>
          {/* Card back pattern */}
        </div>
      </motion.div>
    </motion.div>
  );
}
```

### Slide-in Deal Animation (Alternative to flip)

```typescript
// Simpler alternative: cards slide in from the deck position
<motion.div
  key={`card-${index}`}
  initial={{ x: -100, opacity: 0, rotate: -10 }}
  animate={{ x: 0, opacity: 1, rotate: 0 }}
  transition={{ delay: index * 0.15, duration: 0.3, ease: 'easeOut' }}
>
  <Card {...card} />
</motion.div>
```

---

## Plinko Multiplier Tables

**Confidence: MEDIUM** — Sourced from cross-referenced community documentation (bitcasinosrank.com analysis, onlineplinko.com review). Cannot verify exact Stake.com values without accessing the live game. Use as starting reference; adjust to match Stake.com exactly by checking the live game during implementation.

### Confirmed Anchor Values

| Rows | Risk | Min Multiplier (center) | Max Multiplier (edge) |
|------|------|------------------------|----------------------|
| 8    | Low  | 0.5×                   | 5.6×                 |
| 16   | Low  | 0.5×                   | 16×                  |
| 8    | Medium | 0.4×               | 13×                  |
| 16   | Medium | 0.3×               | 110×                 |
| 8    | High   | 0.2×               | 29×                  |
| 16   | High   | 0.2×               | 1000×                |
| 16   | Expert | ~0.2×              | 10,000× (Stake.us)   |

### Confirmed 8-Row Low Risk (Full Bucket Table)

| Bucket | 0 | 1 | 2 | 3 | 4 (center) | 5 | 6 | 7 | 8 |
|--------|---|---|---|---|------------|---|---|---|---|
| Multiplier | 5.6× | 2.1× | 1.1× | 1.0× | 0.5× | 1.0× | 1.1× | 2.1× | 5.6× |

**Source:** bitcasinosrank.com analysis, verified by multiple sources.

### Implementation Strategy for Remaining Combinations

For row counts 9-15 and risk levels not fully documented, interpolate linearly between the anchor values or implement the multiplier table as a data structure that can be updated during implementation. The CONTEXT.md instructs to use Stake.com's published tables as reference — verify against the live game during development.

```typescript
// PLINKO_MULTIPLIERS data structure (fill from Stake.com live game)
// Indexed: PLINKO_MULTIPLIERS[riskLevel][rows][bucketIndex]
// Bucket 0 = far left, bucket `rows` = far right (symmetric)
const PLINKO_MULTIPLIERS: Record<RiskLevel, Record<number, number[]>> = {
  low: {
    8:  [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],  // 9 buckets
    9:  [/* verify from Stake.com */],
    // ...
    16: [16, /* fill from Stake.com */, 16],               // 17 buckets
  },
  medium: { /* ... */ },
  high: { /* ... */ },
  expert: { /* ... */ },
};
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Physics engine for Plinko (Matter.js) | Deterministic path algorithm | Lighter build; locked decision to skip physics |
| Express session middleware for game state | PostgreSQL game_sessions table (already in schema) | No new infrastructure needed; already built in Phase 1 |
| Single monolithic game service | Per-game service files (plinkoService, minesService, blackjackService) | Clean separation; follows Phase 4 rouletteService pattern |
| New ChipRack per game | Refactor existing ChipRack to accept props | Reduces duplication; requires one-time refactor |

**Deprecated/outdated:**
- `Math.random()` for RNG: Never. Project enforces `crypto.randomInt` (GINF-02).
- `autoplay` feature: Out of scope per REQUIREMENTS.md.
- History sidebar: Not for Phase 5 games; deferred to Phase 6.

---

## Open Questions

1. **ChipRack Refactoring Scope**
   - What we know: ChipRack currently imports `useRouletteStore` directly; it cannot be used by other games without modification
   - What's unclear: Whether to refactor ChipRack (touches Phase 4 code) or create game-specific chip racks
   - Recommendation: Planner should schedule ChipRack refactor as Wave 0 task for Phase 5 before any game implementation

2. **Plinko Multiplier Table Completeness**
   - What we know: 8-row low-risk full table confirmed; anchor min/max values for other configs confirmed
   - What's unclear: Exact intermediate bucket values for rows 9-15 and medium/high/expert
   - Recommendation: Hard-code the 8-row low-risk table; use placeholder arrays for others that will be filled by checking the Stake.com live game during implementation (the game is free-to-play with virtual currency)

3. **Double Down Additional Deduction Transaction Safety**
   - What we know: `deductBet` + session state must stay consistent
   - What's unclear: Whether to create a specialized `doubleDownBet` that atomically deducts and updates session state in one transaction
   - Recommendation: Yes — create a single transaction that reads the session (with `.for('update')`), validates it's in `player_turn` phase, deducts the extra bet, updates session state

4. **gameSessions.updatedAt auto-update**
   - What we know: The schema has `updatedAt` field but Drizzle does not auto-update it on `db.update()`
   - What's unclear: Whether the existing pattern already handles this
   - Recommendation: Explicitly pass `updatedAt: new Date()` in every `db.update(gameSessions)` call

---

## Sources

### Primary (HIGH confidence)
- Project codebase directly (apps/backend/src/db/schema.ts, apps/backend/src/routes/games.ts, apps/backend/src/services/walletService.ts, apps/frontend/src/stores/rouletteStore.ts, apps/frontend/src/components/ChipRack.tsx, apps/frontend/src/components/ResultOverlay.tsx) — authoritative for all patterns marked "confirmed in project"
- STATE.md Accumulated Context — all `[Phase *]` decisions are locked architectural choices

### Secondary (MEDIUM confidence)
- bitcasinosrank.com Stake Plinko Math analysis — 8-row low-risk full bucket table, house edge range 0.94–1.09%
- onlineplinko.com Stake Plinko review — min/max multipliers for 8 and 16 rows across low/medium/high risk
- dyutam.com Mines Calculator — formula `∏(totalTiles-i)/(safeTiles-i) × 0.99`, confirmed by multiple sources
- fridaynightfunkin.io Plinko probability guide — illustrative multiplier ranges for 16-row configurations

### Tertiary (LOW confidence — verify against live Stake.com game)
- Intermediate row bucket values (9-15 rows) — not found in any accessible source; must verify live
- Expert risk level specific values — only 10,000× max confirmed for Stake.us variant; not confirmed for all row counts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries confirmed installed in project
- Architecture patterns: HIGH — derived directly from existing rouletteStore, walletService, and games.ts patterns
- Multiplier tables: MEDIUM — anchor values confirmed from multiple community sources; intermediate values need live verification
- Pitfalls: HIGH — derived from actual code structure analysis (ChipRack coupling is a real code issue, not theoretical)
- Mines formula: HIGH — confirmed by multiple provably-fair casino sources; mathematically standard

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain — casino game math does not change; Stake.com multipliers may update but core pattern is stable)
