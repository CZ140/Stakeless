# Feature Research

**Domain:** Browser-based virtual casino / social gambling platform
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH — core casino UX conventions are well-documented; social casino specifics verified across multiple sources

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent balance display | Players must always know their current balance without navigating away — missing this creates immediate distrust | LOW | Sticky header/sidebar; updates in real-time after each bet resolution |
| Bet amount input with quick-select chips | Every casino interface has pre-set chip values (e.g. 10 / 50 / 100 / 500 / Max); typing raw numbers is tolerable but feels unpolished | LOW | Half / Double / Max buttons are standard; chip tray UI is expected on table games |
| Win/loss feedback animation | Players expect a clear visual response — coin burst, number pop, color flash on win; no silent state changes | LOW-MEDIUM | Missing this makes wins feel like losses; sound reinforces the signal |
| Sound effects with mute toggle | Coin jingle on win, chip click on bet place, ambient table sound — expected; **mute must be persistent across sessions** | LOW | Mute state stored in localStorage; per-category volume is a differentiator |
| Game result clearly displayed | Outcome visible before the next round starts — especially hand totals in Blackjack, wheel landing in Roulette | LOW | Users need closure before next bet; a "play again" prompt after result is standard |
| Daily bonus claim | Every social casino has this — it's the core loop for free-to-play retention | LOW | Once-per-24h claim from dashboard; streak multiplier is optional but common |
| Bet history / game log | Players expect to review recent rounds — "did I win that?" is a common question | MEDIUM | Last N rounds (20–50) per game type; not full audit but session-level history |
| Sufficient starting balance | New users need enough coins to play without frustration; zero-balance dead-ends cause immediate churn | LOW | Starting balance should be enough for ~50–100 minimum bets |
| Account balance persistence | Balance survives logout/refresh — trivially expected but must be mentioned | LOW | Server-side source of truth; client-side optimistic update |
| Responsive layout (desktop + mobile) | 60–75% of casino traffic is mobile (MEDIUM confidence); layout must not break on phone | MEDIUM | Bet controls must be thumb-reachable; card tables need landscape or compact mode |
| Fast game load (under 5 seconds) | 79% of users abandon if game doesn't load within 5 seconds (MEDIUM confidence, single study) | LOW-MEDIUM | Lazy load game assets; show spinner with progress rather than blank screen |
| Game rules / how to play | Casual users need accessible rules — hidden or absent rules cause abandonment | LOW | Modal or collapsible panel; don't require navigation away from game |
| Server-side bet validation | Users expect the platform to be fair; client-trust creates obvious exploit vectors | MEDIUM | All bet deductions, outcome resolution, and credits happen server-side |
| Min/max bet enforced | Enforced floor prevents balance-cheating; ceiling prevents single-bet drain exploits | LOW | UI should show min/max; graceful error on violation |
| Profile page with stats | Players want to see their history — total wagered, profit/loss, games played | LOW-MEDIUM | Public-facing is differentiating; private stats page is table stakes |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but clearly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-time leaderboard via WebSocket | Leaderboards that feel live (not page-refresh) create competitive urgency; static leaderboards feel stale | MEDIUM | WebSocket push for top-N rank changes; throttle updates to avoid thrash (1–2s debounce) |
| Multiple leaderboard dimensions | Balance / Total Wagered / Profit — gives different player types a board to compete on; whales dominate balance, high-frequency players dominate wagered | LOW | Already planned; the key is making them feel distinct, not just tab-switched |
| Bet streak display | Showing current win/loss streak on-screen reinforces momentum and engagement | LOW | Simple counter; resets on session or game change |
| Animated Plinko ball physics | Plinko's entire appeal is watching the ball bounce — a static "result: 2.5x" message destroys the game's entertainment value | MEDIUM | CSS/canvas animation with ball following a real path through pegs; must feel physical |
| Mines tile reveal animation | Each tile flip should have a satisfying reveal; gem reveal vs mine explosion are core UX moments | LOW-MEDIUM | CSS flip transition; mine explosion effect (particle burst or shake) on game-end |
| Roulette wheel spin animation | The wheel spin is the tension-building moment in Roulette; a "result: Red 14" without visual spin fails the experience | HIGH | Canvas or CSS 3D wheel; ball must decelerate realistically; this is the hardest game animation |
| Cashout mechanic for Mines | Players can lock in their multiplier at any safe tile — this is the core decision loop of Mines and must be prominent | LOW | "Cash Out" button always visible during active Mines round; shows current multiplier |
| Progressive daily bonus streak | Bonus increases each consecutive day (Day 1: 100 coins, Day 7: 1,000 coins); missed day resets — dramatically increases daily return rate | LOW-MEDIUM | Track last_claim_at and streak_count; display streak visually on dashboard |
| Balance over time chart | Players love seeing their arc — a simple line chart showing balance history is sticky and shareable | MEDIUM | Chart.js or Recharts; data already logged via game records; daily snapshots or per-bet points |
| Game-specific sound design | Themed sounds per game (card shuffle/deal for Blackjack, wheel click for Roulette, peg bounce for Plinko) vs generic shared library | MEDIUM | Requires sourcing/producing per-game audio; significantly improves immersion |
| Admin live dashboard | Real-time platform stats (active users, bets/min, coins in circulation) gives operator confidence and makes the admin panel genuinely useful | MEDIUM | WebSocket push to admin dashboard; simple counters not a full BI system |
| Provably fair transparency display | Show RNG seed/hash for each round — not expected in a virtual casino, but dramatically increases player trust | HIGH | Requires server-seed / client-seed / nonce architecture; display verification UI per round |
| Keyboard shortcuts for betting | Power users expect spacebar to deal, enter to stand, number keys for bet amounts — reduces friction for repeat plays | LOW | Blackjack is the primary candidate; adds genuine UX polish |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create significant problems for this platform.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Autoplay / Auto-bet | Players want to grind passively; reduces click fatigue | Increases bankroll depletion speed (research shows +7–9% total activity), disengages the player from the game loop, creates perceived exploitation risk. For a social platform, it defeats the purpose of interactive gameplay. Regulators also restrict autoplay in real-money contexts (learned habit). | Manual play only for v1; if added, enforce loss limits and spin count caps |
| Chat / live chat | Social engagement, community feel | Requires moderation, exposes minors to problematic content, needs a content policy, dramatically increases operational complexity | Defer to v2; consider async social features (share result, tag friend) instead |
| Real-time multiplayer games (Poker, Live Blackjack tables) | Competitive depth, social experience | Multiplayer requires matchmaking, room state, bot fill logic, latency management, disconnect handling — a separate engineering workstream entirely | Single-player vs dealer is sufficient for v1; Poker explicitly deferred to v2 |
| Cosmetic marketplace / avatar items | Monetization, personalization | Without real money, a cosmetic marketplace has no revenue mechanism; free cosmetics devalue them; complex inventory management adds backend overhead with no v1 value | Defer cosmetics to v2; use username + rank badge as identity for v1 |
| VIP tier system / loyalty points | Retention through status progression | Requires separate point currency, tier tracking, tier-gated rewards, and promotional design — significant overhead. For v1 with an unvalidated player base, VIP tiers are premature optimization. | Use leaderboard rank as social status signal; VIP tiers are a v2 retention lever |
| Push notifications / email re-engagement | Retention — reminds users to claim bonus | Email deliverability infrastructure is non-trivial (SPF, DKIM, unsubscribe compliance). Browser push requires service workers and permission flows. Both are disproportionate to v1. | Password reset email is necessary; daily bonus visibility on the dashboard handles reminder UX |
| Infinite scroll game lobby | Discoverability, no dead ends | With 4 games, infinite scroll is absurd. Premature patterns for small catalogs create confusing UX. | Grid of 4 game cards with thumbnails, name, and "Play" button — clean and complete |
| Social sharing of results | Virality, social proof | Screen-share/screenshot is sufficient for v1. Custom share cards require image generation infrastructure. Privacy concerns if balance is shown. | Add a "Copy result" text button if sharing feels needed; skip image generation |
| Client-side game outcome trust | Development speed, simpler architecture | Trivially exploitable. Network interception or client modification gives players arbitrary outcomes. Reputation destruction if discovered. | Server-side outcome resolution is non-negotiable — already in PROJECT.md |

