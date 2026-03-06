---
phase: 05-remaining-games
plan: "05"
subsystem: frontend
tags: [blackjack, game-ui, zustand, css-animation, session-restore]
dependency_graph:
  requires:
    - blackjackService.ts (05-04 backend — deal/hit/stand/double/active-session routes)
    - useBalanceStore (setBalance)
    - useGameSounds hook
    - apiClient
    - Header, ProtectedRoute components
  provides:
    - useBlackjackStore (Zustand store — betAmount, gamePhase, sessionId, playerHand, dealerHand, outcome)
    - BlackjackCard component (CSS-only playing card with face-down back and slide-in animation)
    - BlackjackPage (full game UI at /games/blackjack)
    - /games/blackjack route in App.tsx
  affects:
    - apps/frontend/src/App.tsx (route added)
    - apps/frontend/src/pages/DashboardPage.tsx (Blackjack available:true)
tech_stack:
  added: []
  patterns:
    - Zustand v5 double-parens pattern (create<State>()((set) => ...))
    - CSS keyframe animation injected once via document.createElement('style')
    - Session restore via GET /games/blackjack/active-session on mount
    - Optimistic card animation via newCardIndex tracking
    - 300ms dealer reveal pause for drama before state update
key_files:
  created:
    - apps/frontend/src/stores/blackjackStore.ts
    - apps/frontend/src/components/BlackjackCard.tsx
    - apps/frontend/src/pages/BlackjackPage.tsx
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/pages/DashboardPage.tsx
decisions:
  - "BlackjackCard animation: CSS @keyframes injected once into document.head via a module-level guard (animationInjected flag) — avoids duplicate style injection on re-renders"
  - "Dealer hand display: during player_turn shows only dealerUpCard + one face-down BlackjackCard; during settled shows full dealerHand from server"
  - "newPlayerCardIndex tracked in local state to trigger animateIn on the most recently added card only — key-based re-animation"
  - "handleDouble: addPlayerCard optimistically with server card, then revealDealerHand overwrites gamePhase to settled"
  - "SUIT_SYMBOLS uses Unicode escape sequences for hearts/diamonds/spades/clubs — no asset dependencies"
metrics:
  duration: "3 min"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_changed: 5
---

# Phase 5 Plan 5: Blackjack Frontend Summary

**One-liner:** Blackjack frontend with Zustand v5 store, CSS-only animated playing cards (face-up + face-down), felt-green card table, Hit/Stand/Double action buttons, 3:2 natural blackjack display, and session-restore on page refresh — closes Phase 5 with all four v1 games playable.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Blackjack Zustand store and Card component | 3a42c80 | blackjackStore.ts, BlackjackCard.tsx |
| 2 | BlackjackPage UI, App router, and Dashboard update | 2a319e9 | BlackjackPage.tsx, App.tsx, DashboardPage.tsx |

## What Was Built

### blackjackStore.ts

Zustand v5 store (double-parens TypeScript pattern) with:

- **State:** `betAmount`, `gamePhase` (betting/player_turn/dealer_turn/settled), `sessionId`, `playerHand`, `dealerUpCard`, `dealerHand`, `playerValue`, `dealerValue`, `outcome`, `isMuted`
- **Actions:** `setBetAmount`, `halfBet`, `doubleBet`, `dealHand`, `settleImmediate`, `addPlayerCard`, `revealDealerHand`, `resetToConfig`, `toggleMute`
- `betAmount` initialised from `localStorage.getItem('lastBet_blackjack')` for last-bet prefill
- `isMuted` persisted to `localStorage` via `toggleMute`

### BlackjackCard.tsx

CSS-only playing card component (no image assets):

- Face-up: white (#ffffff) card with rank + suit symbol in top-left and bottom-right corners (180deg rotation), large center suit symbol
- Red suits (hearts ♥, diamonds ♦): `#dc2626`; Black suits (spades ♠, clubs ♣): `#1a1a2e`
- Face-down: dark purple gradient with diagonal CSS `repeating-linear-gradient` back pattern
- Animation: `animateIn` prop triggers `bj-card-slide-in` keyframe (translateY(-20px) → 0, 300ms ease-out) injected once into `document.head`
- Card size: 70×100px; `flexShrink: 0` for hand row layout

### BlackjackPage.tsx

Full multi-phase game UI:

- **Betting phase:** Chip quick-select (10/50/100/500/Max), numeric input with +/- buttons, Half/Double bet, Deal button with loading state
- **Card table:** Felt-green area (`#1a3a1a`) with dealer and player hand areas separated by a divider; face-down card shown for dealer's hole card during player turn
- **Player turn:** Hit (green), Stand (purple), Double Down (amber, shows 2x amount) buttons; all three disabled during API calls
- **Settled phase:** Outcome banner with color-coded results (gold for blackjack 3:2, green for win, blue for push, red for bust/loss); Play Again button
- **Session restore (mount useEffect):** GET `/games/blackjack/active-session` — restores `player_turn` in-progress hands or shows auto-completed settled result from disconnect

### App.tsx + DashboardPage.tsx

- `/games/blackjack` ProtectedRoute added — Blackjack accessible at correct URL
- `DashboardPage.tsx` Blackjack game card: `available: true` — all four v1 games (Roulette, Plinko, Mines, Blackjack) now active on dashboard

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: apps/frontend/src/stores/blackjackStore.ts
- FOUND: apps/frontend/src/components/BlackjackCard.tsx
- FOUND: apps/frontend/src/pages/BlackjackPage.tsx
- FOUND: 3a42c80 (feat(05-05): Blackjack Zustand store and BlackjackCard component)
- FOUND: 2a319e9 (feat(05-05): BlackjackPage UI, App router route, and Dashboard card enable)
- TypeScript: 0 errors
