---
phase: 08-admin-anti-cheat
plan: 05
subsystem: frontend-error-handling
tags: [error-handling, rate-limiting, catch-blocks, gap-closure]
dependency_graph:
  requires: [08-01, 08-02]
  provides: [rate-limit-error-visibility]
  affects: [MinesPage, RoulettePage, PlinkoPage, BlackjackPage]
tech_stack:
  added: []
  patterns: [axiosErr.response?.data?.error ?? fallback]
key_files:
  modified:
    - apps/frontend/src/pages/MinesPage.tsx
    - apps/frontend/src/pages/RoulettePage.tsx
    - apps/frontend/src/pages/PlinkoPage.tsx
    - apps/frontend/src/pages/BlackjackPage.tsx
decisions:
  - "Status-specific messages (402, 400) preserved; data?.error only used in else/fallback branches"
  - "Bare catch{} in handleHit and handleStand converted to catch(err: unknown) with typed assertion"
metrics:
  duration: 2 min
  completed_date: 2026-03-06
  tasks_completed: 2
  files_modified: 4
---

# Phase 8 Plan 5: 429 Error Message Display Gap Closure Summary

**One-liner:** Fixed all 8 game-page catch blocks to read `axiosErr.response?.data?.error` so the backend's "Too many requests. Slow down." message reaches the UI instead of being discarded.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix MinesPage.tsx catch blocks | 3c2baa9 | MinesPage.tsx |
| 2 | Fix Roulette, Plinko, Blackjack catch blocks | c6dcd49 | RoulettePage.tsx, PlinkoPage.tsx, BlackjackPage.tsx |

## What Was Built

Every game page was discarding the HTTP response body on errors — type assertions only included `{ response?: { status?: number } }` with no `data` field, so the server's `{ error: "Too many requests. Slow down." }` response was invisible to the UI. Two Blackjack handlers used bare `catch {}` with no error parameter at all.

Changes made across 4 files / 8 catch blocks:

- **MinesPage.tsx** (3 catch blocks): Added `data?: { error?: string }` to all three type assertions. `handleStart` else branch now reads `data?.error ?? fallback`. `handleTileClick` and `handleCashOut` ternary else-paths now read `data?.error ?? fallback` while preserving the 400-specific messages.
- **RoulettePage.tsx** (1 catch block): Type assertion already had `data?.error` — only the else branch was hardcoded. Fixed to read `data?.error ?? fallback`.
- **PlinkoPage.tsx** (1 catch block): Added `data?: { error?: string }` to type assertion and updated else branch to read `data?.error ?? fallback`.
- **BlackjackPage.tsx** (4 catch blocks): `handleDeal` and `handleDouble` had missing `data` in assertions — fixed plus else branch updated. `handleHit` and `handleStand` were bare `catch {}` — converted to `catch (err: unknown)` with typed assertion and `data?.error ?? fallback`.

## Verification Results

- `npx tsc --noEmit` from `apps/frontend/` exits 0 (no errors)
- `data?.error` pattern present in all 4 files: 9 total matches (3+1+1+4)
- No bare `catch {}` blocks remain in BlackjackPage.tsx
- 429 rate-limit responses with `{ error: "Too many requests. Slow down." }` will now surface correctly in UI

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All modified files exist. Both task commits verified present (3c2baa9, c6dcd49). TypeScript clean. 9 data?.error matches across 4 files. No bare catch{} blocks remain.