---

## Feature Dependencies

```
[User Auth / Accounts]
    └──requires──> [Virtual Currency Balance]
                       └──requires──> [Game Infrastructure (bet deduct / credit)]
                                          └──requires──> [Server-side Outcome Resolution]

[Leaderboards]
    └──requires──> [User Auth]
    └──requires──> [Game Infrastructure] (needs bet/profit data)
    └──enhanced by──> [WebSocket real-time push]

[Daily Bonus]
    └──requires──> [User Auth]
    └──requires──> [Virtual Currency Balance]

[Player Profile / Stats]
    └──requires──> [User Auth]
    └──requires──> [Game Infrastructure] (game logs)
    └──enhanced by──> [Balance over time chart]

[Admin Panel]
    └──requires──> [User Auth with RBAC]
    └──requires──> [Game Infrastructure] (game logs, user data)

[Bet History / Game Log]
    └──requires──> [Game Infrastructure]

[Plinko Ball Animation]
    └──requires──> [Plinko Game Logic] (ball path must match server-determined outcome)
    └──note──> Animation is cosmetic but path MUST match actual outcome; divergence destroys trust

[Mines Cashout UI]
    └──requires──> [Mines Game Logic]
    └──note──> Cashout state lives server-side; client shows button, server validates cashout request

[Roulette Wheel Animation]
    └──requires──> [Roulette Game Logic]
    └──note──> Server resolves outcome first; animation reveals predetermined result (not determined by animation)

[Progressive Daily Bonus Streak]
    └──requires──> [Daily Bonus]
    └──note──> streak_count column on Users table; last_claim_at already required for 24h gate

[Balance Chart]
    └──requires──> [Game Infrastructure] (per-bet profit logging already planned)
    └──note──> No extra data collection needed; query existing Bets table for running balance
```

