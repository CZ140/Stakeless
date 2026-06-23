import { useShallow } from 'zustand/react/shallow';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/vault/AppShell';
import { GamePageHeader } from '../components/vault/GamePageHeader';
import { BetPanel } from '../components/vault/BetPanel';
import { GemIcon, BombIcon } from '../components/vault/icons';
import { useMinesStore } from '../stores/minesStore';
import { useBalanceStore } from '../stores/balanceStore';
import { useGameSounds } from '../hooks/useGameSounds';
import { useAutoBet } from '../hooks/useAutoBet';
import type { RoundResult } from '../lib/autobet';
import { LadderStrategyControls, loadLadderStrategy, type LadderStrategy } from '../components/vault/LadderStrategy';
import { apiClient } from '../api/client';
import { sleep as ladderSleep, LADDER_STEP_MS, LADDER_RESULT_MS } from '../lib/sleep';
import { handleApiError } from '../lib/handleApiError';

interface StartResponse {
  sessionId: number;
}
interface TileHitFalse {
  hit: false;
  gem: true;
  currentMultiplier: number;
  tilesRevealed: number;
}
interface TileHitTrue {
  hit: true;
  mineGrid: boolean[];
}
type TileResponse = TileHitFalse | TileHitTrue;
interface CashoutResponse {
  payout: number;
  newBalance: number;
  mineGrid: boolean[];
}
interface ActiveSessionResponse {
  session: null | {
    sessionId: number;
    tilesRevealed: number;
    revealed: number[];
    mineCount: number;
    multiplier: number;
    betAmount: number;
  };
}

function MinesHowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <>
          <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200, animation: 'modal-fade 0.18s ease-out' }}
          />
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 201, pointerEvents: 'none' }}>
            <div
              className="card"
              style={{ padding: '32px', maxWidth: '520px', width: '90vw', maxHeight: '80vh', overflowY: 'auto', pointerEvents: 'auto', animation: 'modal-pop 0.2s ease-out' }}
            >
              <h2 style={{ marginTop: 0, marginBottom: '12px' }}>How to play Mines</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                A 5×5 grid hides mines. Click tiles to reveal gems — each safe tile increases your multiplier. Cash out
                any time to lock in winnings. Hit a mine and lose your bet.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                Choose 1–24 mines. More mines = higher multiplier per safe tile, but greater risk. The mine layout is
                determined server-side — you never know where mines are until you reveal them or cash out.
              </p>
              <button className="btn btn-primary" onClick={onClose}>Got it</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const MINE_PRESETS = [1, 3, 5, 10, 24];

