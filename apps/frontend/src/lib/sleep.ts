/** Resolve after `ms` milliseconds. Shared by game pages for animation pacing. */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Ladder pacing shared by the session-based ladder games (Mines, Hi-Lo, Pump,
// Chicken): pause between auto steps so the board reads, then hold the
// win/loss result before the next round.
export const LADDER_STEP_MS = 280;
export const LADDER_RESULT_MS = 650;