### Dependency Notes

- **Game Infrastructure is the critical foundation:** All games, leaderboards, stats, admin panel, and bet history depend on the core bet-deduct / resolve / credit pipeline being correct. Build and test this before building any game UI.
- **Server-side resolution must precede all animations:** In Plinko, Roulette, and Mines, the server determines the outcome before the client renders the animation. The animation reveals a predetermined result — it never drives the outcome. Failure to enforce this is an architectural mistake that causes trust issues.
- **WebSocket is a leaderboard dependency, not a game dependency:** Game balance updates can use REST + optimistic UI for v1; leaderboard real-time feel requires WebSocket. Don't over-scope WebSocket to the entire platform.
- **Auth RBAC blocks Admin Panel:** Admin panel cannot be built until role-based access control is in place on the auth system.

---

## MVP Definition

### Launch With (v1) — Already Scoped in PROJECT.md

- [x] User auth (register, login, JWT sessions, password reset)
- [x] Virtual currency — starting balance, daily bonus (24h gate), balance persistence
- [x] Blackjack — single-player vs dealer, hit/stand/double-down; card deal animation
- [x] Roulette — European wheel, standard bet types; wheel spin animation (scope risk: HIGH complexity)
- [x] Plinko — risk level selector, row count, ball physics animation
- [x] Mines — mine count selector, tile reveal, cashout mechanic
- [x] Game infrastructure — server-side validation, bet logging (UserID, GameType, BetAmount, Result, Profit, Timestamp)
- [x] Leaderboards — Balance, Wagered, Profit; real-time via WebSocket
- [x] Player profile — stats, balance chart, game history
- [x] Admin panel — user management, ban/reset, platform dashboard
- [x] Anti-cheat — rate limiting, server-side validation, click interval checks

### Add After Validation (v1.x)

- [ ] Progressive daily bonus streak (streak_count field, escalating rewards) — trigger: daily active users are returning but churn spikes on day 3–4
- [ ] Bet history UI (last 50 rounds per game) — trigger: player feedback asking "what happened to my balance?"
- [ ] Keyboard shortcuts for Blackjack — trigger: power users requesting it
- [ ] Per-game sound design (replace shared audio library with game-specific sounds) — trigger: aesthetic feedback in user testing

### Future Consideration (v2+)

- [ ] Clicker/idle progression system — explicitly deferred in PROJECT.md; adds retention without game dependency
- [ ] Slots / Case Spinner — game library expansion after v1 is validated
- [ ] Poker (multiplayer + bot fill) — separate workstream; high complexity
- [ ] VIP tier system / loyalty points — retention lever for established player base
- [ ] Cosmetic marketplace — requires monetization model decision
- [ ] Chat / social features — community layer; requires moderation infrastructure
- [ ] Tournaments / scheduled events — requires time-bounded leaderboard infrastructure
- [ ] Provably fair verification UI — trust differentiator worth building once credibility matters
- [ ] Blackjack split — rules complexity, additional game state; deferred per PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Persistent balance display (sticky header) | HIGH | LOW | P1 |
| Quick-select bet chips (Half / Double / Max) | HIGH | LOW | P1 |
| Win/loss animation + sound feedback | HIGH | LOW-MEDIUM | P1 |
| Sound with persistent mute toggle | HIGH | LOW | P1 |
| Daily bonus (24h gate) | HIGH | LOW | P1 |
| Server-side outcome resolution | HIGH | MEDIUM | P1 |
| Game rules / how-to-play panel | MEDIUM | LOW | P1 |
| Plinko ball physics animation | HIGH | MEDIUM | P1 |
| Mines cashout button + multiplier display | HIGH | LOW | P1 |
| Roulette wheel spin animation | HIGH | HIGH | P1 (scope risk) |
| Blackjack card deal animation | MEDIUM | LOW-MEDIUM | P1 |
| Real-time leaderboard (WebSocket) | HIGH | MEDIUM | P1 |
| Balance over time chart (profile) | MEDIUM | MEDIUM | P1 |
| Bet history / game log | MEDIUM | MEDIUM | P2 |
| Progressive daily bonus streak | MEDIUM | LOW-MEDIUM | P2 |
| Keyboard shortcuts (Blackjack) | LOW | LOW | P2 |
| Per-game themed sound design | MEDIUM | MEDIUM | P2 |
| Multiple leaderboard dimensions | MEDIUM | LOW | P1 (already scoped) |
| Provably fair display | LOW | HIGH | P3 |
| Autoplay | LOW (per-feature value) | MEDIUM | Anti-feature — do not build |
| Social sharing cards | LOW | MEDIUM | P3 |