export function MinesPage() {
  const {
    betAmount, mineCount, gamePhase, sessionId, revealed, tilesRevealed, multiplier, isMuted, result, mineGrid,
    setBetAmount, setMineCount, startRound, revealTile, setResult, restoreSession, resetToConfig, toggleMute,
  } = useMinesStore(useShallow((s) => ({ betAmount: s.betAmount, mineCount: s.mineCount, gamePhase: s.gamePhase, sessionId: s.sessionId, revealed: s.revealed, tilesRevealed: s.tilesRevealed, multiplier: s.multiplier, isMuted: s.isMuted, result: s.result, mineGrid: s.mineGrid, setBetAmount: s.setBetAmount, setMineCount: s.setMineCount, startRound: s.startRound, revealTile: s.revealTile, setResult: s.setResult, restoreSession: s.restoreSession, resetToConfig: s.resetToConfig, toggleMute: s.toggleMute })));

  const { playWin, playLoss } = useGameSounds(isMuted);
  const [showHowTo, setShowHowTo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [strat, setStrat] = useState<LadderStrategy>(() => loadLadderStrategy('autostrat_mines'));
  const balance = useBalanceStore((s) => s.balance);

  useEffect(() => {
    apiClient
      .get<ActiveSessionResponse>('/games/mines/active-session')
      .then((res) => {
        if (res.data.session) restoreSession(res.data.session);
      })
      .catch(() => {
        /* no active session — stay in betting phase */
      });
  }, [restoreSession]);

  // Auto-clear the result and return to betting after a short pause (longer than
  // roulette so the revealed mine grid is visible). The player can also click the
  // board or "Play again" to clear it immediately.
  useEffect(() => {
    if (gamePhase !== 'result') return;
    const t = setTimeout(() => resetToConfig(), 3200);
    return () => clearTimeout(t);
  }, [gamePhase, resetToConfig]);

  async function handleStart() {
    setError(null);
    localStorage.setItem('lastBet_mines', String(betAmount));
    try {
      const res = await apiClient.post<StartResponse>('/games/mines/start', { betAmount, mineCount });
      startRound(res.data.sessionId);
    } catch (err: unknown) {
      handleApiError(err, setError);
    }
  }

  async function handleTileClick(row: number, col: number) {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<TileResponse>('/games/mines/tile', { sessionId, row, col });
      const data = res.data;
      if (!data.hit) {
        revealTile(row * 5 + col, data.currentMultiplier);
      } else {
        setResult({ won: false, payout: 0, mineGrid: data.mineGrid });
        playLoss();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number } };
      setError(axiosErr.response?.status === 400 ? 'Invalid tile selection.' : (axiosErr.response?.data?.error ?? 'Something went wrong.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCashOut() {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<CashoutResponse>('/games/mines/cashout', { sessionId });
      setResult({ won: true, payout: res.data.payout, mineGrid: res.data.mineGrid });
      useBalanceStore.getState().setBalance(res.data.newBalance);
      playWin();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number } };
      setError(axiosErr.response?.status === 400 ? 'Cannot cash out yet.' : (axiosErr.response?.data?.error ?? 'Something went wrong.'));
    } finally {
      setIsLoading(false);
    }
  }

  // One auto round at `stake`: start, reveal random tiles until the strategy says
  // cash out (target multiplier or N tiles) or a mine ends it, then settle. Drives
  // the store so the board animates; throws on a backend error.
  async function playRound(stake: number): Promise<RoundResult> {
    setBetAmount(stake);
    localStorage.setItem('lastBet_mines', String(stake));
    const sid = (await apiClient.post<StartResponse>('/games/mines/start', { betAmount: stake, mineCount })).data.sessionId;
    startRound(sid);
    const safe = 25 - mineCount;
    const targetSteps = strat.mode === 'steps' ? Math.min(strat.steps, safe) : safe;
    const picked = new Set<number>();
    let mult = 1;
    let steps = 0;
    while (steps < safe) {
      if (strat.mode === 'steps' && steps >= targetSteps) break;
      if (strat.mode === 'multiplier' && mult >= strat.multiplier) break;
      const avail: number[] = [];
      for (let i = 0; i < 25; i++) if (!picked.has(i)) avail.push(i);
      const idx = avail[Math.floor(Math.random() * avail.length)]!;
      picked.add(idx);
      const data = (await apiClient.post<TileResponse>('/games/mines/tile', { sessionId: sid, row: Math.floor(idx / 5), col: idx % 5 })).data;
      await ladderSleep(LADDER_STEP_MS);
      if (data.hit) {
        setResult({ won: false, payout: 0, mineGrid: data.mineGrid });
        playLoss();
        await ladderSleep(LADDER_RESULT_MS);
        return { profit: -stake, win: false };
      }
      revealTile(idx, data.currentMultiplier);
      mult = data.currentMultiplier;
      steps += 1;
    }
    const c = (await apiClient.post<CashoutResponse>('/games/mines/cashout', { sessionId: sid })).data;
    setResult({ won: true, payout: c.payout, mineGrid: c.mineGrid });
    useBalanceStore.getState().setBalance(c.newBalance);
    playWin();
    await ladderSleep(LADDER_RESULT_MS);
    return { profit: c.payout - stake, win: c.payout - stake >= 0 };
  }

  const auto = useAutoBet(playRound);

  const isConfigPhase = gamePhase === 'betting';
  const isActivePhase = gamePhase === 'active';
  const isResultPhase = gamePhase === 'result';
  const tileDisabled = isLoading || !isActivePhase || auto.running;
  const profit = betAmount * multiplier - betAmount;
  const gemsTotal = 25 - mineCount;

  let primaryLabel = 'Place bet';
  let onPrimary: () => void = () => { void handleStart(); };
  let primaryDisabled = false;
  if (isActivePhase) {
    if (tilesRevealed > 0) {
      primaryLabel = `Cash out · ${(betAmount * multiplier).toFixed(0)} coins`;
      onPrimary = () => { void handleCashOut(); };
      primaryDisabled = isLoading;
    } else {
      primaryLabel = 'Pick a tile';
      onPrimary = () => {};
      primaryDisabled = true;
    }
  } else if (isResultPhase) {
    primaryLabel = 'Play again';
    onPrimary = () => { resetToConfig(); };
  }

  return (
    <AppShell>
      <GamePageHeader
        crumb="MINES"
        title="Mines"
        specs={['5×5 GRID', `${mineCount} MINES`]}
        muted={isMuted}
        onToggleMute={toggleMute}
        error={error}
        onHowTo={() => setShowHowTo(true)}
      />

      <div className="game-layout">
        <div className="game-stage">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 12 }}>
            <div className="mines-stats">
              <div className="col">
                <div className="section-title">Multiplier</div>
                <div className="num v" style={{ color: 'var(--accent)' }}>{multiplier.toFixed(2)}×</div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Profit</div>
                <div className="num v" style={{ color: isResultPhase && result && !result.won ? 'var(--loss)' : 'var(--win)' }}>
                  {isResultPhase && result && !result.won ? '−' : '+'}{Math.max(0, profit).toFixed(2)}
                </div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Gems found</div>
                <div className="num v">{tilesRevealed}/{gemsTotal}</div>
              </div>
            </div>

            <div
              className="mines-grid"
              style={isResultPhase ? { cursor: 'pointer' } : undefined}
              onClick={isResultPhase ? () => resetToConfig() : undefined}
              title={isResultPhase ? 'Click to play again' : undefined}
            >
              {Array.from({ length: 25 }, (_, i) => {
                const row = Math.floor(i / 5);
                const col = i % 5;
                const isSafe = revealed.includes(i);
                const isMine = mineGrid != null && mineGrid[i] === true;
                const cellState = isSafe ? 'safe revealed' : isMine ? 'mine revealed' : '';
                const clickable = !tileDisabled && !isSafe && !isMine;
                return (
                  <div
                    key={i}
                    className={'mine-cell ' + cellState + (clickable ? '' : ' disabled')}
                    onClick={() => clickable && void handleTileClick(row, col)}
                  >
                    {isSafe && <span className="gem"><GemIcon size={30} /></span>}
                    {isMine && <span className="bomb"><BombIcon size={30} /></span>}
                  </div>
                );
              })}
            </div>

            {isResultPhase && result && (
              <div className={'notice ' + (result.won ? 'win' : 'loss')} style={{ minWidth: 260 }}>
                {result.won ? `Cashed out for ${result.payout} coins` : `💥 Hit a mine — lost ${betAmount} coins`}
              </div>
            )}
          </div>
        </div>

        <BetPanel
          amount={betAmount}
          onAmountChange={setBetAmount}
          balance={balance}
          amountLocked={!isConfigPhase || auto.running}
          multiplier={isActivePhase ? multiplier.toFixed(2) : undefined}
          profitOnWin={isActivePhase && tilesRevealed > 0 ? profit : undefined}
          primaryLabel={primaryLabel}
          onPrimary={onPrimary}
          primaryDisabled={primaryDisabled}
          autoBet={{
            running: auto.running,
            stats: auto.stats,
            onStart: (cfg) => auto.start({ ...cfg, baseBet: betAmount }),
            onStop: auto.stop,
            storageKey: 'autobet_mines',
            disabled: !isConfigPhase,
            disabledHint: 'Finish the current round to start auto-bet.',
          }}
          autoExtra={
            <LadderStrategyControls value={strat} onChange={setStrat} stepLabel="tiles" storageKey="autostrat_mines" disabled={auto.running} />
          }
        >
          <div>
            <label className="label">Mines</label>
            <div className="opt-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {MINE_PRESETS.map((n) => (
                <button key={n} type="button" disabled={!isConfigPhase} className={mineCount === n ? 'active' : ''} onClick={() => setMineCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </BetPanel>
      </div>

      <MinesHowToPlay open={showHowTo} onClose={() => setShowHowTo(false)} />
    </AppShell>
  );
}

export default MinesPage;
