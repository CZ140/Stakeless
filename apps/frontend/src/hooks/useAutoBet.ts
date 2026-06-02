import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useBalanceStore } from '../stores/balanceStore';
import {
  type AutoBetConfig,
  type RoundResult,
  type StopReason,
  checkStops,
  nextStake,
  stopMessage,
} from '../lib/autobet';

// Small gap between rounds so we don't hammer the backend (the game routes are
// rate-limited) and the UI stays legible. Each game's playRound already waits for
// its own animation to finish, so this is just breathing room on top.
const PACE_MS = 200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface AutoBetStats {
  betsDone: number;
  net: number; // cumulative profit across the session
  stake: number; // stake for the NEXT round
}

const ZERO_STATS: AutoBetStats = { betsDone: 0, net: 0, stake: 0 };

/**
 * Drives a generic auto-bet loop over a per-game `playRound(stake)` adapter that
 * plays exactly one round and resolves with `{ profit, win }` (and throws on a
 * backend error). Owns stake progression, stop conditions, balance guarding,
 * pacing, and abort-on-unmount. Only one loop runs at a time.
 */
export function useAutoBet(playRound: (stake: number) => Promise<RoundResult>) {
  // Always call the freshest adapter (it closes over live game state like the
  // current dice target / coin call), even though `start` is created once.
  const playRef = useRef(playRound);
  playRef.current = playRound;

  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<AutoBetStats>(ZERO_STATS);

  const finish = useCallback((reason: StopReason) => {
    runningRef.current = false;
    setRunning(false);
    const msg = stopMessage(reason);
    if (msg) toast(msg);
  }, []);

  const stop = useCallback(() => finish('manual'), [finish]);

  const start = useCallback(
    (cfg: AutoBetConfig) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);

      let stake = Math.max(1, Math.floor(cfg.baseBet));
      let net = 0;
      let done = 0;
      let left = cfg.numberOfBets > 0 ? cfg.numberOfBets : Infinity;
      setStats({ betsDone: 0, net: 0, stake });

      void (async () => {
        while (runningRef.current && left > 0) {
          const balance = useBalanceStore.getState().balance ?? 0;
          if (balance < stake) {
            finish('funds');
            break;
          }

          let res: RoundResult;
          try {
            res = await playRef.current(stake);
          } catch (e) {
            const status = (e as { response?: { status?: number } }).response?.status;
            finish(status === 429 ? 'rate' : status === 402 ? 'funds' : 'error');
            break;
          }
          // A Stop pressed mid-round: don't count it or keep going.
          if (!runningRef.current) break;

          net += res.profit;
          done += 1;
          left -= 1;
          stake = nextStake(stake, cfg, res.win);
          setStats({ betsDone: done, net, stake });

          const hit = checkStops(net, cfg);
          if (hit) {
            finish(hit);
            break;
          }
          if (left <= 0) {
            finish('count');
            break;
          }
          await sleep(PACE_MS);
        }
        runningRef.current = false;
        setRunning(false);
      })();
    },
    [finish],
  );

  // Abort the loop if the page unmounts (any in-flight round still settles
  // server-side; sessions are resumable).
  useEffect(() => () => { runningRef.current = false; }, []);

  return { running, stats, start, stop };
}