---

## Competitor Feature Analysis

Key reference platforms: Stake.com (crypto casino, polished originals), BC.Game (10k+ games, 70+ originals), Pulsz / Chumba (social casino, sweepstakes model), LuckyLand (virtual currency, social model).

| Feature | Stake.com | BC.Game | Pulsz/Social Casinos | Our Approach |
|---------|-----------|---------|----------------------|--------------|
| Plinko | Risk selector (Low/Med/High), row count 8–16, real-time ball animation | Similar to Stake | Rare / simplified | Implement: risk level + rows + animated ball (core game identity) |
| Mines | 5×5 grid, 1–24 mine count, cashout at any time, provably fair | Similar | Not common | Implement: grid + mine count + cashout; skip provably fair display for v1 |
| Roulette | European wheel, animated spin, all standard bet types | Similar | Often simplified (Red/Black only) | Full European wheel with animation; all bet types as in PROJECT.md |
| Blackjack | Standard rules, card animations, dealer voice optional | Standard | Standard | Standard rules + card animation; skip dealer voice for v1 |
| Daily bonus | Large daily bonus + streak (escalating rewards) | Daily claim | Streak-based (Day 1–7 escalating) | Implement flat bonus for v1; streak is v1.x |
| Leaderboards | Global + game-specific, real-time | Similar | Less prominent | 3 dimensions (balance/wagered/profit), real-time via WebSocket |
| Balance display | Persistent top-bar, always visible | Same | Same | Persistent header — non-negotiable |
| Sound | Per-game themed audio, mute toggle | Same | Same | Mute toggle v1; per-game audio v1 or v1.x |
| Autoplay | Yes (slots-focused) | Yes | Sometimes | Explicitly skip for v1 — interactive play only |
| Social/chat | Full chat, rain feature, tips | Chat + social | Limited | Skip for v1; not aligned with competitive edge |
| Admin panel | Not visible to players | Not visible | Not visible | Internal tool; Stake/BC reference irrelevant here |

---

## Casino Game UX Conventions — Implementation Reference

### Bet Controls (All Games)

- **Chip tray / quick-select:** Pre-set values displayed as clickable chips or buttons. Standard values: 10 / 50 / 100 / 500 / 1000 / Max. "Half" and "Double" buttons are strong UX.
- **Manual input fallback:** Input field for exact amounts; validate on blur not on keystroke.
- **Max bet guard:** Prevent bets exceeding balance; disable or cap silently. Do NOT show an error modal — just cap at balance.
- **Min bet floor:** Enforce minimum (e.g., 1 coin); show as greyed UI state when balance is too low.
- **Bet amount persists between rounds:** User should not have to re-enter their bet every round. Pre-fill with last bet.

### Win/Loss Animations

- **Win:** Coin burst or number pop from result area; green flash or glow on balance display; celebratory sound (coins, chime, bell). Animation duration: 1–2 seconds. Must not block the next bet.
- **Loss:** Red flash or shake on result area; loss sound (low tone, brief). Keep it brief — dwelling on losses feels punitive.
- **Big win:** Larger animation — more coins, longer sound, screen glow. Threshold: win ≥ 5x bet. Don't animate every win identically.
- **Blackjack bust:** Card shake or red overlay on hand total. Clear text: "Bust" or "Dealer wins."
- **Push/tie:** Neutral animation; coins return without fanfare.

### Game Flow

- **Action is immediate:** No loading spinners between bet and result for simple games (Blackjack hit, Roulette result). Use optimistic UI where safe.
- **Round closure is explicit:** Player must see a result state before next round starts. Auto-advance without closure is disorienting.
- **Confirmation for high bets:** Optional — show a confirm for bets above a threshold (e.g., >10% of balance). Keeps this feeling considered, not compulsive.

