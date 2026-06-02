// Shared, game-agnostic auto-bet model. The pure pieces (stake progression + stop
// conditions) live here so they can be unit-tested in isolation; the orchestration
// loop lives in the useAutoBet hook, and each game supplies a `playRound(stake)`
// adapter that plays exactly one round and resolves with its net result.

/** What to do to the stake after a win (resp. loss). */
export interface ProgressionStep {
  action: 'reset' | 'increase';
  pct: number; // percent to grow the stake by when action === 'increase'
}

export interface AutoBetConfig {
  baseBet: number;
  numberOfBets: number; // 0 = infinite
  onWin: ProgressionStep;
  onLoss: ProgressionStep;
  stopOnProfit: number | null; // stop once cumulative net ≥ this
  stopOnLoss: number | null; // stop once cumulative net ≤ -this
  maxBet: number | null; // hard cap on the stake (tames martingale runaway)
}

/** Net outcome of one auto round. profit = payout − stake (negative on a loss). */
export interface RoundResult {
  profit: number;
  win: boolean;
}

export type StopReason =
  | 'count' // requested number of bets reached
  | 'profit' // stop-on-profit target hit
  | 'loss' // stop-on-loss limit hit
  | 'funds' // not enough balance for the next stake
  | 'rate' // backend rate-limited us
  | 'error' // a round threw
  | 'manual'; // user pressed Stop / navigated away

export const DEFAULT_AUTOBET_CONFIG: AutoBetConfig = {
  baseBet: 10,
  numberOfBets: 0,
  onWin: { action: 'reset', pct: 0 },
  onLoss: { action: 'reset', pct: 0 },
  stopOnProfit: null,
  stopOnLoss: null,
  maxBet: null,
};

/** Stake for the next round given the just-settled round's outcome. */
export function nextStake(stake: number, cfg: AutoBetConfig, win: boolean): number {
  const step = win ? cfg.onWin : cfg.onLoss;
  let next = step.action === 'reset' ? cfg.baseBet : Math.round(stake * (1 + step.pct / 100));
  next = Math.max(1, next);
  if (cfg.maxBet != null) next = Math.min(next, cfg.maxBet);
  return next;
}

/** Whether a stop-on-profit / stop-on-loss threshold has been crossed. */
export function checkStops(net: number, cfg: AutoBetConfig): 'profit' | 'loss' | null {
  if (cfg.stopOnProfit != null && net >= cfg.stopOnProfit) return 'profit';
  if (cfg.stopOnLoss != null && net <= -cfg.stopOnLoss) return 'loss';
  return null;
}

/** Human-readable toast for why auto-bet halted (null = silent, e.g. count reached). */
export function stopMessage(reason: StopReason): string | null {
  switch (reason) {
    case 'profit':
      return 'Auto-bet stopped — profit target reached';
    case 'loss':
      return 'Auto-bet stopped — loss limit reached';
    case 'funds':
      return 'Auto-bet stopped — not enough coins for the next bet';
    case 'rate':
      return 'Auto-bet stopped — slow down (too many bets too fast)';
    case 'error':
      return 'Auto-bet stopped — something went wrong';
    case 'count':
    case 'manual':
      return null;
  }
}