### Sound Design

- **Bet place:** Short chip click or mechanical sound (50–100ms).
- **Card deal (Blackjack):** Swipe/slide sound per card dealt.
- **Win:** Coin jingle or ascending chime. Scale with win size.
- **Loss:** Low thud or descending note. Brief.
- **Plinko ball bounce:** Peg click per bounce (may need to debounce if many pegs).
- **Mines reveal:** Gem sparkle sound on safe tile; explosion/alert on mine hit.
- **Roulette spin:** Wheel whir + ball rattle; deceleration sound.
- **Mute:** Persistent across sessions via localStorage. Default: sound ON (industry standard); offer mute on first load if autoplay audio is blocked by browser.

### Leaderboard Design

- **Show rank context:** Display player's own rank even when not in top 10 (e.g., "You: #47"). Players disengage if they can't see themselves.
- **Top 10 displayed:** Standard; show top 50 on expanded view.
- **Time scope:** All-time is simplest; weekly is more competitive and re-engages players who fell behind. All-time alone may lock out new players from ever competing.
- **Real-time feel:** Animate rank changes (smooth position transitions); throttle to 1–2s update intervals to prevent visual thrash.
- **Username + avatar initial:** Display something besides just a name row; rank badge/medal icon for top 3.

---

## Sources

- [New Social Casinos in the US: A 2026 Guide to Social Gaming](https://dulux.com.cy/new-online-social-casinos-in-the-us-a-2026-guide-to-social-gaming-3/) — MEDIUM confidence (WebSearch)
- [Social Casino Growth: The Dual-Coin Model and Its Impact on Players in 2026](https://www.rakeback.com/news/social-casino-growth-the-dual-coin-model-and-its-impact-on-players-in-2026/) — MEDIUM confidence (WebSearch)
- [Key UX Features Developers Prioritize to Make Online Casino Games More Engaging](https://gaming-fans.com/2025/05/key-ux-features-developers-prioritize-to-make-online-casino-games-more-engaging-and-player-friendly/) — MEDIUM confidence (WebFetch verified)
- [Gamification in Online Casinos: How Leaderboards and Rewards Boost Engagement](https://www.godisageek.com/2025/01/gamification-in-online-casinos-how-leaderboards-and-rewards-boost-engagement/) — MEDIUM confidence (WebFetch verified)
- [The Ultimate Guide to Casino Gamification](https://everymatrix.com/casino-gamification-guide/) — MEDIUM confidence (WebFetch verified)
- [UX/UI Design Trends for iGaming Applications in 2025](https://www.thebettingcoach.com/en/2025/02/10/ux-ui-design-trends-for-igaming-applications-in-2025/) — MEDIUM confidence (WebFetch verified)
- [Plinko Game Odds: Pins, Rows, Risk Settings and Multipliers](https://www.newgamenetwork.com/article/2932/plinko-odds-pins-rows-risk-settings-and-multipliers/) — MEDIUM confidence (WebSearch)
- [Stake Mines Guide 2026](https://stakecasinoreview.com/mines/) — MEDIUM confidence (WebSearch)
- [Autoplay in Online Slots: Pros and Cons](https://casino.borgataonline.com/en/blog/autoplay-in-online-slots-the-pros-and-cons/) — MEDIUM confidence (WebSearch)
- [Offering an auto-play feature likely increases total gambling activity — Frontiers in Psychiatry](https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2024.1340104/full) — HIGH confidence (peer-reviewed study)
- [Casino Website UX/UI & SEO Guide 2025](https://slotegrator.pro/analytical_articles/ux-mistakes-to-avoid-while-designing-online-casino-interface.html) — MEDIUM confidence (WebSearch, page returned 403 on fetch)
- [Gamification in iGaming: Boost Casino Retention & Revenue in 2026](https://ilogos.biz/igaming-gamification-strategies/) — MEDIUM confidence (WebSearch)
- [Online Casino Design Secrets: How UX & UI Transform the Gaming Experience](https://amazingarchitecture.com/articles/online-casino-design-secrets-how-uxui-transform-the-gaming-experience) — MEDIUM confidence (WebSearch)
- [The Impact of Sound in Modern Multiline Video Slot Machine Play — PMC/NIH](https://pmc.ncbi.nlm.nih.gov/articles/PMC4225056/) — HIGH confidence (peer-reviewed)

---

*Feature research for: Virtual Casino Platform (Blackjack, Roulette, Plinko, Mines — virtual currency only)*
*Researched: 2026-02-27*
